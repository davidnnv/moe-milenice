// "Install the app" — floating banner on the home page, or a button (footer / admin).
import { useEffect, useState } from 'react';
import { useInstall } from '../lib/pwa';
import { useLang } from '../lang';
import { Paw } from './Brand';

const KEY = 'moe-install-dismissed';

function IosSteps({ t, onClose }) {
  return (
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg ios-dlg" role="dialog" aria-modal="true" aria-labelledby="ios-title">
        <span className="dlg__icon" aria-hidden="true">
          <Paw size={28} />
        </span>
        <h2 id="ios-title">{t.install.iosTitle}</h2>
        <ol className="ios-steps">
          <li>
            {t.install.ios1a} <b>{t.install.share}</b> <ShareIcon /> {t.install.ios1b}
          </li>
          <li>
            {t.install.ios2} <b>„{t.install.addHome}“</b>.
          </li>
          <li>{t.install.ios3}</li>
        </ol>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t.install.ok}
        </button>
      </div>
    </div>
  );
}

export default function InstallCard({ variant = 'banner' }) {
  const { t } = useLang();
  const { installed, canPrompt, ios, prompt } = useInstall();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const [show, setShow] = useState(variant !== 'banner');
  const [iosOpen, setIosOpen] = useState(false);
  const [done, setDone] = useState(false);

  // The banner appears a few seconds after the page opens, not immediately.
  useEffect(() => {
    if (variant !== 'banner') return undefined;
    const id = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(id);
  }, [variant]);

  const available = canPrompt || ios;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };
  const install = async () => {
    if (canPrompt) {
      const r = await prompt();
      if (r === 'accepted') {
        setDone(true);
        close();
      }
    } else setIosOpen(true);
  };

  if (installed) {
    return variant === 'button' ? <span className="install-ok">✓ {t.install.installed}</span> : null;
  }

  if (variant === 'button') {
    return (
      <>
        <button type="button" className="install-link" onClick={available ? install : () => setIosOpen(true)}>
          <DownloadIcon /> {t.install.button}
        </button>
        {iosOpen && (ios || !canPrompt) && <IosSteps t={t} onClose={() => setIosOpen(false)} />}
      </>
    );
  }

  if (dismissed || !available || !show) return iosOpen ? <IosSteps t={t} onClose={() => setIosOpen(false)} /> : null;

  return (
    <>
      <div className="install-banner" role="region" aria-label={t.install.title}>
        <span className="install-banner__icon" aria-hidden="true">
          <Paw size={30} />
        </span>
        <div className="install-banner__text">
          <strong>{done ? t.install.installing : t.install.title}</strong>
          <span>{t.install.text}</span>
        </div>
        {!done && (
          <button type="button" className="btn btn--primary btn--small" onClick={install}>
            {t.install.button}
          </button>
        )}
        <button type="button" className="install-banner__close" aria-label={t.install.close} onClick={close}>
          ×
        </button>
      </div>
      {iosOpen && <IosSteps t={t} onClose={() => setIosOpen(false)} />}
    </>
  );
}

function ShareIcon() {
  return (
    <svg className="ios-share" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}
