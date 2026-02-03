'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

function SuccessContent() {
  const searchParams = useSearchParams();
  const { locale, setLocale, t } = useLocale();
  const [eventId, setEventId] = useState(null);
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);

  const s = t.success || {};

  useEffect(() => {
    const lang = searchParams.get('lang');
    const event = searchParams.get('event');
    if (lang && (lang === 'en' || lang === 'fr')) setLocale(lang);
    if (event) setEventId(event);
  }, [searchParams, setLocale]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #10b981, #059669, #047857)' }}
    >
      <div className="surface-elevated max-w-md w-full p-8 text-center">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{s.title}</h1>
        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>{s.message}</p>

        <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-800)' }}>
          <p className="text-sm">{s.emailNotice}</p>
          <p className="text-xs mt-2 opacity-75">{s.checkSpam}</p>
        </div>

        {eventId && (
          <div className="mb-6">
            <button
              onClick={() => setShowCalendarOptions(!showCalendarOptions)}
              className="btn btn-secondary btn-md w-full"
              type="button"
            >
              📅 {s.addToCalendar}
              <span className={`transition-transform ${showCalendarOptions ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showCalendarOptions && (
              <div className="mt-3 space-y-2">
                <a href={`/api/calendar/redirect/${eventId}?provider=google`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm w-full justify-start">
                  📆 {s.google}
                </a>
                <a href={`/api/calendar/redirect/${eventId}?provider=outlook`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm w-full justify-start">
                  📧 {s.outlook}
                </a>
                <a href={`/api/calendar/${eventId}`} download className="btn btn-secondary btn-sm w-full justify-start">
                  ⬇️ {s.ics}
                </a>
              </div>
            )}
          </div>
        )}

        <Link href="/" className="btn btn-primary btn-lg">
          {s.home}
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}