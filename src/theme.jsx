import { useEffect, useState } from 'react';

const KEY = 'moe-theme';
const current = () => document.documentElement.dataset.theme || 'light';

/** Light / dark switch. The first theme is set in index.html (no flash). */
export function useTheme() {
  const [theme, setTheme] = useState(current);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121918' : '#FBF6EE');
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  // Keep several toggles on the page in sync.
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(current()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function ThemeToggle({ label }) {
  const [theme, toggle] = useTheme();
  const text = label?.[theme] || (theme === 'dark' ? 'Light mode' : 'Dark mode');
  return (
    <button type="button" className="theme-btn" onClick={toggle} aria-label={text} title={text}>
      <svg className="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="moon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" />
      </svg>
    </button>
  );
}
