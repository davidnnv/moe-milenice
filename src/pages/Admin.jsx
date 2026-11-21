// Salon admin panel (Macedonian only — it is used by the salon staff).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, logError } from '../lib/api';
import { addDays, fmtDate, fmtDay, fmtDuration, fmtPrice, fmtTime, nowLocal, toMin } from '../lib/time';
import { Brand } from '../components/Brand';
import { ThemeToggle } from '../theme';
import Dialogs, { askConfirm, notify } from '../components/Dialogs';
import { describe, notifySupported, useBookingAlerts } from '../lib/bookingAlerts';
import InstallCard from '../components/InstallCard';

const DAYS = ['Недела', 'Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота'];
const STATUS = {
  pending: { label: 'Чека потврда', cls: 'st--pending' },
  confirmed: { label: 'Потврдено', cls: 'st--confirmed' },
  done: { label: 'Завршено', cls: 'st--done' },
  cancelled: { label: 'Откажано', cls: 'st--cancelled' },
};
const SIZES = { small: 'мало', medium: 'средно', large: 'големо' };
const telHref = (p) => {
  const d = p.replace(/\D/g, '');
  return `tel:${d.startsWith('0') ? '+389' + d.slice(1) : d.startsWith('389') ? '+' + d : d}`;
};
const viberHref = (p) => telHref(p).replace('tel:', 'viber://chat?number=').replace('+', '%2B');

const IDLE_MS = 30 * 60 * 1000; // automatic logout after 30 minutes without activity
const LOCK_KEY = 'moe-admin-lock';

export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [idleOut, setIdleOut] = useState(false);

  // Log out after inactivity, so an open laptop in the salon doesn't stay logged in.
  useEffect(() => {
    if (!session) return undefined;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await api.signOut();
        setSession(null);
        setIdleOut(true);
      }, IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session]);

  useEffect(() => {
    document.title = 'Админ · Мое Милениче';
    // Keep the admin page out of search engines.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    api.getSession().then(setSession).catch(() => setSession(null));
    const sub = api.onAuthChange((s) => setSession(s));
    return () => {
      sub?.unsubscribe?.();
      meta.remove();
    };
  }, []);

  if (session === undefined) return <div className="admin-loading">…</div>;
  if (!session) return <Login idleOut={idleOut} onDone={() => api.getSession().then(setSession).catch(() => setSession(null))} />;
  return (
    <Panel
      email={session.user?.email}
      onSignOut={async () => {
        await api.signOut();
        setSession(null);
      }}
    />
  );
}

/* ------------------------------- Login ------------------------------- */

const readLock = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY)) || { fails: 0, until: 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
};
const writeLock = (v) => {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

function Login({ onDone, idleOut }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(idleOut ? 'Бевте одјавени поради неактивност. Најавете се повторно.' : '');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lock = readLock();
  const lockedFor = Math.max(0, Math.ceil((lock.until - now) / 1000));

  useEffect(() => {
    if (!lockedFor) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedFor]);

  const submit = async (e) => {
    e.preventDefault();
    if (lockedFor || busy) return;
    setBusy(true);
    setErr('');
    try {
      await api.signIn(email.trim().toLowerCase(), password);
      writeLock({ fails: 0, until: 0 });
      setPassword('');
      onDone();
    } catch (e2) {
      const m = String(e2.message);
      // After 5 wrong attempts: wait 1 minute, then 2, 4… (Supabase also limits logins on the server).
      const fails = readLock().fails + 1;
      const until = fails >= 5 ? Date.now() + 60000 * 2 ** Math.min(fails - 5, 4) : 0;
      writeLock({ fails, until });
      setNow(Date.now());
      setPassword('');
      setErr(m.includes('NOT_ADMIN') ? 'Оваа сметка нема пристап до админ панелот.' : m.includes('NOT_CONFIGURED') ? 'Апликацијата не е поврзана со базата.' : 'Погрешна е-пошта или лозинка.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit}>
        <Link to="/" className="login__brand">
          <Brand />
        </Link>
        <h1>Админ најава</h1>
        <p className="muted login__sub">Најавете се за да ги видите резервациите.</p>
        <label className="field">
          <span className="field__label">Е-пошта</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={120} required />
        </label>
        <label className="field">
          <span className="field__label">Лозинка</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={128} required />
        </label>
        {err && (
          <p className="alert" role="alert">
            {err}
          </p>
        )}
        {lockedFor > 0 && (
          <p className="alert" role="alert">
            Премногу обиди. Обидете се повторно за {lockedFor} с.
          </p>
        )}
        <button className="btn btn--primary btn--lg" disabled={busy || lockedFor > 0}>
          {busy ? 'Се најавува…' : 'Најави се'}
        </button>
        <Link to="/" className="login__back">
          ← Назад кон сајтот
        </Link>
      </form>
    </main>
  );
}

/* ------------------------------- Panel ------------------------------- */

const PROMPT_KEY = 'moe-admin-notify-prompt';

function Panel({ email, onSignOut }) {
  const [tab, setTab] = useState('bookings');
  const [alerts, setAlerts] = useState([]); // new bookings shown at the top until dismissed
  const [jump, setJump] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [hidePrompt, setHidePrompt] = useState(() => {
    try {
      return localStorage.getItem(PROMPT_KEY) === 'hide';
    } catch {
      return false;
    }
  });
  const { permission, askPermission, sound, setSound } = useBookingAlerts((b) => setAlerts((a) => [{ ...b, key: b.id || Date.now() }, ...a].slice(0, 3)));
  const showPrompt = !hidePrompt && permission === 'default';
  const dismissPrompt = () => {
    setHidePrompt(true);
    try {
      localStorage.setItem(PROMPT_KEY, 'hide');
    } catch {
      /* ignore */
    }
  };
  const openBooking = (b) => {
    setTab('bookings');
    setJump({ id: b.id, t: Date.now() });
    setAlerts((a) => a.filter((x) => x.key !== b.key));
    setTimeout(() => document.getElementById(`b-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
  };
  const tabs = [
    ['bookings', 'Термини'],
    ['services', 'Услуги'],
    ['hours', 'Работно време'],
  ];
  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__bar-inner">
          <Link to="/" className="admin__brand" title="Кон сајтот">
            <Brand small />
          </Link>
          <nav className="admin__tabs" aria-label="Админ">
            {tabs.map(([k, l]) => (
              <button key={k} type="button" className={tab === k ? 'is-on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </nav>
          <div className="admin__user">
            <span className="admin__email">{email}</span>
            <div className="bell-wrap">
              <button
                type="button"
                className={`bell-btn${permission === 'granted' ? ' is-on' : ''}`}
                aria-label="Известувања"
                aria-expanded={bellOpen}
                onClick={() => setBellOpen((v) => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {permission !== 'granted' && <span className="bell-dot" aria-hidden="true" />}
              </button>
              {bellOpen && (
                <div className="bell-pop" role="dialog" aria-label="Известувања">
                  <h3>Известувања за нови резервации</h3>
                  <div className="bell-row">
                    <span>
                      <strong>Известување на уредот</strong>
                      <small>
                        {permission === 'granted'
                          ? 'Вклучено ✓'
                          : permission === 'denied'
                            ? 'Блокирано во прелистувачот — дозволете го преку иконата 🔒 до адресата.'
                            : permission === 'unsupported'
                              ? 'На iPhone: Сподели → „Add to Home Screen“, па отворете го админот од таму.'
                              : 'Исклучено'}
                      </small>
                    </span>
                    {permission === 'default' && (
                      <button type="button" className="btn btn--small btn--primary" onClick={askPermission}>
                        Вклучи
                      </button>
                    )}
                  </div>
                  <label className="bell-row check">
                    <span>
                      <strong>Звук</strong>
                      <small>Кратко ѕвонче за секоја нова резервација</small>
                    </span>
                    <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
                  </label>
                  <div className="bell-row">
                    <span>
                      <strong>Апликација на телефон</strong>
                      <small>Инсталирајте ја за известувања и на iPhone</small>
                    </span>
                    <InstallCard variant="button" />
                  </div>
                  <p className="bell-note">Известувањата стигнуваат додека админ панелот е отворен — може и во друго јазиче или минимизиран прелистувач.</p>
                </div>
              )}
            </div>
            <ThemeToggle label={{ light: 'Темен режим', dark: 'Светол режим' }} />
            <button type="button" className="btn btn--small btn--ghost" onClick={onSignOut}>
              Одјава
            </button>
          </div>
        </div>
      </header>
      {showPrompt && notifySupported() && (
        <div className="notify-prompt" role="region" aria-label="Известувања">
          <span className="notify-prompt__icon" aria-hidden="true">🔔</span>
          <p>
            <strong>Вклучете известувања</strong> за да знаете веднаш кога ќе стигне нова резервација.
          </p>
          <div className="notify-prompt__actions">
            <button type="button" className="btn btn--small btn--primary" onClick={async () => { await askPermission(); dismissPrompt(); }}>
              Вклучи
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={dismissPrompt}>
              Не сега
            </button>
          </div>
        </div>
      )}
      {alerts.length > 0 && (
        <div className="new-alerts" aria-live="assertive">
          {alerts.map((b) => (
            <div key={b.key} className="new-alert" role="alert">
              <span className="new-alert__icon" aria-hidden="true">🐾</span>
              <div className="new-alert__text">
                <strong>Нова резервација</strong>
                <span>{describe(b)}</span>
                {b.owner_name && (
                  <span className="muted">
                    {b.owner_name} · {b.phone}
                  </span>
                )}
              </div>
              <div className="new-alert__actions">
                <button type="button" className="btn btn--small btn--primary" onClick={() => openBooking(b)}>
                  Види
                </button>
                <button type="button" className="new-alert__close" aria-label="Затвори" onClick={() => setAlerts((a) => a.filter((x) => x.key !== b.key))}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <main className="admin__main">
        {tab === 'bookings' && <Bookings jump={jump} />}
        {tab === 'services' && <Services />}
        {tab === 'hours' && <Hours />}
      </main>
      <Dialogs />
    </div>
  );
}

/* ------------------------------ Bookings ----------------------------- */

function Bookings({ jump }) {
  const today = nowLocal().day;
  const [view, setView] = useState('day'); // day | upcoming
  const [day, setDay] = useState(today);
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('active');
  const [open, setOpen] = useState(null);

  const range = view === 'day' ? [day, day] : [today, addDays(today, 60)];

  const load = useCallback(() => {
    api.listBookings(range[0], range[1]).then(setRows).catch((e) => {
      logError(e);
      setRows([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range[0], range[1]]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  // Live updates: reload when any booking changes.
  useEffect(() => {
    const off = api.subscribe(() => load());
    return off;
  }, [load]);

  // "Види" on a new-booking alert: show upcoming bookings with that one opened.
  useEffect(() => {
    if (!jump) return;
    setView('upcoming');
    setFilter('active');
    setOpen(jump.id);
  }, [jump]);

  // Pending count for the next 60 days (badge).
  const [pendingAll, setPendingAll] = useState(0);
  useEffect(() => {
    api.listBookings(today, addDays(today, 60)).then((r) => setPendingAll(r.filter((b) => b.status === 'pending').length)).catch(() => {});
  }, [rows, today]);

  const shown = useMemo(() => {
    if (!rows) return null;
    if (filter === 'active') return rows.filter((b) => b.status !== 'cancelled');
    if (filter === 'all') return rows;
    return rows.filter((b) => b.status === filter);
  }, [rows, filter]);

  const update = async (id, status) => {
    setRows((r) => r.map((b) => (b.id === id ? { ...b, status } : b)));
    try {
      await api.setStatus(id, status);
    } catch (e) {
      alertFail(e);
      load();
    }
  };
  const remove = async (id) => {
    const b = rows?.find((x) => x.id === id);
    const ok = await askConfirm({
      title: 'Да се избрише резервацијата?',
      text: b ? `${b.pet_name} · ${b.service_name} · ${fmtDay(b.day, 'mk')}, ${fmtTime(b.start_min)}. Ова не може да се врати.` : 'Ова не може да се врати.',
    });
    if (!ok) return;
    try {
      await api.deleteBooking(id);
      setOpen(null);
      load();
      notify('Резервацијата е избришана.', 'ok');
    } catch (e) {
      alertFail(e);
    }
  };

  const groups = useMemo(() => {
    if (!shown) return [];
    const m = new Map();
    shown.forEach((b) => m.set(b.day, [...(m.get(b.day) || []), b]));
    return [...m.entries()];
  }, [shown]);

  const counts = rows ? { total: rows.filter((b) => b.status !== 'cancelled').length, pending: rows.filter((b) => b.status === 'pending').length } : null;

  return (
    <section>
      <div className="admin__head">
        <h1>Термини</h1>
        <div className="seg seg--small" role="tablist">
          <button type="button" className={view === 'day' ? 'is-on' : ''} onClick={() => setView('day')}>
            По ден
          </button>
          <button type="button" className={view === 'upcoming' ? 'is-on' : ''} onClick={() => setView('upcoming')}>
            Претстојни {pendingAll > 0 && <span className="badge">{pendingAll}</span>}
          </button>
        </div>
      </div>


      <div className="admin__tools">
        {view === 'day' && (
          <div className="daynav">
            <button type="button" className="icon-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Претходен ден">
              ‹
            </button>
            <label className="daynav__date">
              <span>{fmtDay(day, 'mk')}</span>
              <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Избери датум" />
            </label>
            <button type="button" className="icon-btn" onClick={() => setDay(addDays(day, 1))} aria-label="Следен ден">
              ›
            </button>
            {day !== today && (
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setDay(today)}>
                Денес
              </button>
            )}
          </div>
        )}
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Филтер">
          <option value="active">Без откажани</option>
          <option value="pending">Чекаат потврда</option>
          <option value="confirmed">Потврдени</option>
          <option value="done">Завршени</option>
          <option value="cancelled">Откажани</option>
          <option value="all">Сите</option>
        </select>
      </div>

      {counts && (
        <p className="muted admin__summary">
          {counts.total} {counts.total === 1 ? 'термин' : 'термини'}
          {counts.pending > 0 && ` · ${counts.pending} чекаат потврда`}
        </p>
      )}

      {shown === null ? (
        <p className="muted">Се вчитува…</p>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>Нема термини{view === 'day' ? ' за овој ден' : ''}.</p>
        </div>
      ) : (
        groups.map(([d, list]) => (
          <div key={d} className="bgroup">
            {view === 'upcoming' && <h2 className="bgroup__day">{d === today ? 'Денес' : fmtDay(d, 'mk')}</h2>}
            <ul className="blist">
              {list.map((b) => (
                <li key={b.id} className={`bcard ${STATUS[b.status].cls}${jump?.id === b.id ? ' is-new' : ''}`} id={`b-${b.id}`}>
                  <button type="button" className="bcard__main" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}>
                    <span className="bcard__time">
                      {fmtTime(b.start_min)}
                      <small>{fmtTime(b.end_min)}</small>
                    </span>
                    <span className="bcard__info">
                      <strong>
                        {b.pet_name}
                        {b.pet_breed && <span className="muted"> · {b.pet_breed}</span>}
                      </strong>
                      <span>{b.service_name}</span>
                      <span className="muted">
                        {b.owner_name} · {b.phone}
                      </span>
                    </span>
                    <span className={`st ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
                  </button>
                  {open === b.id && (
                    <div className="bcard__more">
                      <dl>
                        <div>
                          <dt>Големина</dt>
                          <dd>{SIZES[b.pet_size] || b.pet_size}</dd>
                        </div>
                        {b.email && (
                          <div>
                            <dt>Е-пошта</dt>
                            <dd>
                              <a href={`mailto:${b.email}`}>{b.email}</a>
                            </dd>
                          </div>
                        )}
                        {b.note && (
                          <div>
                            <dt>Забелешка</dt>
                            <dd>{b.note}</dd>
                          </div>
                        )}
                        <div>
                          <dt>Закажано</dt>
                          <dd>{b.created_at ? new Date(b.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</dd>
                        </div>
                      </dl>
                      <div className="bcard__actions">
                        <a className="btn btn--small" href={telHref(b.phone)}>
                          Повикај
                        </a>
                        <a className="btn btn--small btn--ghost" href={viberHref(b.phone)}>
                          Viber
                        </a>
                        {b.status !== 'confirmed' && b.status !== 'done' && (
                          <button type="button" className="btn btn--small btn--primary" onClick={() => update(b.id, 'confirmed')}>
                            Потврди
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button type="button" className="btn btn--small btn--primary" onClick={() => update(b.id, 'done')}>
                            Завршено
                          </button>
                        )}
                        {b.status !== 'cancelled' ? (
                          <button type="button" className="btn btn--small btn--ghost" onClick={() => update(b.id, 'cancelled')}>
                            Откажи
                          </button>
                        ) : (
                          <button type="button" className="btn btn--small btn--ghost" onClick={() => update(b.id, 'pending')}>
                            Врати
                          </button>
                        )}
                        <button type="button" className="btn btn--small btn--danger" onClick={() => remove(b.id)}>
                          Избриши
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

/* ------------------------------ Services ----------------------------- */

const NEW_SVC = { name_mk: '', name_en: '', desc_mk: '', desc_en: '', duration_min: 60, price_mkd: 1000, price_from: true, active: true, sort: 99 };

function Services() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.getServices({ all: true }).then(setList);
  useEffect(() => {
    load();
  }, []);

  const save = async (s) => {
    if (!s.name_mk.trim()) return notify('Внесете име на услугата.');
    try {
      await api.saveService({ ...s, duration_min: Number(s.duration_min), price_mkd: Number(s.price_mkd), sort: Number(s.sort) });
      setEdit(null);
      load();
    } catch (e) {
      alertFail(e);
    }
  };
  const del = async (s) => {
    const ok = await askConfirm({ title: `Да се избрише „${s.name_mk}“?`, text: 'Постоечките резервации за оваа услуга остануваат. Ако само привремено не ја нудите, подобро користете „Скриј“.' });
    if (!ok) return;
    try {
      await api.deleteService(s.id);
      load();
    } catch (e) {
      alertFail(e);
    }
  };
  const toggle = async (s) => {
    try {
      await api.saveService({ ...s, active: !s.active });
      load();
    } catch (e) {
      alertFail(e);
    }
  };

  return (
    <section>
      <div className="admin__head">
        <h1>Услуги</h1>
        <button type="button" className="btn btn--primary btn--small" onClick={() => setEdit({ ...NEW_SVC, sort: (list?.length || 0) + 1 })}>
          + Нова услуга
        </button>
      </div>
      <p className="muted">Времетраењето одредува колку долг термин се резервира. Скриените услуги не се гледаат на сајтот.</p>
      {edit && !edit.id && <ServiceForm value={edit} onSave={save} onCancel={() => setEdit(null)} />}
      {list === null ? (
        <p className="muted">Се вчитува…</p>
      ) : (
        <ul className="slist">
          {list.map((s) =>
            edit?.id === s.id ? (
              <li key={s.id}>
                <ServiceForm value={edit} onSave={save} onCancel={() => setEdit(null)} />
              </li>
            ) : (
              <li key={s.id} className={`srow${s.active ? '' : ' is-off'}`}>
                <div className="srow__info">
                  <strong>{s.name_mk}</strong>
                  <span className="muted">
                    {fmtDuration(s.duration_min, 'mk')} · {fmtPrice(s.price_mkd, s.price_from, 'mk')}
                    {!s.active && ' · скриена'}
                  </span>
                </div>
                <div className="srow__actions">
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => toggle(s)}>
                    {s.active ? 'Скриј' : 'Прикажи'}
                  </button>
                  <button type="button" className="btn btn--small" onClick={() => setEdit(s)}>
                    Уреди
                  </button>
                  <button type="button" className="btn btn--small btn--danger" onClick={() => del(s)}>
                    Избриши
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}

function ServiceForm({ value, onSave, onCancel }) {
  const [s, setS] = useState(value);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <form
      className="sform"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(s);
      }}
    >
      <div className="sform__grid">
        <label className="field">
          <span className="field__label">Име (МК)</span>
          <input value={s.name_mk} onChange={set('name_mk')} maxLength={80} required />
        </label>
        <label className="field">
          <span className="field__label">Име (EN)</span>
          <input value={s.name_en || ''} onChange={set('name_en')} maxLength={80} />
        </label>
        <label className="field sform__wide">
          <span className="field__label">Опис (МК)</span>
          <textarea rows="2" value={s.desc_mk || ''} onChange={set('desc_mk')} maxLength={400} />
        </label>
        <label className="field sform__wide">
          <span className="field__label">Опис (EN)</span>
          <textarea rows="2" value={s.desc_en || ''} onChange={set('desc_en')} maxLength={400} />
        </label>
        <label className="field">
          <span className="field__label">Времетраење (мин)</span>
          <input type="number" min="10" max="480" step="5" value={s.duration_min} onChange={set('duration_min')} required />
        </label>
        <label className="field">
          <span className="field__label">Цена (ден.)</span>
          <input type="number" min="0" max="1000000" step="50" value={s.price_mkd} onChange={set('price_mkd')} required />
        </label>
        <label className="field">
          <span className="field__label">Редослед</span>
          <input type="number" min="0" value={s.sort} onChange={set('sort')} />
        </label>
        <div className="sform__checks">
          <label className="check">
            <input type="checkbox" checked={s.price_from} onChange={set('price_from')} /> Цената е „од“
          </label>
          <label className="check">
            <input type="checkbox" checked={s.active} onChange={set('active')} /> Видлива на сајтот
          </label>
        </div>
      </div>
      <div className="sform__actions">
        <button type="button" className="btn btn--small btn--ghost" onClick={onCancel}>
          Откажи
        </button>
        <button className="btn btn--small btn--primary">Зачувај</button>
      </div>
    </form>
  );
}

/* ------------------------------- Hours ------------------------------- */

function Hours() {
  const [rows, setRows] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [saved, setSaved] = useState(false);
  const [newDay, setNewDay] = useState('');
  const [newNote, setNewNote] = useState('');

  const loadBlocked = () => api.getBlocked().then(setBlocked);
  useEffect(() => {
    api.getHours().then((h) => setRows([0, 1, 2, 3, 4, 5, 6].map((w) => h.find((r) => r.weekday === w) || { weekday: w, is_open: false, open_min: 600, close_min: 1080 })));
    loadBlocked();
  }, []);

  const setRow = (w, patch) => {
    setSaved(false);
    setRows((r) => r.map((x) => (x.weekday === w ? { ...x, ...patch } : x)));
  };
  const save = async () => {
    if (rows.some((r) => r.is_open && r.close_min <= r.open_min)) return notify('Затварањето мора да е после отварањето.');
    try {
      await api.saveHours(rows);
      setSaved(true);
    } catch (e) {
      alertFail(e);
    }
  };
  const addBlock = async (e) => {
    e.preventDefault();
    if (!newDay) return;
    try {
      await api.addBlocked(newDay, newNote.trim());
      setNewDay('');
      setNewNote('');
      loadBlocked();
    } catch (e2) {
      alertFail(e2);
    }
  };
  const today = nowLocal().day;

  return (
    <section>
      <div className="admin__head">
        <h1>Работно време</h1>
      </div>
      {rows === null ? (
        <p className="muted">Се вчитува…</p>
      ) : (
        <div className="hours-edit">
          {[1, 2, 3, 4, 5, 6, 0].map((w) => {
            const r = rows.find((x) => x.weekday === w);
            return (
              <div key={w} className={`hrow${r.is_open ? '' : ' is-off'}`}>
                <label className="check hrow__day">
                  <input type="checkbox" checked={r.is_open} onChange={(e) => setRow(w, { is_open: e.target.checked })} />
                  {DAYS[w]}
                </label>
                {r.is_open ? (
                  <span className="hrow__times">
                    <input type="time" step="1800" value={fmtTime(r.open_min)} onChange={(e) => e.target.value && setRow(w, { open_min: toMin(e.target.value) })} aria-label={`${DAYS[w]} од`} />
                    <span>–</span>
                    <input type="time" step="1800" value={fmtTime(r.close_min)} onChange={(e) => e.target.value && setRow(w, { close_min: toMin(e.target.value) })} aria-label={`${DAYS[w]} до`} />
                  </span>
                ) : (
                  <span className="muted">Затворено</span>
                )}
              </div>
            );
          })}
          <div className="hours-edit__save">
            <button type="button" className="btn btn--primary" onClick={save}>
              Зачувај работно време
            </button>
            {saved && <span className="ok">✓ Зачувано</span>}
          </div>
        </div>
      )}

      <div className="admin__head admin__head--sub">
        <h2>Неработни денови</h2>
      </div>
      <p className="muted">Празници, одмор или боледување — тие денови не може да се закажува.</p>
      <form className="block-form" onSubmit={addBlock}>
        <input type="date" min={today} value={newDay} onChange={(e) => setNewDay(e.target.value)} required aria-label="Датум" />
        <input placeholder="Причина (не мора)" value={newNote} onChange={(e) => setNewNote(e.target.value)} aria-label="Причина" maxLength={120} />
        <button className="btn btn--small btn--primary">Додај</button>
      </form>
      <ul className="blocked">
        {blocked.filter((b) => b.day >= today).length === 0 && <li className="muted">Нема внесени неработни денови.</li>}
        {blocked
          .filter((b) => b.day >= today)
          .map((b) => (
            <li key={b.day}>
              <span>
                <strong>{fmtDate(b.day)}</strong>
                {b.note && <span className="muted"> · {b.note}</span>}
              </span>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={async () => {
                  const ok = await askConfirm({ title: 'Да се отстрани неработниот ден?', text: `${fmtDate(b.day)} повторно ќе биде достапен за закажување.`, confirm: 'Отстрани', danger: false });
                  if (!ok) return;
                  try {
                    await api.removeBlocked(b.day);
                    loadBlocked();
                  } catch (e) {
                    alertFail(e);
                  }
                }}
              >
                Отстрани
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}

function alertFail(e) {
  logError(e);
  notify('Не успеа. Проверете ја интернет врската и обидете се повторно.');
}
