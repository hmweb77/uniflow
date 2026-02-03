'use client';

import { useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';

export default function FAQSection() {
  const { t } = useLocale();
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = t.faq.items || [];

  return (
    <section
      id="faq"
      className="section px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="container-narrow">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {t.faq.sectionTitle}
          </h2>
          <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
            {t.faq.sectionSubtitle}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="surface overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <span className="font-semibold pr-4" style={{ color: 'var(--text-primary)' }}>
                  {faq.question}
                </span>
                <span
                  className="text-2xl flex-shrink-0 transition-transform"
                  style={{
                    color: 'var(--text-tertiary)',
                    transform: openIndex === index ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  +
                </span>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 animate-fade-in-up">
                  <p style={{ color: 'var(--text-secondary)' }}>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}