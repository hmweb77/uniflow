'use client';

import { useLocale } from '@/contexts/LocaleContext';

const featureIcons = [
  // Lightning bolt
  <svg key="instant" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>,
  // Shield check
  <svg key="secure" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>,
  // Device phone + tablet
  <svg key="mobile" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>,
];

export default function FeaturesSection() {
  const { t } = useLocale();

  const features = [
    { icon: featureIcons[0], ...t.features.instantAccess },
    { icon: featureIcons[1], ...t.features.securePayments },
    { icon: featureIcons[2], ...t.features.mobileFriendly },
  ];

  return (
    <section className="section px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {t.features.sectionTitle}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t.features.sectionSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="surface p-6 card-hover group"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{
                  backgroundColor: 'var(--color-primary-50)',
                  color: 'var(--color-primary-600)',
                }}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}