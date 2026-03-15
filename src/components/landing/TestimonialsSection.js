'use client';

import { useLocale } from '@/contexts/LocaleContext';

const testimonials = [
  {
    name: 'Marie L.',
    role: { en: 'B1 Student, ESCP', fr: 'Étudiante B1, ESCP' },
    content: {
      en: 'The stats revision bundle saved my exam. Everything was structured exactly like the exam format — I knew what to expect.',
      fr: 'Le pack de révision de stats a sauvé mon examen. Tout était structuré exactement comme le format de l\'examen.',
    },
  },
  {
    name: 'Thomas D.',
    role: { en: 'B2 Student, ESCP', fr: 'Étudiant B2, ESCP' },
    content: {
      en: 'I took the multi-subject bundle and saved 20%. The live classes were interactive and the tutors answered all my questions in real time.',
      fr: 'J\'ai pris le pack multi-matières et économisé 20%. Les cours en direct étaient interactifs et les tuteurs ont répondu à toutes mes questions.',
    },
  },
  {
    name: 'Sarah M.',
    role: { en: 'B1 Student, ESCP', fr: 'Étudiante B1, ESCP' },
    content: {
      en: 'No account needed — just pay and you get the link. Simple, fast, and the accounting session was exactly what I needed before the final.',
      fr: 'Pas besoin de compte — juste payer et tu reçois le lien. Simple, rapide, et la session de compta était exactement ce qu\'il me fallait.',
    },
  },
];

export default function TestimonialsSection() {
  const { locale } = useLocale();
  const isEn = locale === 'en';

  return (
    <section className="section px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {isEn ? 'What students say' : 'Ce que disent les étudiants'}
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {isEn ? 'Real feedback from ESCP students' : 'De vrais retours d\'étudiants ESCP'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-light)',
              }}
            >
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-yellow-400 text-sm">★</span>
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                &ldquo;{testimonial.content[locale] || testimonial.content.en}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)' }}
                >
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{testimonial.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {testimonial.role[locale] || testimonial.role.en}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
