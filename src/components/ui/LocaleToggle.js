'use client';

import { useLocale } from '@/contexts/LocaleContext';

export default function LocaleToggle() {
  const { locale, toggleLocale } = useLocale();

  return (
    <button
      onClick={toggleLocale}
      className="btn btn-ghost btn-sm font-medium"
      aria-label={locale === 'en' ? 'Passer en français' : 'Switch to English'}
    >
      {locale === 'en' ? 'FR' : 'EN'}
    </button>
  );
}