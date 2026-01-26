// src/app/success/page.js

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const [locale, setLocale] = useState('en');
  const [eventId, setEventId] = useState(null);
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);

  useEffect(() => {
    const lang = searchParams.get('lang');
    const event = searchParams.get('event');
    if (lang) setLocale(lang);
    if (event) setEventId(event);
  }, [searchParams]);

  const content = {
    en: {
      title: '🎉 Payment Successful!',
      message: 'Thank you for your registration.',
      emailNotice:
        'You will receive a confirmation email shortly with the event details and your access link.',
      checkSpam: 'Please check your inbox (and spam folder).',
      addToCalendar: 'Add to Calendar',
      home: 'Back to Home',
      calendarOptions: {
        google: 'Google Calendar',
        outlook: 'Outlook',
        yahoo: 'Yahoo Calendar',
        ics: 'Download .ics File',
      },
    },
    fr: {
      title: '🎉 Paiement réussi !',
      message: 'Merci pour votre inscription.',
      emailNotice:
        "Vous recevrez un email de confirmation avec les détails de l'événement et votre lien d'accès.",
      checkSpam: 'Veuillez vérifier votre boîte de réception (et les spams).',
      addToCalendar: 'Ajouter au calendrier',
      home: "Retour à l'accueil",
      calendarOptions: {
        google: 'Google Calendar',
        outlook: 'Outlook',
        yahoo: 'Yahoo Calendar',
        ics: 'Télécharger le fichier .ics',
      },
    },
  };

  const t = content[locale] || content.en;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

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

        {/* Add to Calendar Section */}
        {eventId && (
          <div className="mb-6">
            <button
              onClick={() => setShowCalendarOptions(!showCalendarOptions)}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              type="button"
            >
              <span>📅</span>
              <span>{t.addToCalendar}</span>
              <span className={`transition-transform ${showCalendarOptions ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showCalendarOptions && (
              <div className="mt-3 space-y-2">
                {/* Google Calendar */}
                <a
                  href={`/api/calendar/redirect/${eventId}?provider=google`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <span className="text-xl">📆</span>
                  <span className="text-gray-700">{t.calendarOptions.google}</span>
                </a>

                {/* Outlook */}
                <a
                  href={`/api/calendar/redirect/${eventId}?provider=outlook`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <span className="text-xl">📧</span>
                  <span className="text-gray-700">{t.calendarOptions.outlook}</span>
                </a>

                {/* Yahoo */}
                <a
                  href={`/api/calendar/redirect/${eventId}?provider=yahoo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <span className="text-xl">📅</span>
                  <span className="text-gray-700">{t.calendarOptions.yahoo}</span>
                </a>

                {/* ICS Download */}
                <a
                  href={`/api/calendar/${eventId}`}
                  download
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <span className="text-xl">⬇️</span>
                  <span className="text-gray-700">{t.calendarOptions.ics}</span>
                </a>
              </div>
            )}
          </div>
        )}

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

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}