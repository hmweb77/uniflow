'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

const B1_SUBJECTS = [
  {
    key: 'stats',
    labelEn: 'Statistics',
    labelFr: 'Statistiques',
    descEn: 'Probability, distributions, and hypothesis testing for B1.',
    descFr: 'Probabilités, distributions et tests d\'hypothèses pour le B1.',
    color: '#6366f1',
    bgLight: '#eef2ff',
  },
  {
    key: 'accounting',
    labelEn: 'Accounting',
    labelFr: 'Comptabilité',
    descEn: 'Financial statements, bookkeeping, and balance sheets.',
    descFr: 'États financiers, comptabilité générale et bilans.',
    color: '#f59e0b',
    bgLight: '#fffbeb',
  },
  {
    key: 'psychology',
    labelEn: 'Psychology',
    labelFr: 'Psychologie',
    descEn: 'Organizational behavior and social psychology fundamentals.',
    descFr: 'Comportement organisationnel et psychologie sociale.',
    color: '#ec4899',
    bgLight: '#fdf2f8',
  },
  {
    key: 'law',
    labelEn: 'Law',
    labelFr: 'Droit',
    descEn: 'Contract law, obligations, and legal frameworks.',
    descFr: 'Droit des contrats, obligations et cadres juridiques.',
    color: '#10b981',
    bgLight: '#ecfdf5',
  },
  {
    key: 'computer-skills',
    labelEn: 'Computer Skills',
    labelFr: 'Informatique',
    descEn: 'Excel, data analysis, and digital tools mastery.',
    descFr: 'Excel, analyse de données et maîtrise des outils numériques.',
    color: '#3b82f6',
    bgLight: '#eff6ff',
  },
];

const B2_SUBJECTS = [
  {
    key: 'stats',
    labelEn: 'Advanced Statistics',
    labelFr: 'Statistiques avancées',
    descEn: 'Regression, econometrics, and multivariate analysis.',
    descFr: 'Régression, économétrie et analyse multivariée.',
    color: '#6366f1',
    bgLight: '#eef2ff',
  },
  {
    key: 'accounting',
    labelEn: 'Management Accounting',
    labelFr: 'Comptabilité de gestion',
    descEn: 'Cost accounting, budgeting, and performance analysis.',
    descFr: 'Comptabilité analytique, budgets et analyse de performance.',
    color: '#f59e0b',
    bgLight: '#fffbeb',
  },
  {
    key: 'law',
    labelEn: 'Business Law',
    labelFr: 'Droit des affaires',
    descEn: 'Company law, commercial law, and regulations.',
    descFr: 'Droit des sociétés, droit commercial et réglementations.',
    color: '#10b981',
    bgLight: '#ecfdf5',
  },
  {
    key: 'computer-skills',
    labelEn: 'Advanced Excel & VBA',
    labelFr: 'Excel avancé & VBA',
    descEn: 'Macros, automation, and advanced data modeling.',
    descFr: 'Macros, automatisation et modélisation avancée.',
    color: '#3b82f6',
    bgLight: '#eff6ff',
  },
];

function SubjectCard({ subject, locale, category }) {
  return (
    <Link
      href={`/classes?category=${category}&subject=${subject.key}`}
      className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-light)',
      }}
    >
      {/* Icon dot */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
        style={{ backgroundColor: subject.bgLight }}
      >
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {locale === 'fr' ? subject.labelFr : subject.labelEn}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {locale === 'fr' ? subject.descFr : subject.descEn}
      </p>
    </Link>
  );
}

export default function SubjectsSection() {
  const { locale } = useLocale();
  const isEn = locale === 'en';

  return (
    <section className="section px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="container-wide space-y-16">
        {/* B1 Subjects */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {isEn ? 'B1 Subjects' : 'Matières B1'}
            </h2>
            <Link
              href="/classes?category=b1"
              className="text-sm font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--color-primary-600)' }}
            >
              {isEn ? 'View all' : 'Voir tout'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {B1_SUBJECTS.map((s) => (
              <SubjectCard key={`b1-${s.key}`} subject={s} locale={locale} category="b1" />
            ))}
          </div>
        </div>

        {/* B2 Subjects */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {isEn ? 'B2 Subjects' : 'Matières B2'}
            </h2>
            <Link
              href="/classes?category=b2"
              className="text-sm font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--color-primary-600)' }}
            >
              {isEn ? 'View all' : 'Voir tout'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {B2_SUBJECTS.map((s) => (
              <SubjectCard key={`b2-${s.key}`} subject={s} locale={locale} category="b2" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
