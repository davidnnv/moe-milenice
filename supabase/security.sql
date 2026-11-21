-- =====================================================================
-- Мое Милениче — безбедносни подобрувања (пуштете по schema.sql).
-- Безбедно е да се пушти повторно.
-- =====================================================================

-- ---------- 1. Ограничувања на должина и формат (и за админ внесувања) ----------
do $$ begin
  alter table public.bookings add constraint bookings_len check (
    char_length(pet_name) between 1 and 60 and char_length(pet_breed) <= 60
    and char_length(owner_name) between 1 and 80 and char_length(phone) between 6 and 30
    and char_length(email) <= 120 and char_length(note) <= 500 and char_length(service_name) <= 120
    and lang in ('mk', 'en'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.bookings add constraint bookings_email_fmt check (email = '' or email ~* '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.services add constraint services_len check (
    char_length(name_mk) between 1 and 80 and char_length(name_en) <= 80
    and char_length(desc_mk) <= 400 and char_length(desc_en) <= 400 and price_mkd <= 1000000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.blocked_days add constraint blocked_note_len check (char_length(note) <= 120);
exception when duplicate_object then null; end $$;

-- ---------- 2. Чистење на текст (контролни знаци, HTML загради) ----------
create or replace function public.clean_text(p text, p_max int)
returns text language sql immutable set search_path = public as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', '', 'g'), '[<>]', '', 'g')), p_max);
$$;

-- ---------- 3. Rate limiting за резервации ----------
-- Табела што не е достапна преку API (RLS вклучено, без правила, без grants).
create table if not exists public.booking_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  phone_digits text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists booking_attempts_ip_idx on public.booking_attempts (ip, created_at);
alter table public.booking_attempts enable row level security;
revoke all on public.booking_attempts from anon, authenticated;

create or replace function public.request_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), ''),
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    'unknown');
$$;

-- ---------- 4. create_booking со rate limit и чистење ----------
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
  v_ip text := public.request_ip();
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_pet text := public.clean_text(p_pet_name, 60);
  v_owner text := public.clean_text(p_owner_name, 80);
  v_email text := lower(public.clean_text(p_email, 120));
begin
  -- Rate limit: најмногу 5 резервации на час од една IP адреса,
  -- 3 активни идни резервации по телефон и 40 вкупно за 10 минути.
  if (select count(*) from public.booking_attempts where ip = v_ip and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.booking_attempts where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'RATE_LIMIT';
  end if;
  if length(v_digits) >= 8 and (
    select count(*) from public.bookings
    where regexp_replace(phone, '\D', '', 'g') = v_digits and status in ('pending', 'confirmed') and day >= v_now::date
  ) >= 3 then
    raise exception 'RATE_LIMIT';
  end if;

  select * into s from public.services where id = p_service_id and active;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;

  if p_day < v_now::date or p_day > v_now::date + 60 then raise exception 'DAY_OUT_OF_RANGE'; end if;
  if exists (select 1 from public.blocked_days where day = p_day) then raise exception 'DAY_CLOSED'; end if;

  select * into h from public.opening_hours where weekday = extract(dow from p_day)::int;
  if not found or not h.is_open then raise exception 'DAY_CLOSED'; end if;

  if p_start_min is null or p_start_min % 5 <> 0 then raise exception 'OUTSIDE_HOURS'; end if;
  v_end := p_start_min + s.duration_min;
  if p_start_min < h.open_min or v_end > h.close_min then raise exception 'OUTSIDE_HOURS'; end if;
  if p_day = v_now::date and p_start_min < extract(hour from v_now)::int * 60 + extract(minute from v_now)::int + 60 then
    raise exception 'TOO_SOON';
  end if;

  if v_pet = '' or v_owner = '' or length(v_digits) < 8 or length(v_digits) > 15 then
    raise exception 'MISSING_FIELDS';
  end if;
  if v_email <> '' and v_email !~* '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' then raise exception 'MISSING_FIELDS'; end if;

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
  values (s.id, s.name_mk, p_day, p_start_min, v_end, v_pet, public.clean_text(p_pet_breed, 60),
          case when p_pet_size in ('small', 'medium', 'large') then p_pet_size else 'medium' end,
          v_owner, public.clean_text(p_phone, 30), v_email, public.clean_text(p_note, 500),
          case when p_lang = 'en' then 'en' else 'mk' end)
  returning id into v_id;

  insert into public.booking_attempts (ip, phone_digits) values (v_ip, v_digits);
  delete from public.booking_attempts where created_at < now() - interval '2 days';
  return v_id;
end;
$$;

-- get_busy само за разумен опсег на денови
create or replace function public.get_busy(p_day date)
returns table (start_min int, end_min int)
language sql stable security definer set search_path = public as $$
  select b.start_min, b.end_min from public.bookings b
  where b.day = p_day and b.status in ('pending', 'confirmed')
    and p_day between (now() at time zone 'Europe/Skopje')::date - 1 and (now() at time zone 'Europe/Skopje')::date + 62
  order by b.start_min;
$$;

-- ---------- 5. Права: само тоа што е потребно ----------
-- Функциите во Postgres стандардно може да ги вика секој (PUBLIC) — го тргаме тоа.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_busy(date) to anon, authenticated;
grant execute on function public.create_booking(uuid, date, int, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Нови табели/функции во иднина да не се отвораат автоматски.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Јавноста гледа само табели со RLS; резервации и админи никогаш директно.
revoke all on public.bookings from anon;
revoke all on public.admins from anon;
revoke insert, update, delete on public.admins from authenticated;
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
