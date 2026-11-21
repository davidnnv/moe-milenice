-- =====================================================================
-- Мое Милениче — база на податоци за Supabase
-- Пуштете го целиот фајл еднаш во Supabase → SQL Editor → Run.
-- Безбедно е да се пушти повторно (сè е "if not exists" / "or replace").
-- ПОТОА пуштете го и supabase/security.sql (rate limiting, ограничувања, права).
-- =====================================================================

-- Времињата се чуваат како минути од полноќ (на пр. 10:30 = 630),
-- во локално време на салонот (Europe/Skopje). Така нема проблеми со временски зони.

-- ---------- Табели ----------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name_mk text not null,
  name_en text not null default '',
  desc_mk text not null default '',
  desc_en text not null default '',
  duration_min int not null check (duration_min between 10 and 480),
  price_mkd int not null default 0 check (price_mkd >= 0),
  price_from boolean not null default false,   -- „од 800 ден.“
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.opening_hours (
  weekday int primary key check (weekday between 0 and 6),   -- 0 = недела, 1 = понеделник …
  is_open boolean not null default true,
  open_min int not null default 600 check (open_min between 0 and 1440),
  close_min int not null default 1080 check (close_min between 0 and 1440),
  check (close_min > open_min)
);

create table if not exists public.blocked_days (
  day date primary key,
  note text not null default ''
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services (id) on delete set null,
  service_name text not null,                 -- копија, за да остане и ако услугата се избрише
  day date not null,
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440),
  pet_name text not null,
  pet_breed text not null default '',
  pet_size text not null default 'medium' check (pet_size in ('small', 'medium', 'large')),
  owner_name text not null,
  phone text not null,
  email text not null default '',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'done', 'cancelled')),
  lang text not null default 'mk',
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);

create index if not exists bookings_day_idx on public.bookings (day, start_min);

-- ---------- Почетни податоци ----------

insert into public.opening_hours (weekday, is_open, open_min, close_min) values
  (1, true, 600, 1080), (2, true, 600, 1080), (3, true, 600, 1080),
  (4, true, 600, 1080), (5, true, 600, 1080), (6, true, 600, 900), (0, false, 600, 900)
on conflict (weekday) do nothing;

insert into public.services (name_mk, name_en, desc_mk, desc_en, duration_min, price_mkd, price_from, sort)
select * from (values
  ('Целосна нега', 'Full grooming', 'Капење, фенирање, шишање по желба, нокти, уши и заби.', 'Bath, blow-dry, haircut of your choice, nails, ears and teeth.', 120, 1500, true, 1),
  ('Капење и фенирање', 'Bath & blow-dry', 'Нежен шампон прилагоден на крзното и темелно фенирање.', 'A gentle shampoo for the coat type and a thorough blow-dry.', 60, 800, true, 2),
  ('Шишање и чешлање', 'Trim & brush-out', 'Потстрижување и расчешлување на заплеткано крзно.', 'Trimming and brushing out a tangled coat.', 90, 1200, true, 3),
  ('Скратување нокти', 'Nail trim', 'Брзо и безболно скратување на ноктите.', 'Quick, painless nail trim.', 20, 300, false, 4),
  ('Чистење уши', 'Ear cleaning', 'Внимателно чистење и проверка на ушите.', 'Gentle ear cleaning and check.', 20, 300, false, 5),
  ('Миење заби', 'Teeth cleaning', 'Миење заби за посвеж здив и здрави непца.', 'Teeth brushing for fresher breath and healthy gums.', 20, 300, false, 6)
) as v(name_mk, name_en, desc_mk, desc_en, duration_min, price_mkd, price_from, sort)
where not exists (select 1 from public.services);

-- ---------- Помошни функции ----------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Зафатени интервали за еден ден — јавно, но БЕЗ лични податоци.
create or replace function public.get_busy(p_day date)
returns table (start_min int, end_min int)
language sql stable security definer set search_path = public as $$
  select b.start_min, b.end_min from public.bookings b
  where b.day = p_day and b.status in ('pending', 'confirmed')
  order by b.start_min;
$$;

-- Нова резервација од сајтот. Сè се проверува на серверот:
-- активна услуга, работно време, неблокиран ден, не во минатото, без преклопување.
create or replace function public.create_booking(
  p_service_id uuid, p_day date, p_start_min int,
  p_pet_name text, p_pet_breed text, p_pet_size text,
  p_owner_name text, p_phone text, p_email text, p_note text, p_lang text default 'mk'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.services%rowtype;
  h public.opening_hours%rowtype;
  v_end int;
  v_now timestamp := (now() at time zone 'Europe/Skopje');
  v_id uuid;
begin
  select * into s from public.services where id = p_service_id and active;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;

  if p_day < v_now::date or p_day > v_now::date + 60 then raise exception 'DAY_OUT_OF_RANGE'; end if;
  if exists (select 1 from public.blocked_days where day = p_day) then raise exception 'DAY_CLOSED'; end if;

  select * into h from public.opening_hours where weekday = extract(dow from p_day)::int;
  if not found or not h.is_open then raise exception 'DAY_CLOSED'; end if;

  v_end := p_start_min + s.duration_min;
  if p_start_min < h.open_min or v_end > h.close_min then raise exception 'OUTSIDE_HOURS'; end if;
  if p_day = v_now::date and p_start_min < extract(hour from v_now)::int * 60 + extract(minute from v_now)::int + 60 then
    raise exception 'TOO_SOON';
  end if;

  if length(trim(coalesce(p_pet_name, ''))) = 0 or length(trim(coalesce(p_owner_name, ''))) = 0
     or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 8 then
    raise exception 'MISSING_FIELDS';
  end if;

  -- Едно кучe во исто време: заклучи го денот, па провери преклопување.
  perform pg_advisory_xact_lock(hashtext('moe-milenice-' || p_day::text));
  if exists (
    select 1 from public.bookings b
    where b.day = p_day and b.status in ('pending', 'confirmed')
      and b.start_min < v_end and b.end_min > p_start_min
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  insert into public.bookings (service_id, service_name, day, start_min, end_min, pet_name, pet_breed, pet_size,
                               owner_name, phone, email, note, lang)
  values (s.id, s.name_mk, p_day, p_start_min, v_end, left(trim(p_pet_name), 60), left(trim(coalesce(p_pet_breed, '')), 60),
          case when p_pet_size in ('small', 'medium', 'large') then p_pet_size else 'medium' end,
          left(trim(p_owner_name), 80), left(trim(p_phone), 30), left(trim(coalesce(p_email, '')), 120),
          left(trim(coalesce(p_note, '')), 500), case when p_lang = 'en' then 'en' else 'mk' end)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.get_busy(date) to anon, authenticated;
grant execute on function public.create_booking(uuid, date, int, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Безбедност (Row Level Security) ----------

-- Табелите се достапни преку API само колку што дозволуваат правилата подолу.
grant usage on schema public to anon, authenticated;
grant select on public.services, public.opening_hours, public.blocked_days to anon, authenticated;
grant select, insert, update, delete on public.services, public.opening_hours, public.blocked_days, public.bookings to authenticated;
grant select on public.admins to authenticated;

alter table public.admins enable row level security;
alter table public.services enable row level security;
alter table public.opening_hours enable row level security;
alter table public.blocked_days enable row level security;
alter table public.bookings enable row level security;

-- Јавно: читање на активни услуги, работно време и затворени денови.
drop policy if exists "public read services" on public.services;
create policy "public read services" on public.services for select using (active or public.is_admin());
drop policy if exists "public read hours" on public.opening_hours;
create policy "public read hours" on public.opening_hours for select using (true);
drop policy if exists "public read blocked" on public.blocked_days;
create policy "public read blocked" on public.blocked_days for select using (true);

-- Админ: сè. Резервациите НЕ се читливи за јавноста (само преку get_busy без лични податоци).
drop policy if exists "admin all services" on public.services;
create policy "admin all services" on public.services for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all hours" on public.opening_hours;
create policy "admin all hours" on public.opening_hours for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all blocked" on public.blocked_days;
create policy "admin all blocked" on public.blocked_days for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all bookings" on public.bookings;
create policy "admin all bookings" on public.bookings for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin read self" on public.admins;
create policy "admin read self" on public.admins for select using (user_id = auth.uid());

-- ---------- Нови резервации во живо во админ панелот ----------
do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when others then null; end $$;

-- ---------- Админ корисник ----------
-- 1) Supabase → Authentication → Users → Add user (е-пошта + лозинка на сопственикот).
-- 2) Пуштете (со вистинската е-пошта):
--    insert into public.admins (user_id) select id from auth.users where email = 'SOPSTVENIK@EMAIL.COM';
