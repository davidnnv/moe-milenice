import { BOOKING } from './config';
import { nowLocal, weekday } from './time';

/**
 * Free start times for one day.
 * hours: rows { weekday, is_open, open_min, close_min }
 * blocked: Set of 'YYYY-MM-DD'
 * busy: [{ start_min, end_min }] (pending + confirmed bookings)
 */
export function freeSlots({ day, hours, blocked, busy, duration, now = nowLocal() }) {
  if (!duration || blocked.has(day) || day < now.day) return [];
  const h = hours.find((r) => r.weekday === weekday(day));
  if (!h || !h.is_open) return [];

  const earliest = day === now.day ? now.min + BOOKING.leadMin : 0;
  const out = [];
  for (let t = h.open_min; t + duration <= h.close_min; t += BOOKING.slotStepMin) {
    if (t < earliest) continue;
    const end = t + duration;
    if (busy.some((b) => b.start_min < end && b.end_min > t)) continue;
    out.push(t);
  }
  return out;
}

/** Is the salon open on this day at all (ignoring existing bookings)? */
export function isOpenDay(day, hours, blocked) {
  if (blocked.has(day)) return false;
  const h = hours.find((r) => r.weekday === weekday(day));
  return Boolean(h && h.is_open);
}
