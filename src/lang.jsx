import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { T } from './i18n';

const Ctx = createContext(null);

function initial() {
  try {
    const s = localStorage.getItem('moe-lang');
    if (s === 'mk' || s === 'en') return s;
  } catch { /* ignore */ }
  return 'mk';
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initial);
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('moe-lang', lang); } catch { /* ignore */ }
  }, [lang]);
  const value = useMemo(() => ({ lang, t: T[lang], toggle: () => setLang((l) => (l === 'mk' ? 'en' : 'mk')) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
