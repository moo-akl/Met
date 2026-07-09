import { createContext, useContext, ReactNode } from 'react';
import { Lang, Translations, TRANSLATIONS } from './translations';

interface LangContextValue {
  lang: Lang;
  t: Translations;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  t: TRANSLATIONS.en,
});

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <LangContext.Provider value={{ lang, t: TRANSLATIONS[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
