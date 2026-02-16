// src/app/success/page.js
// Professional confirmation page - sober, no emojis

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
    const category = searchParams.get('category');
    if (lang && (lang === 'en' || lang === 'fr')) setLocale(lang);
    if (event) setEventId(event);
  }, [searchParams, setLocale]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#f5f5f7' }}
    >
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#1a1a2e',
              padding: '32px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ color: '#ffffff', margin: 0, fontSize: '22px', fontWeight: 600 }}>
              {locale === 'fr' ? 'Inscription confirmee' : 'Registration Confirmed'}
            </h1>
          </div>

          {/* Body */}
          <div style={{ padding: '32px 24px' }}>
            <p style={{ color: '#48485c', fontSize: '15px', textAlign: 'center', margin: '0 0 24px 0', lineHeight: '1.6' }}>
              {locale === 'fr'
                ? 'Merci pour votre inscription. Vous recevrez un email de confirmation avec les details de votre cours et le lien d\'acces.'
                : 'Thank you for registering. You will receive a confirmation email with the event details and your access link.'}
            </p>

            {/* Spam Notice */}
            <div
              style={{
                backgroundColor: '#f5f5f7',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                border: '1px solid #e8e8ed',
              }}
            >
              <p style={{ color: '#1a1a2e', fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', textAlign: 'center' }}>
                {locale === 'fr' ? 'Verifiez votre boite mail' : 'Check your inbox'}
              </p>
              <p style={{ color: '#6e6e80', fontSize: '13px', margin: 0, textAlign: 'center' }}>
                {locale === 'fr'
                  ? 'Si vous ne trouvez pas l\'email, pensez a verifier votre dossier spam ou courrier indesirable.'
                  : 'If you don\'t see the email, please check your spam or junk folder.'}
              </p>
            </div>

            {/* Calendar Section */}
            {eventId && (
              <div style={{ marginBottom: '24px' }}>
                <button
                  onClick={() => setShowCalendarOptions(!showCalendarOptions)}
                  type="button"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#f5f5f7',
                    border: '1px solid #e8e8ed',
                    borderRadius: '8px',
                    color: '#1a1a2e',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{locale === 'fr' ? 'Ajouter au calendrier' : 'Add to Calendar'}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6e6e80"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: showCalendarOptions ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showCalendarOptions && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <a
                      href={`/api/calendar/redirect/${eventId}?provider=google`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '10px 16px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e8e8ed',
                        borderRadius: '6px',
                        color: '#1a1a2e',
                        textDecoration: 'none',
                        fontSize: '14px',
                      }}
                    >
                      Google Calendar
                    </a>
                    <a
                      href={`/api/calendar/redirect/${eventId}?provider=outlook`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '10px 16px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e8e8ed',
                        borderRadius: '6px',
                        color: '#1a1a2e',
                        textDecoration: 'none',
                        fontSize: '14px',
                      }}
                    >
                      Outlook
                    </a>
                    <a
                      href={`/api/calendar/${eventId}`}
                      download
                      style={{
                        display: 'block',
                        padding: '10px 16px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e8e8ed',
                        borderRadius: '6px',
                        color: '#1a1a2e',
                        textDecoration: 'none',
                        fontSize: '14px',
                      }}
                    >
                      {locale === 'fr' ? 'Telecharger fichier .ics' : 'Download .ics File'}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                href="/classes"
                style={{
                  display: 'block',
                  padding: '14px',
                  backgroundColor: '#1a1a2e',
                  color: '#ffffff',
                  textAlign: 'center',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '15px',
                }}
              >
                {locale === 'fr' ? 'Voir tous les cours' : 'View All Classes'}
              </Link>
              <Link
                href="/"
                style={{
                  display: 'block',
                  padding: '14px',
                  backgroundColor: '#f5f5f7',
                  color: '#48485c',
                  textAlign: 'center',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '15px',
                  border: '1px solid #e8e8ed',
                }}
              >
                {locale === 'fr' ? 'Retour a l\'accueil' : 'Back to Home'}
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: '#6e6e80', fontSize: '12px', marginTop: '24px' }}>
          Uniflow
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f5f7' }}>
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a1a2e', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
