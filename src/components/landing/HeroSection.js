'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

export default function HeroSection() {
  const { locale } = useLocale();
  const isEn = locale === 'en';

  return (
    <section className="relative overflow-hidden">
      {/* Dark gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0f0a2e 0%, #1a1145 30%, #1e1b4b 60%, #0f172a 100%)',
        }}
      />
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Glow accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
      />

      <div className="relative container-wide py-20 md:py-28 px-4">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-8 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            {isEn ? '2026 EXAM SEASON' : 'SAISON D\'EXAMENS 2026'}
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] text-white">
            {isEn ? 'Ace Your Exams with ' : 'Réussis tes examens avec des '}
            <span className="hero-gradient-text">
              {isEn ? 'Expert-Led Live Sessions' : 'cours en direct'}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl mb-10 max-w-2xl text-gray-300 leading-relaxed">
            {isEn
              ? 'Join thousands of students boosting their grades with interactive prep classes, curated materials, and proven strategies.'
              : 'Rejoins des milliers d\'étudiants qui améliorent leurs notes avec des cours interactifs, des supports sélectionnés et des stratégies éprouvées.'}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/classes?category=b1"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base text-white transition-all hover:brightness-110 hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              {isEn ? 'Go to B1 Prep' : 'Préparer le B1'}
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link
              href="/classes?category=b2"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-all"
            >
              {isEn ? 'Go to B2 Prep' : 'Préparer le B2'}
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
