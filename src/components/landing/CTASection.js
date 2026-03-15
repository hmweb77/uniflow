'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

export default function CTASection() {
  const { locale } = useLocale();
  const isEn = locale === 'en';

  return (
    <section className="px-4 py-20" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          {isEn ? 'Ready to ace your exams?' : 'Prêt à réussir tes examens ?'}
        </h2>
        <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {isEn
            ? 'Browse B1 and B2 courses, pick what you need, and start studying today.'
            : 'Parcours les cours B1 et B2, choisis ce dont tu as besoin, et commence à réviser.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/classes?category=b1"
            className="btn btn-primary btn-xl"
          >
            {isEn ? 'Explore B1 Courses' : 'Explorer les cours B1'}
          </Link>
          <Link
            href="/classes?category=b2"
            className="btn btn-secondary btn-xl"
          >
            {isEn ? 'Explore B2 Courses' : 'Explorer les cours B2'}
          </Link>
        </div>
      </div>
    </section>
  );
}
