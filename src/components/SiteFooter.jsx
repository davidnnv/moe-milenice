import { Link } from 'react-router-dom';
import { useLang } from '../lang';
import { BUSINESS } from '../lib/config';
import { Brand } from './Brand';

export default function SiteFooter() {
  const { t, lang } = useLang();
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__inner">
        <Brand lang={lang} small />
        <div className="site-footer__links">
          <a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a>
          <a href={BUSINESS.mapsLink} target="_blank" rel="noreferrer">
            {BUSINESS.address[lang]}
          </a>
          {BUSINESS.instagram && (
            <a href={BUSINESS.instagram} target="_blank" rel="noreferrer">
              Instagram
            </a>
          )}
          {BUSINESS.facebook && (
            <a href={BUSINESS.facebook} target="_blank" rel="noreferrer">
              Facebook
            </a>
          )}
        </div>
        <div className="site-footer__bottom">
          <span>
            © {new Date().getFullYear()} {BUSINESS.name[lang]}. {t.footer.rights}
          </span>
          <span className="site-footer__meta">
            <Link to="/admin">{t.footer.admin}</Link>
            <span aria-hidden="true">·</span>
            <a href="https://iomys.onrender.com" target="_blank" rel="noreferrer">
              {t.footer.madeBy} IOMYS
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
