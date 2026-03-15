'use client';

import { useLocale } from '@/contexts/LocaleContext';

const stats = [
  {
    value: '2,400+',
    labelEn: 'Active Students',
    labelFr: 'Étudiants actifs',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
      </svg>
    ),
  },
  {
    value: '94%',
    labelEn: 'Pass Rate',
    labelFr: 'Taux de réussite',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m4.394-4.564a.75.75 0 0 0-.88-.645A48.896 48.896 0 0 0 12 5.069a48.892 48.892 0 0 0-7.784 1.498.75.75 0 0 0-.88.645" />
      </svg>
    ),
  },
  {
    value: '180+',
    labelEn: 'Live Sessions',
    labelFr: 'Sessions en direct',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
];

export default function StatsSection() {
  const { locale } = useLocale();

  return (
    <section className="relative -mt-10 z-10 px-4 pb-16">
      <div className="container-wide">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center px-6 py-8 rounded-2xl border transition-all hover:shadow-lg"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div
                className="mb-3"
                style={{ color: 'var(--color-primary-500)' }}
              >
                {stat.icon}
              </div>
              <span className="text-3xl md:text-4xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {stat.value}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {locale === 'fr' ? stat.labelFr : stat.labelEn}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
