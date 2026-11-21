// Alerts for the salon when a new booking arrives while the admin panel is open
// (in any tab of the panel, also in a background browser tab or the installed app on the phone).
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { fmtDay, fmtTime } from './time';

const SOUND_KEY = 'moe-admin-sound';
const BASE_TITLE = 'Админ · Мое Милениче';

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Short two-tone chime made with WebAudio (no sound file needed). */
let audioCtx = null;
export function unlockSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* no audio */
  }
}
function chime() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  [[880, 0], [1320, 0.16]].forEach(([f, t]) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.45);
    o.connect(g).connect(audioCtx.destination);
    o.start(now + t);
    o.stop(now + t + 0.5);
  });
}

async function systemNotification(title, body, tag) {
  if (!notifySupported() || Notification.permission !== 'granted') return;
  const opts = { body, tag, renotify: true, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: '/admin' } };
  try {
    // Phones (Android, installed iPhone app) only allow notifications through the service worker.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, opts);
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* notifications blocked */
  }
}

export function describe(b) {
  if (!b) return '';
  const when = b.day ? `${fmtDay(b.day, 'mk')}, ${fmtTime(b.start_min)}` : '';
  return [b.pet_name && `${b.pet_name}${b.pet_breed ? ` (${b.pet_breed})` : ''}`, b.service_name, when].filter(Boolean).join(' · ');
}

/**
 * Listens for new bookings. Returns { unseen, clearUnseen, sound, setSound, permission, askPermission }.
 * onNew(booking) is called for every new booking (used for the in-app message).
 */
export function useBookingAlerts(onNew) {
  const [unseen, setUnseen] = useState(0);
  const [permission, setPermission] = useState(notifySupported() ? Notification.permission : 'unsupported');
  const [sound, setSoundState] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const soundRef = useRef(sound);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  soundRef.current = sound;

  // Unlock the sound on the first tap (browsers block audio until the user interacts).
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const off = api.subscribe((e) => {
      if (e?.eventType !== 'INSERT') return;
      const b = e.new || {};
      if (soundRef.current) chime();
      if (document.hidden) setUnseen((n) => n + 1);
      systemNotification('🐾 Нова резервација', describe(b) + (b.owner_name ? `\n${b.owner_name} · ${b.phone}` : ''), `booking-${b.id || Date.now()}`);
      onNewRef.current?.(b);
    });
    return off;
  }, []);

  // "(2) Админ" in the browser tab while there are unseen bookings.
  useEffect(() => {
    document.title = unseen ? `(${unseen}) ${BASE_TITLE}` : BASE_TITLE;
    const clear = () => !document.hidden && setUnseen(0);
    document.addEventListener('visibilitychange', clear);
    window.addEventListener('focus', clear);
    return () => {
      document.removeEventListener('visibilitychange', clear);
      window.removeEventListener('focus', clear);
    };
  }, [unseen]);

  const setSound = (on) => {
    setSoundState(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (on) {
      unlockSound();
      chime();
    }
  };

  const askPermission = async () => {
    if (!notifySupported()) return 'unsupported';
    unlockSound();
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === 'granted') systemNotification('Известувањата се вклучени', 'Ќе ве известиме за секоја нова резервација.', 'welcome');
    return p;
  };

  return { unseen, permission, askPermission, sound, setSound };
}
