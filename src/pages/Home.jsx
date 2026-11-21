import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../lang';
import { fill } from '../i18n';
import { BUSINESS, GALLERY, HERO_PHOTOS } from '../lib/config';
import { fmtDuration, fmtPrice, fmtTime } from '../lib/time';
import useSalonData from '../lib/useSalonData';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { Paw, Stars } from '../components/Brand';
import useReveal from '../useReveal';
import use3D from '../use3D';
import Bubbles3D from '../components/Bubbles3D';

const ratingText = (lang) => BUSINESS.rating.toLocaleString(lang === 'en' ? 'en-GB' : 'mk-MK', { minimumFractionDigits: 1 });

function Hero() {
  const { t, lang } = useLang();
  return (
    <section className="hero">
      <Bubbles3D />
      <div className="wrap hero__inner">
        <div className="hero__copy">
          <p className="kicker">
            <Paw size={18} /> {t.hero.kicker}
          </p>
          <h1 className="hero__title">
            {t.hero.title.map((line, i) => (
              <span key={i} className={i === t.hero.accentLine ? 'hero__accent' : ''}>
                {line}
              </span>
            ))}
          </h1>
          <p className="hero__text">{t.hero.text}</p>
          <div className="hero__actions">
            <Link to="/zakazi" className="btn btn--primary btn--lg">
              <span className="wag"><Paw size={20} /></span> {t.hero.book}
            </Link>
            <a href={BUSINESS.phoneHref} className="btn btn--ghost btn--lg">
              <PhoneIcon /> {t.hero.call} {BUSINESS.phone}
            </a>
          </div>
          <a className="rating-pill" href={BUSINESS.reviewsLink} target="_blank" rel="noreferrer">
            <Stars value={BUSINESS.rating} />
            <strong>{fill(t.hero.rating, { r: ratingText(lang) })}</strong>
            <span>· {fill(t.hero.reviews, { n: BUSINESS.reviewCount })}</span>
          </a>
        </div>

        <div className="hero__media" data-depth-stage>
          <div className="hero__blob" aria-hidden="true" />
          <div className="hero__paws" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <Paw key={i} size={26} />
            ))}
          </div>
          <img className="hero__main" data-depth="2" src={HERO_PHOTOS.main.src} alt={HERO_PHOTOS.main.alt[lang]} width="766" height="1020" fetchpriority="high" />
          <figure className="hero__side" data-depth="4">
            <img src={HERO_PHOTOS.side.src} alt={HERO_PHOTOS.side.alt[lang]} width="765" height="1020" />
          </figure>
          <div className="hero__badge" aria-hidden="true">
            <Paw size={22} />
            <span>{lang === 'en' ? 'Stress-free care' : 'Нега без стрес'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Services({ services }) {
  const { t, lang } = useLang();
  return (
    <section id="uslugi" className="section">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="kicker">{t.services.kicker}</p>
          <h2 className="h2">{t.services.title}</h2>
          <p className="muted">{t.services.note}</p>
        </div>
        {services === null ? (
          <p className="muted">{t.services.loading}</p>
        ) : services.length === 0 ? (
          <p className="muted">{t.services.error}</p>
        ) : (
          <div className="svc-grid">
            {services.map((s, i) => (
              <article key={s.id} className={`svc-card${i === 0 ? ' svc-card--featured' : ''}`} data-reveal="tilt3d" data-tilt="7" style={{ '--d': i % 3 }}>
                <div className="svc-card__top">
                  <h3>{lang === 'en' && s.name_en ? s.name_en : s.name_mk}</h3>
                  <span className="svc-card__time">
                    <ClockIcon /> {fmtDuration(s.duration_min, lang)}
                  </span>
                </div>
                <p>{lang === 'en' && s.desc_en ? s.desc_en : s.desc_mk}</p>
                <div className="svc-card__bottom">
                  <span className="svc-card__price">{fmtPrice(s.price_mkd, s.price_from, lang)}</span>
                  <Link to={`/zakazi?usluga=${s.id}`} className="btn btn--small">
                    {t.services.book} →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function How() {
  const { t } = useLang();
  return (
    <section id="kako" className="section section--tint">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="kicker">{t.how.kicker}</p>
          <h2 className="h2">{t.how.title}</h2>
        </div>
        <ol className="steps">
          {t.how.steps.map((s, i) => (
            <li key={i} className="step" data-reveal="flip" data-tilt="10" style={{ '--d': i }}>
              <span className="step__num">{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="center">
          <Link to="/zakazi" className="btn btn--primary btn--lg">
            {t.nav.book}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(-1);
  const close = useCallback(() => setOpen(-1), []);
  const step = useCallback((d) => setOpen((i) => (i + d + GALLERY.length) % GALLERY.length), []);

  useEffect(() => {
    if (open < 0) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close, step]);

  return (
    <section id="galerija" className="section">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="kicker">{t.gallery.kicker}</p>
          <h2 className="h2">{t.gallery.title}</h2>
        </div>
        {GALLERY.length === 0 ? (
          <p className="muted">{t.gallery.soon}</p>
        ) : (
          <div className="gallery">
            {GALLERY.map((g, i) => (
              <button key={g.src} type="button" className={`gallery__item${g.wide ? ' is-wide' : ''}`} onClick={() => setOpen(i)} aria-label={g.alt[lang]} data-reveal="zoom" data-tilt="9" style={{ '--d': i % 4 }}>
                <img src={g.src} alt={g.alt[lang]} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open >= 0 && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={GALLERY[open].alt[lang]} onClick={close}>
          <img src={GALLERY[open].src} alt={GALLERY[open].alt[lang]} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lightbox__btn lightbox__close" onClick={close} aria-label="Close">
            ×
          </button>
          <button type="button" className="lightbox__btn lightbox__prev" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous">
            ‹
          </button>
          <button type="button" className="lightbox__btn lightbox__next" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next">
            ›
          </button>
          <p className="lightbox__caption">{GALLERY[open].alt[lang]}</p>
        </div>
      )}
    </section>
  );
}

function Reviews() {
  const { t, lang } = useLang();
  return (
    <section className="section section--tight">
      <div className="wrap">
        <div className="review-band" data-reveal="zoom">
          <img src={HERO_PHOTOS.wide.src} alt={HERO_PHOTOS.wide.alt[lang]} loading="lazy" />
          <div className="review-band__copy">
            <h2 className="h2">{t.reviews.title}</h2>
            <div className="review-band__score">
              <CountUp className="review-band__big" to={BUSINESS.rating} lang={lang} />
              <Stars value={BUSINESS.rating} />
            </div>
            <p>{fill(t.reviews.text, { r: ratingText(lang), n: BUSINESS.reviewCount })}</p>
            <a className="btn btn--light" href={BUSINESS.reviewsLink} target="_blank" rel="noreferrer">
              {t.reviews.cta} ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const { t } = useLang();
  const group = (hidden) => (
    <div className="marquee__group" aria-hidden={hidden || undefined}>
      {[...t.marquee, ...t.marquee].map((w, i) => (
        <span key={i} className="marquee__item">
          {w} <Paw size={22} />
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee-wrap">
      <div className="marquee" role="presentation">
        <div className="marquee__track">
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
}

function CountUp({ to, lang, className }) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setV(to);
      return undefined;
    }
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / 1400);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref} className={className}>
      {v.toLocaleString(lang === 'en' ? 'en-GB' : 'mk-MK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
    </span>
  );
}

function Faq() {
  const { t } = useLang();
  const [open, setOpen] = useState(0);
  return (
    <section id="prasanja" className="section">
      <div className="wrap faq">
        <div className="faq__aside" data-reveal="left">
          <p className="kicker">{t.faq.kicker}</p>
          <h2 className="h2">{t.faq.title}</h2>
          <p>{t.faq.text}</p>
          <a href={BUSINESS.phoneHref} className="btn btn--ghost">
            <PhoneIcon /> {BUSINESS.phone}
          </a>
        </div>
        <div className="faq__list">
          {t.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className={`faq__item${isOpen ? ' is-open' : ''}`} data-reveal style={{ '--d': i }}>
                <h3 style={{ margin: 0 }}>
                  <button type="button" className="faq__q" aria-expanded={isOpen} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                    <span>{item.q}</span>
                    <span className="faq__icon" aria-hidden="true" />
                  </button>
                </h3>
                <div className="faq__a" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
                  <div>
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Contact({ hours }) {
  const { t, lang } = useLang();
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <section id="kontakt" className="section section--tint">
      <div className="wrap contact">
        <div className="contact__info" data-reveal="left">
          <p className="kicker">{t.contact.kicker}</p>
          <h2 className="h2">{t.contact.title}</h2>
          <dl className="contact__list">
            <div>
              <dt>{t.contact.address}</dt>
              <dd>
                <a href={BUSINESS.mapsLink} target="_blank" rel="noreferrer">
                  {BUSINESS.address[lang]}
                </a>
              </dd>
            </div>
            <div>
              <dt>{t.contact.phone}</dt>
              <dd>
                <a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a>
                <a className="chip" href={BUSINESS.viberHref}>
                  {t.contact.viber}
                </a>
              </dd>
            </div>
            <div>
              <dt>{t.contact.hours}</dt>
              <dd>
                <ul className="hours">
                  {order.map((w) => {
                    const h = hours.find((r) => r.weekday === w);
                    return (
                      <li key={w} className={new Date().getDay() === w ? 'is-today' : ''}>
                        <span>{t.days[w]}</span>
                        <span>{!h || !h.is_open ? t.contact.closed : `${fmtTime(h.open_min)} – ${fmtTime(h.close_min)}`}</span>
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
          </dl>
          <div className="contact__actions">
            <Link to="/zakazi" className="btn btn--primary btn--lg">
              {t.nav.book}
            </Link>
            <a href={BUSINESS.mapsLink} className="btn btn--ghost btn--lg" target="_blank" rel="noreferrer">
              {t.contact.directions} ↗
            </a>
          </div>
        </div>
        <div className="contact__media" data-reveal="right">
          <img src={HERO_PHOTOS.salon.src} alt={HERO_PHOTOS.salon.alt[lang]} loading="lazy" />
          <iframe title={t.contact.mapTitle} src={BUSINESS.mapsEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { services, hours } = useSalonData();
  const { lang } = useLang();
  useReveal([services, lang]);
  use3D();
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <Services services={services} />
        <How />
        <Gallery />
        <Reviews />
        <Faq />
        <Contact hours={hours} />
      </main>
      <SiteFooter />
    </>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
