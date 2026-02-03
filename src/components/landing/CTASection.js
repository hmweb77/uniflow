'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

export default function CTASection() {
  const { t } = useLocale();

  return (
    <section className="section px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          {t.cta.title}
        </h2>
        <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {t.cta.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/events" className="btn btn-primary btn-xl">
            {t.cta.primary}
          </Link>
         
        </div>
      </div>
    </section>
  );
}