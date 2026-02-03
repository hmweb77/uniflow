'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getTranslations } from '@/i18n';

const LocaleContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: {},
  toggleLocale: () => {},
});

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('uniflow-locale');
    if (stored === 'en' || stored === 'fr') {
      setLocaleState(stored);
    } else {
      // Detect from browser
      const browserLang = navigator.language?.slice(0, 2);
      if (browserLang === 'fr') setLocaleState('fr');
    }
  }, []);

  const setLocale = (newLocale) => {
    setLocaleState(newLocale);
    if (mounted) localStorage.setItem('uniflow-locale', newLocale);
  };

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'fr' : 'en');
  };

  const t = getTranslations(locale);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, toggleLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);