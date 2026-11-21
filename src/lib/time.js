// Dates are 'YYYY-MM-DD' strings in the salon's local time; times are minutes from midnight.

export const pad = (n) => String(n).padStart(2, '0');

export function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export const weekday = (s) => parseYmd(s).getDay(); // 0 = Sunday

export const fmtTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function nowLocal() {
  const d = new Date();
  return { day: ymd(d), min: d.getHours() * 60 + d.getMinutes() };
}

const LOCALE = { mk: 'mk-MK', en: 'en-GB' };

// Macedonian names are written out because not every browser ships the mk locale.
const MK_DAYS = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];
const MK_MONTHS = ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'];
const MK_MONTHS_SHORT = ['јан', 'фев', 'мар', 'апр', 'мај', 'јун', 'јул', 'авг', 'сеп', 'окт', 'ное', 'дек'];

export function fmtDay(s, lang) {
  const d = parseYmd(s);
  if (lang === 'en') return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${MK_DAYS[d.getDay()]}, ${d.getDate()} ${MK_MONTHS[d.getMonth()]}`;
}

export const fmtMonthShort = (d, lang) => (lang === 'en' ? d.toLocaleDateString('en-GB', { month: 'short' }) : MK_MONTHS_SHORT[d.getMonth()]);

export function fmtDate(s) {
  const d = parseYmd(s);
  return `${MK_DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MK_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtPrice(mkd, from, lang) {
  const n = new Intl.NumberFormat(LOCALE[lang] || 'mk-MK').format(mkd);
  const cur = lang === 'en' ? 'MKD' : 'ден.';
  return `${from ? (lang === 'en' ? 'from ' : 'од ') : ''}${n} ${cur}`;
}

export function fmtDuration(min, lang) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (lang === 'en') return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
  return [h && `${h} ч`, m && `${m} мин`].filter(Boolean).join(' ');
}
