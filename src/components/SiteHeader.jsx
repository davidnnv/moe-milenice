import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../lang';
import { Brand } from './Brand';
import { ThemeToggle } from '../theme';

export default function SiteHeader() {
  const { t, lang, toggle } = useLang();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const links = [
    ['/#uslugi', t.nav.services],
    ['/#kako', t.nav.how],
    ['/#galerija', t.nav.gallery],
    ['/#prasanja', t.nav.faq],
    ['/#kontakt', t.nav.contact],
  ];

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="wrap site-header__inner">
        <Link to="/" className="site-header__brand" aria-label={lang === 'en' ? 'Moe Milenice — home' : 'Мое Милениче — почетна'} onClick={() => setOpen(false)}>
          <Brand lang={lang} />
        </Link>
        <nav className="site-nav" aria-label="Main">
          {links.map(([to, label]) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <ThemeToggle label={t.themeLabel} />
          <button type="button" className="lang-btn" onClick={toggle} aria-label={t.langLabel}>
            {lang === 'mk' ? 'EN' : 'MK'}
          </button>
          <Link to="/zakazi" className="btn btn--primary site-header__cta">
            {t.nav.book}
          </Link>
          <button
            type="button"
            className="burger-btn"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="mob-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={open ? 'burger is-open' : 'burger'} />
          </button>
        </div>
      </div>
      {open && (
        <nav id="mob-nav" className="mob-nav" aria-label="Mobile">
          {links.map(([to, label]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link to="/zakazi" className="btn btn--primary btn--lg" onClick={() => setOpen(false)}>
            {t.nav.book}
          </Link>
        </nav>
      )}
    </header>
  );
}
