# Мое Милениче — веб апликација за закажување

React (Vite) сајт за груминг салонот „Мое Милениче“, Скопје, со онлајн резервации и админ панел.
Базата и најавата се на **Supabase**.

- `/` — сајт: услуги, како функционира, галерија, оцена од Google, контакт и мапа (МК/EN)
- `/zakazi` — закажување во 4 чекори; се гледаат само слободни термини
- `/admin` — админ панел: термини (по ден / претстојни, статуси, повик/Viber, ажурирање во живо), услуги (цени, времетраење, скриј/прикажи), работно време и неработни денови

Без Supabase клучеви апликацијата работи во **демо режим** (податоците се во прелистувачот).
Демо најава: `demo@moemilenice.mk` / `demo1234`.

## Локално

```bash
npm install
npm run dev
```

## Поврзување со Supabase

1. На [supabase.com](https://supabase.com) → **New project** (регион: Central EU / Frankfurt).
2. **SQL Editor** → залепете ја целата содржина на `supabase/schema.sql` → **Run**, потоа истото за `supabase/security.sql`.
3. **Authentication → Users → Add user** → е-пошта и лозинка за салонот (штиклирајте *Auto Confirm User*).
4. Во **SQL Editor** извршете (со вистинската е-пошта):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'salon@primer.mk';
   ```
5. **Authentication → Sign In / Providers → Email**: исклучете *Allow new users to sign up*.
6. **Project Settings → API**: копирајте *Project URL* и *anon public* клуч во `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

Безбедност: посетителите може само да прават резервации (преку функцијата `create_booking`) и да ги гледаат зафатените термини без лични податоци. Само корисници во табелата `admins` ги гледаат и менуваат резервациите. Базата сама проверува преклопување, работно време и неработни денови.

## Безбедност

| Што | Како е решено |
|---|---|
| Лозинки | Supabase Auth ги чува со bcrypt hash; мин. 10 знаци со мали/големи букви, бројки и симболи; потребна е тековна лозинка за промена |
| Админ рути | `/admin` бара најава **и** проверка `is_admin()` во базата; автоматска одјава по 30 мин неактивност; заклучување по 5 погрешни обиди; `noindex` |
| Сопствени податоци | RLS: јавноста не може да чита/менува резервации, админи ни помошни табели — само преку `create_booking` / `get_busy` (без лични податоци) |
| Регистрации | Исклучени; magic link / OTP најава исклучена |
| Rate limiting | Во базата: 5 резервации/час по IP, 3 активни по телефон, 40 вкупно за 10 мин; Supabase Auth ограничува најави |
| XSS / форми | React ескејпира сè; без `innerHTML`; базата ги чисти `< >` и контролни знаци, проверува формат и должина; honeypot поле против ботови |
| API клучеви | Само преку env (`VITE_SUPABASE_*`); anon клучот е јавен по дизајн, `service_role` никогаш (апликацијата одбива да стартува со него) |
| Debug | Продукциски build: без демо режим, без source maps, без console логови од апликацијата |
| Безбедносни headers | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (`render.yaml`, `security-headers.js`) |
| Изложени фајлови | Се објавува само `dist/` — нема `.env`, изворен код, `.git` или SQL |
| CORS | Supabase REST е отворен за прелистувачи по дизајн; заштитата е во RLS и функциите, не во CORS |
| Пакети | `npm audit` = 0 ранливости; најнови верзии (Vite 8, React 19) |
| Тајни во git | `npm run scan:secrets` пред commit; `.env*` е во `.gitignore` |

## Објавување на Render

**New → Static Site** → репозиториумот, па:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Redirects/Rewrites**: Source `/*` → Destination `/index.html` → Action **Rewrite** (за `/zakazi` и `/admin`)

## Што се менува каде

- Телефон, адреса, линкови, оцена од Google: `src/lib/config.js` (`BUSINESS`)
- Фотографии: `public/photos/` + листата `GALLERY` во `src/lib/config.js`
- Правила за термини (на колку минути, колку однапред): `BOOKING` во `config.js` и истите вредности во `create_booking` во `schema.sql`
- Текстови: `src/i18n.js`
- Услуги, цени и работно време: од админ панелот

---
Изработка: [IOMYS](https://iomys.onrender.com)
