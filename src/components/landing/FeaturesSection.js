'use client';

import { useLocale } from '@/contexts/LocaleContext';

const features = [
  {
    titleEn: 'Live Interactive Classes',
    titleFr: 'Cours en direct interactifs',
    descEn: 'Join live sessions with expert tutors. Ask questions in real-time and get instant feedback.',
    descFr: 'Participe à des sessions en direct avec des tuteurs experts. Pose des questions et obtiens des réponses en temps réel.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    titleEn: 'Multi-Subject Bundles',
    titleFr: 'Packs multi-matières',
    descEn: 'Save up to 20% when you combine courses from different subjects. Study smarter, pay less.',
    descFr: 'Économise jusqu\'à 20% en combinant des cours de différentes matières. Étudie mieux, paie moins.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    titleEn: 'Exam-Aligned Content',
    titleFr: 'Contenu aligné sur les examens',
    descEn: 'Every course is designed around the actual ESCP exam format. No filler, just what you need to pass.',
    descFr: 'Chaque cours est conçu autour du format réel des examens ESCP. Pas de superflu, juste l\'essentiel.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
  },
  {
    titleEn: 'No Account Required',
    titleFr: 'Aucun compte requis',
    descEn: 'Register with just your name and email. Get your access link instantly after payment.',
    descFr: 'Inscris-toi avec ton nom et email. Reçois ton lien d\'accès instantanément après le paiement.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
];

export default function FeaturesSection() {
  const { locale } = useLocale();
  const isEn = locale === 'en';

  return (
    <section className="section px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {isEn ? 'Why students choose Uniflow' : 'Pourquoi les étudiants choisissent Uniflow'}
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {isEn
              ? 'Everything you need to prepare for your exams, in one place.'
              : 'Tout ce dont tu as besoin pour préparer tes examens, au même endroit.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border group transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-light)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{
                  backgroundColor: 'var(--color-primary-50)',
                  color: 'var(--color-primary-600)',
                }}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {isEn ? feature.titleEn : feature.titleFr}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {isEn ? feature.descEn : feature.descFr}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
