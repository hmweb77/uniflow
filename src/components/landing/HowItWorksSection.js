'use client';

import { useLocale } from '@/contexts/LocaleContext';

const stepIcons = [
  <svg key="search" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>,
  <svg key="card" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>,
  <svg key="video" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
  </svg>,
];

export default function HowItWorksSection() {
  const { t } = useLocale();

  const steps = [
    { number: '01', icon: stepIcons[0], ...t.howItWorks.step1 },
    { number: '02', icon: stepIcons[1], ...t.howItWorks.step2 },
    { number: '03', icon: stepIcons[2], ...t.howItWorks.step3 },
  ];

  return (
    <section
      id="how-it-works"
      className="section px-4"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {t.howItWorks.sectionTitle}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t.howItWorks.sectionSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line (desktop) */}
              {index < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-16 left-1/2 w-full h-0.5"
                  style={{
                    background: 'linear-gradient(to right, var(--color-primary-300), var(--color-accent-400))',
                  }}
                />
              )}
              <div className="surface-elevated p-8 text-center relative z-10">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: 'var(--gradient-brand)' }}
                >
                  {step.icon}
                </div>
                <div
                  className="text-sm font-bold mb-2"
                  style={{ color: 'var(--color-primary-600)' }}
                >
                  STEP {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  {step.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)' }}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}