'use client';

import { useLocale } from '@/contexts/LocaleContext';

const testimonials = [
  {
    name: 'Marie L.',
    role: { en: 'Business Student, ESCP', fr: 'Étudiante en commerce, ESCP' },
    content: {
      en: 'Super easy to register for classes! I received my Zoom link instantly after payment.',
      fr: "Super facile de s'inscrire aux cours ! J'ai reçu mon lien Zoom instantanément après le paiement.",
    },
  },
  {
    name: 'Thomas D.',
    role: { en: 'Engineering Student, Polytechnique', fr: 'Étudiant en ingénierie, Polytechnique' },
    content: {
      en: 'Finally a platform that makes it simple to access premium masterclasses. Love it!',
      fr: "Enfin une plateforme qui rend l'accès aux masterclasses premium simple. J'adore !",
    },
  },
  {
    name: 'Sarah M.',
    role: { en: 'MBA Student, HEC Paris', fr: 'Étudiante MBA, HEC Paris' },
    content: {
      en: 'The payment process is seamless. Apple Pay made checkout a breeze.',
      fr: 'Le processus de paiement est fluide. Apple Pay a rendu le checkout très facile.',
    },
  },
];

export default function TestimonialsSection() {
  const { locale, t } = useLocale();

  return (
    <section className="section px-4" style={{ background: 'var(--gradient-brand)' }}>
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t.testimonials.sectionTitle}
          </h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            {t.testimonials.sectionSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="rounded-2xl p-6 border"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-yellow-400">★</span>
                ))}
              </div>
              <p className="text-white mb-6">
                &ldquo;{testimonial.content[locale] || testimonial.content.en}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                >
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-white/60 text-sm">
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