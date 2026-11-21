// Data layer. Uses Supabase when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set,
// otherwise a DEMO store in localStorage (same API), so the site works before setup.
import { createClient } from '@supabase/supabase-js';

import { SUPABASE } from '../supabase.config';

const URL = SUPABASE.url;
const KEY = SUPABASE.anonKey;
// Demo mode exists only for local development (npm run dev without keys). A production build never uses it.
export const IS_DEMO = import.meta.env.DEV && (import.meta.env.VITE_DEMO === '1' || !(URL && KEY));
export const MISCONFIGURED = !IS_DEMO && !(URL && KEY);
if (KEY && /service_role/.test(atobSafe(KEY.split('.')[1]))) throw new Error('Never use the service_role key in the browser.');
function atobSafe(s) { try { return atob(s || ''); } catch { return ''; } }

export const logError = (e) => { if (import.meta.env.DEV) console.error(e); };

const sb = IS_DEMO || MISCONFIGURED ? null : createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

// Errors raised by the database (see supabase/schema.sql) → translation keys.
export function errorCode(err) {
  const m = String(err?.message || err || '');
  const known = ['SLOT_TAKEN', 'DAY_CLOSED', 'OUTSIDE_HOURS', 'TOO_SOON', 'DAY_OUT_OF_RANGE', 'SERVICE_UNAVAILABLE', 'MISSING_FIELDS', 'BAD_LOGIN', 'RATE_LIMIT', 'NOT_ADMIN'];
  return known.find((k) => m.includes(k)) || 'GENERIC';
}

const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/* ------------------------------ Supabase ------------------------------ */

let channelSeq = 0;

const live = {
  getServices: async ({ all = false } = {}) => {
    let q = sb.from('services').select('*').order('sort').order('created_at');
    if (!all) q = q.eq('active', true);
    return must(await q);
  },
  getHours: async () => must(await sb.from('opening_hours').select('*').order('weekday')),
  getBlocked: async () => must(await sb.from('blocked_days').select('*').order('day')),
  getBusy: async (day) => must(await sb.rpc('get_busy', { p_day: day })),
  createBooking: async (b) =>
    must(
      await sb.rpc('create_booking', {
        p_service_id: b.serviceId, p_day: b.day, p_start_min: b.startMin,
        p_pet_name: b.petName, p_pet_breed: b.petBreed, p_pet_size: b.petSize,
        p_owner_name: b.ownerName, p_phone: b.phone, p_email: b.email, p_note: b.note, p_lang: b.lang,
      })
    ),

  // admin
  // A session counts only if the database confirms the user is an admin.
  getSession: async () => {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) return null;
    const { data, error } = await sb.rpc('is_admin');
    if (error || !data) {
      await sb.auth.signOut();
      return null;
    }
    return session;
  },
  onAuthChange: (cb) => sb.auth.onAuthStateChange((_e, session) => cb(session)).data.subscription,
  signIn: async (email, password) => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('BAD_LOGIN');
    if (!must(await sb.rpc('is_admin'))) {
      await sb.auth.signOut();
      throw new Error('NOT_ADMIN');
    }
  },
  signOut: async () => sb.auth.signOut(),
  listBookings: async (from, to) =>
    must(await sb.from('bookings').select('*').gte('day', from).lte('day', to).order('day').order('start_min')),
  setStatus: async (id, status) => must(await sb.from('bookings').update({ status }).eq('id', id)),
  deleteBooking: async (id) => must(await sb.from('bookings').delete().eq('id', id)),
  saveService: async (s) => {
    const row = { ...s };
    if (!row.id) delete row.id;
    return must(await sb.from('services').upsert(row).select().single());
  },
  deleteService: async (id) => must(await sb.from('services').delete().eq('id', id)),
  saveHours: async (rows) => must(await sb.from('opening_hours').upsert(rows)),
  addBlocked: async (day, note) => must(await sb.from('blocked_days').upsert({ day, note })),
  removeBlocked: async (day) => must(await sb.from('blocked_days').delete().eq('day', day)),
  subscribe: (cb) => {
    // Each listener gets its own channel: Supabase refuses to add callbacks to a channel that is already subscribed.
    const ch = sb.channel(`bookings-live-${++channelSeq}`).on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, cb).subscribe();
    return () => sb.removeChannel(ch);
  },
};

/* -------------------------------- Demo -------------------------------- */

const DEMO_KEY = 'moe-milenice-demo-v1';
// Local development only: demo@moemilenice.mk with any password of 4+ characters.
export const DEMO_LOGIN = { email: 'demo@moemilenice.mk' };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

function seed() {
  const svc = (name_mk, name_en, desc_mk, desc_en, duration_min, price_mkd, price_from, sort) => ({
    id: uid(), name_mk, name_en, desc_mk, desc_en, duration_min, price_mkd, price_from, active: true, sort,
  });
  return {
    services: [
      svc('Целосна нега', 'Full grooming', 'Капење, фенирање, шишање по желба, нокти, уши и заби.', 'Bath, blow-dry, haircut of your choice, nails, ears and teeth.', 120, 1500, true, 1),
      svc('Капење и фенирање', 'Bath & blow-dry', 'Нежен шампон прилагоден на крзното и темелно фенирање.', 'A gentle shampoo for the coat type and a thorough blow-dry.', 60, 800, true, 2),
      svc('Шишање и чешлање', 'Trim & brush-out', 'Потстрижување и расчешлување на заплеткано крзно.', 'Trimming and brushing out a tangled coat.', 90, 1200, true, 3),
      svc('Скратување нокти', 'Nail trim', 'Брзо и безболно скратување на ноктите.', 'Quick, painless nail trim.', 20, 300, false, 4),
      svc('Чистење уши', 'Ear cleaning', 'Внимателно чистење и проверка на ушите.', 'Gentle ear cleaning and check.', 20, 300, false, 5),
      svc('Миење заби', 'Teeth cleaning', 'Миење заби за посвеж здив и здрави непца.', 'Teeth brushing for fresher breath and healthy gums.', 20, 300, false, 6),
    ],
    hours: [0, 1, 2, 3, 4, 5, 6].map((w) => ({
      weekday: w, is_open: w !== 0, open_min: 600, close_min: w === 6 ? 900 : 1080,
    })),
    blocked: [],
    bookings: [],
  };
}

const load = () => {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const s = seed();
  save(s);
  return s;
};
function save(s) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
const listeners = new Set();
const notify = (e) => listeners.forEach((cb) => cb(e || {}));
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));

const demo = {
  getServices: async ({ all = false } = {}) => delay(load().services.filter((s) => all || s.active).sort((a, b) => a.sort - b.sort)),
  getHours: async () => delay(load().hours),
  getBlocked: async () => delay(load().blocked),
  getBusy: async (day) => delay(load().bookings.filter((b) => b.day === day && ['pending', 'confirmed'].includes(b.status)).map(({ start_min, end_min }) => ({ start_min, end_min }))),
  createBooking: async (b) => {
    const s = load();
    const svc = s.services.find((x) => x.id === b.serviceId && x.active);
    if (!svc) throw new Error('SERVICE_UNAVAILABLE');
    const end = b.startMin + svc.duration_min;
    if (s.bookings.some((x) => x.day === b.day && ['pending', 'confirmed'].includes(x.status) && x.start_min < end && x.end_min > b.startMin)) throw new Error('SLOT_TAKEN');
    const row = {
      id: uid(), service_id: svc.id, service_name: svc.name_mk, day: b.day, start_min: b.startMin, end_min: end,
      pet_name: b.petName, pet_breed: b.petBreed, pet_size: b.petSize, owner_name: b.ownerName, phone: b.phone,
      email: b.email, note: b.note, status: 'pending', lang: b.lang, created_at: new Date().toISOString(),
    };
    s.bookings.push(row);
    save(s);
    notify({ eventType: 'INSERT', new: row });
    return delay(row.id);
  },
  getSession: async () => {
    try { return sessionStorage.getItem('moe-demo-session') ? { user: { email: DEMO_LOGIN.email } } : null; } catch { return null; }
  },
  onAuthChange: () => ({ unsubscribe() {} }),
  signIn: async (email, password) => {
    if (email.trim().toLowerCase() !== DEMO_LOGIN.email || String(password).length < 4) throw new Error('BAD_LOGIN');
    try { sessionStorage.setItem('moe-demo-session', '1'); } catch { /* ignore */ }
  },
  signOut: async () => { try { sessionStorage.removeItem('moe-demo-session'); } catch { /* ignore */ } },
  listBookings: async (from, to) => delay(load().bookings.filter((b) => b.day >= from && b.day <= to).sort((a, b) => a.day.localeCompare(b.day) || a.start_min - b.start_min)),
  setStatus: async (id, status) => { const s = load(); const b = s.bookings.find((x) => x.id === id); if (b) b.status = status; save(s); notify(); },
  deleteBooking: async (id) => { const s = load(); s.bookings = s.bookings.filter((x) => x.id !== id); save(s); notify(); },
  saveService: async (svc) => {
    const s = load();
    if (svc.id) s.services = s.services.map((x) => (x.id === svc.id ? { ...x, ...svc } : x));
    else s.services.push({ ...svc, id: uid() });
    save(s);
    return svc;
  },
  deleteService: async (id) => { const s = load(); s.services = s.services.filter((x) => x.id !== id); save(s); },
  saveHours: async (rows) => { const s = load(); s.hours = rows; save(s); },
  addBlocked: async (day, note) => { const s = load(); s.blocked = [...s.blocked.filter((x) => x.day !== day), { day, note }].sort((a, b) => a.day.localeCompare(b.day)); save(s); },
  removeBlocked: async (day) => { const s = load(); s.blocked = s.blocked.filter((x) => x.day !== day); save(s); },
  subscribe: (cb) => {
    listeners.add(cb);
    // Another tab changed the demo data: report new bookings as INSERT events.
    const onStorage = (e) => {
      if (e.key !== DEMO_KEY) return;
      try {
        const before = new Set((JSON.parse(e.oldValue || '{}').bookings || []).map((b) => b.id));
        const added = (JSON.parse(e.newValue || '{}').bookings || []).filter((b) => !before.has(b.id));
        if (added.length) added.forEach((b) => cb({ eventType: 'INSERT', new: b }));
        else cb({});
      } catch {
        cb({});
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
  },
};

// If the keys are missing in production, every call fails cleanly instead of crashing the page.
const broken = new Proxy({}, { get: (_t, k) => (k === 'onAuthChange' ? () => ({ unsubscribe() {} }) : k === 'subscribe' ? () => () => {} : async () => { throw new Error('NOT_CONFIGURED'); }) });
export const api = IS_DEMO ? demo : MISCONFIGURED ? broken : live;
