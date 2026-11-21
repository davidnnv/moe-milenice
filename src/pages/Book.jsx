import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLang } from '../lang';
import { fill } from '../i18n';
import { api, errorCode } from '../lib/api';
import { BOOKING, BUSINESS } from '../lib/config';
import { freeSlots, isOpenDay } from '../lib/slots';
import { addDays, fmtDay, fmtMonthShort, fmtDuration, fmtPrice, fmtTime, nowLocal, parseYmd } from '../lib/time';
import useSalonData from '../lib/useSalonData';
import SiteHeader from '../components/SiteHeader';
import { Paw } from '../components/Brand';

const EMPTY = { petName: '', petBreed: '', petSize: 'medium', ownerName: '', phone: '', email: '', note: '', website: '' };
const LIMITS = { petName: 60, petBreed: 60, ownerName: 80, phone: 30, email: 120, note: 500 };
const phoneOk = (p) => /^[+\d\s()/-]+$/.test(p.trim()) && p.replace(/\D/g, '').length >= 8 && p.replace(/\D/g, '').length <= 15;
const emailOk = (e) => !e.trim() || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e.trim());

export default function Book() {
  const { t, lang } = useLang();
  const b = t.book;
  const { services, hours, blocked } = useSalonData();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(params.get('usluga') || '');
  const [day, setDay] = useState('');
  const [time, setTime] = useState(null);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const topRef = useRef(null);
  const openedAt = useRef(Date.now());

  const service = services?.find((s) => s.id === serviceId);
  const now = nowLocal();

  // Days shown in the picker.
  const days = useMemo(() => Array.from({ length: BOOKING.daysAhead }, (_, i) => addDays(now.day, i)), [now.day]);

  // If the service came from the URL, skip to choosing a time.
  useEffect(() => {
    if (services && params.get('usluga') && services.some((s) => s.id === params.get('usluga'))) setStep(1);
  }, [services, params]);

  // A day can be picked if the salon is open and (for today) there is still time left.
  const canBook = (d) => {
    if (!isOpenDay(d, hours, blocked)) return false;
    if (d !== now.day) return true;
    const h = hours.find((r) => r.weekday === parseYmd(d).getDay());
    return now.min + BOOKING.leadMin + (service?.duration_min || 30) <= h.close_min;
  };

  // Pick the first bookable day automatically.
  useEffect(() => {
    if (step === 1 && !day && hours.length) {
      const first = days.find(canBook);
      if (first) setDay(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, day, hours, blocked, days]);

  // Load busy times whenever the day changes.
  useEffect(() => {
    if (!day) return undefined;
    let alive = true;
    setBusy(null);
    api.getBusy(day).then((rows) => alive && setBusy(rows)).catch(() => alive && setBusy([]));
    return () => {
      alive = false;
    };
  }, [day]);

  const slots = useMemo(
    () => (busy && service ? freeSlots({ day, hours, blocked, busy, duration: service.duration_min, now }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, service, day, hours, blocked]
  );

  const go = (n) => {
    setError('');
    setStep(n);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const errors = {
    petName: !form.petName.trim() && b.required,
    ownerName: !form.ownerName.trim() && b.required,
    phone: !form.phone.trim() ? b.required : !phoneOk(form.phone) && b.badPhone,
    email: !emailOk(form.email) && b.badEmail,
  };
  const formValid = !Object.values(errors).some(Boolean);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.slice(0, LIMITS[k] || 200) }));
  const blur = (k) => () => setTouched((x) => ({ ...x, [k]: true }));
  const showErr = (k) => (touched[k] || touched._all) && errors[k];

  const submit = async () => {
    setSending(true);
    setError('');
    // Bots fill the hidden "website" field or submit within seconds: pretend success, save nothing.
    if (form.website || Date.now() - openedAt.current < 4000) {
      setTimeout(() => { setSending(false); setDone(true); }, 600);
      return;
    }
    try {
      const { website, ...clean } = form;
      await api.createBooking({ serviceId, day, startMin: time, ...clean, lang });
      setDone(true);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      const code = errorCode(e);
      setError(b.err[code] || b.err.GENERIC);
      if (code === 'SLOT_TAKEN' || code === 'TOO_SOON') {
        setTime(null);
        setStep(1);
        api.getBusy(day).then(setBusy).catch(() => {});
      }
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setDone(false);
    setStep(0);
    setServiceId('');
    setDay('');
    setTime(null);
    setForm(EMPTY);
    setTouched({});
  };

  const name = (s) => (lang === 'en' && s.name_en ? s.name_en : s.name_mk);

  return (
    <>
      <SiteHeader />
      <main className="book" ref={topRef}>
        <div className="wrap book__wrap">
          {done ? (
            <div className="book-done" role="status">
              <span className="book-done__icon">
                <Paw size={44} />
              </span>
              <h1 className="h2">{b.doneTitle}</h1>
              <p className="book-done__when">
                {name(service)} · {fmtDay(day, lang)} · {fmtTime(time)}
              </p>
              <p>{fill(b.doneText, { phone: form.phone, salon: BUSINESS.phone })}</p>
              <div className="book-done__actions">
                <Link to="/" className="btn btn--ghost">
                  {b.home}
                </Link>
                <button type="button" className="btn btn--primary" onClick={reset}>
                  {b.another}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="h2 book__title">{b.title}</h1>
              <ol className="stepper" aria-label={b.title}>
                {b.steps.map((label, i) => (
                  <li key={label} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                    <span>{i + 1}</span>
                    {label}
                  </li>
                ))}
              </ol>

              {error && (
                <p className="alert" role="alert">
                  {error}
                </p>
              )}

              {step === 0 && (
                <section className="book-step">
                  <h2 className="book-step__title">{b.chooseService}</h2>
                  <div className="pick-list" role="radiogroup" aria-label={b.chooseService}>
                    {(services || []).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={serviceId === s.id}
                        className={`pick${serviceId === s.id ? ' is-on' : ''}`}
                        onClick={() => {
                          setServiceId(s.id);
                          setTime(null);
                          go(1);
                        }}
                      >
                        <span className="pick__main">
                          <strong>{name(s)}</strong>
                          <span className="muted">{fmtDuration(s.duration_min, lang)}</span>
                        </span>
                        <span className="pick__price">{fmtPrice(s.price_mkd, s.price_from, lang)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {step === 1 && service && (
                <section className="book-step">
                  <p className="book-chosen">
                    {name(service)} · {fmtDuration(service.duration_min, lang)}
                    <button type="button" className="link-btn" onClick={() => go(0)}>
                      {lang === 'en' ? 'Change' : 'Смени'}
                    </button>
                  </p>
                  <h2 className="book-step__title">{b.chooseDay}</h2>
                  <div className="day-strip" role="listbox" aria-label={b.chooseDay}>
                    {days.map((d) => {
                      const open = canBook(d);
                      const dt = parseYmd(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          role="option"
                          aria-selected={d === day}
                          disabled={!open}
                          className={`day-chip${d === day ? ' is-on' : ''}`}
                          onClick={() => {
                            setDay(d);
                            setTime(null);
                          }}
                        >
                          <span className="day-chip__wd">{t.daysShort[dt.getDay()]}</span>
                          <span className="day-chip__d">{dt.getDate()}</span>
                          <span className="day-chip__m">{fmtMonthShort(dt, lang)}</span>
                          {!open && <span className="day-chip__closed">{b.closedDay}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <h2 className="book-step__title">
                    {b.chooseTime}
                    {day && <span className="muted"> · {fmtDay(day, lang)}</span>}
                  </h2>
                  {busy === null ? (
                    <p className="muted">{b.loadingSlots}</p>
                  ) : slots.length === 0 ? (
                    <p className="muted">{b.noSlots}</p>
                  ) : (
                    <div className="time-grid" role="listbox" aria-label={b.chooseTime}>
                      {slots.map((m) => (
                        <button key={m} type="button" role="option" aria-selected={m === time} className={`time-chip${m === time ? ' is-on' : ''}`} onClick={() => setTime(m)}>
                          {fmtTime(m)}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="book-nav">
                    <button type="button" className="btn btn--ghost" onClick={() => go(0)}>
                      ← {b.back}
                    </button>
                    <button type="button" className="btn btn--primary" disabled={time === null} onClick={() => go(2)}>
                      {b.next} →
                    </button>
                  </div>
                </section>
              )}

              {step === 2 && (
                <form
                  className="book-step"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    setTouched({ _all: true });
                    if (formValid) go(3);
                  }}
                >
                  <fieldset className="fieldset">
                    <legend>{b.pet}</legend>
                    <Field id="petName" label={b.petName} error={showErr('petName')}>
                      <input id="petName" value={form.petName} onChange={set('petName')} onBlur={blur('petName')} autoComplete="off" maxLength={LIMITS.petName} required />
                    </Field>
                    <Field id="petBreed" label={b.petBreed}>
                      <input id="petBreed" value={form.petBreed} onChange={set('petBreed')} autoComplete="off" maxLength={LIMITS.petBreed} />
                    </Field>
                    <div className="field">
                      <span className="field__label" id="sizeLbl">
                        {b.petSize}
                      </span>
                      <div className="seg" role="radiogroup" aria-labelledby="sizeLbl">
                        {['small', 'medium', 'large'].map((s) => (
                          <button key={s} type="button" role="radio" aria-checked={form.petSize === s} className={form.petSize === s ? 'is-on' : ''} onClick={() => setForm((f) => ({ ...f, petSize: s }))}>
                            {b.sizes[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </fieldset>
                  <div className="hp" aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                  </div>
                  <fieldset className="fieldset">
                    <legend>{b.owner}</legend>
                    <Field id="ownerName" label={b.ownerName} error={showErr('ownerName')}>
                      <input id="ownerName" value={form.ownerName} onChange={set('ownerName')} onBlur={blur('ownerName')} autoComplete="name" maxLength={LIMITS.ownerName} required />
                    </Field>
                    <Field id="phone" label={b.phone} error={showErr('phone')}>
                      <input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} onBlur={blur('phone')} autoComplete="tel" placeholder="07X XXX XXX" maxLength={LIMITS.phone} required />
                    </Field>
                    <Field id="email" label={b.email} error={showErr('email')}>
                      <input id="email" type="email" value={form.email} onChange={set('email')} onBlur={blur('email')} autoComplete="email" maxLength={LIMITS.email} />
                    </Field>
                    <Field id="note" label={b.note}>
                      <textarea id="note" rows="3" value={form.note} onChange={set('note')} placeholder={b.notePh} maxLength={LIMITS.note} />
                    </Field>
                  </fieldset>
                  <div className="book-nav">
                    <button type="button" className="btn btn--ghost" onClick={() => go(1)}>
                      ← {b.back}
                    </button>
                    <button type="submit" className="btn btn--primary">
                      {b.next} →
                    </button>
                  </div>
                </form>
              )}

              {step === 3 && service && (
                <section className="book-step">
                  <h2 className="book-step__title">{b.summary}</h2>
                  <dl className="summary">
                    <div>
                      <dt>{b.service}</dt>
                      <dd>{name(service)}</dd>
                    </div>
                    <div>
                      <dt>{b.when}</dt>
                      <dd>
                        {fmtDay(day, lang)}, {fmtTime(time)} – {fmtTime(time + service.duration_min)}
                      </dd>
                    </div>
                    <div>
                      <dt>{b.price}</dt>
                      <dd>{fmtPrice(service.price_mkd, service.price_from, lang)}</dd>
                    </div>
                    <div>
                      <dt>{b.pet}</dt>
                      <dd>
                        {form.petName}
                        {form.petBreed && `, ${form.petBreed}`} · {b.sizes[form.petSize]}
                      </dd>
                    </div>
                    <div>
                      <dt>{b.owner}</dt>
                      <dd>
                        {form.ownerName} · {form.phone}
                        {form.email && ` · ${form.email}`}
                      </dd>
                    </div>
                    {form.note && (
                      <div>
                        <dt>{b.note.replace(/ \(.*\)/, '')}</dt>
                        <dd>{form.note}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="book-nav">
                    <button type="button" className="btn btn--ghost" onClick={() => go(2)} disabled={sending}>
                      ← {b.back}
                    </button>
                    <button type="button" className="btn btn--primary btn--lg" onClick={submit} disabled={sending}>
                      {sending ? b.sending : b.confirm}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
