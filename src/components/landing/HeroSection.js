'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <section
      className="pt-16 pb-20 px-4"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <div className="container-wide">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
            style={{
              backgroundColor: 'var(--color-primary-50)',
              color: 'var(--color-primary-700)',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: 'var(--color-primary-400)' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: 'var(--color-primary-500)' }}
              />
            </span>
            {t.hero.badge}
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t.hero.titleLine1}{' '}
            <span className="text-brand">{t.hero.titleHighlight}</span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t.hero.subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/events" className="btn btn-primary btn-xl">
              {t.hero.ctaPrimary}
            </Link>
            <a href="#how-it-works" className="btn btn-secondary btn-xl">
              {t.hero.ctaSecondary}
            </a>
          </div>

          {/* Social proof */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <div className="flex items-center gap-2">
              <span>{t.hero.socialProof}</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className="text-yellow-400">★</span>
              ))}
              <span className="ml-1">{t.hero.rating}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}