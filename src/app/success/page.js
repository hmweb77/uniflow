// src/app/success/page.js

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    const lang = searchParams.get('lang');
    if (lang) {
      setLocale(lang);
    }
  }, [searchParams]);

  const content = {
    en: {
      title: '🎉 Payment Successful!',
      message: 'Thank you for your registration.',
      emailNotice: 'You will receive a confirmation email shortly with the event details and your access link.',
      checkSpam: 'Please check your inbox (and spam folder).',
      home: 'Back to Home',
    },
    fr: {
      title: '🎉 Paiement réussi !',
      message: 'Merci pour votre inscription.',
      emailNotice: "Vous recevrez un email de confirmation avec les détails de l'événement et votre lien d'accès.",
      checkSpam: 'Veuillez vérifier votre boîte de réception (et les spams).',
      home: "Retour à l'accueil",
    },
  };

  const t = content[locale] || content.en;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="text-6xl mb-6">✅</div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t.title}</h1>

        <p className="text-gray-600 mb-4">{t.message}</p>

        <div className="bg-indigo-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-indigo-800">{t.emailNotice}</p>
          <p className="text-xs text-indigo-600 mt-2">{t.checkSpam}</p>
        </div>

        <Link
          href="/"
          className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {t.home}
        </Link>
      </div>
    </div>
  );
}