'use client';

import { useLocale } from '@/contexts/LocaleContext';

export default function Footer() {
  const { t } = useLocale();

  return (
    <footer
      className="py-12 px-4 border-t"
      style={{
        backgroundColor: 'var(--bg-inverse)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="container-wide">
        <div className="flex flex-col items-center justify-between gap-6">
         

          {/* Copyright */}
          <p className="text-sm text-[var(--text-inverse)] opacity-50">
            {t.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}