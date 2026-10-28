import { createContext, useContext, useState, ReactNode } from 'react';
export type Lang = 'ta' | 'en' | 'both';
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'both', setLang: () => {} });
export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'both');
  return <Ctx.Provider value={{ lang, setLang: l => { localStorage.setItem('lang', l); setLang(l); } }}>{children}</Ctx.Provider>;
};
export const useLang = () => useContext(Ctx);
/** Renders English, Tamil or both depending on the selected language. */
export function Bi({ en, ta, block }: { en: string; ta: string; block?: boolean }) {
  const { lang } = useLang();
  const Wrap = block ? 'div' : 'span';
  return (
    <>
      {lang !== 'ta' && <Wrap>{en}</Wrap>}
      {lang !== 'en' && <Wrap lang="ta" className="ta" style={lang === 'both' ? { display: 'block' } : undefined}>{ta}</Wrap>}
    </>
  );
}
export function LangToggle() {
  const { lang, setLang } = useLang();
  const opts: [Lang, string][] = [['ta', 'தமிழ்'], ['en', 'English'], ['both', 'தமிழ் + English']];
  return (
    <div className="lang" role="group" aria-label="Language">
      {opts.map(([k, t]) => <button key={k} aria-pressed={lang === k} onClick={() => setLang(k)}>{t}</button>)}
    </div>
  );
}
