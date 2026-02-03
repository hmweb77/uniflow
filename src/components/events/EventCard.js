'use client';

import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';

function parseDate(timestamp) {
  if (!timestamp) return new Date(0);
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
  return new Date(timestamp);
}

function getLowestPrice(event) {
  if (event.tickets && event.tickets.length > 0) {
    return Math.min(...event.tickets.map((t) => t.price || 0));
  }
  return event.price || 0;
}

export default function EventCard({ event, isUpcoming = true }) {
  const { locale, t } = useLocale();
  const price = getLowestPrice(event);
  const hasMultipleTickets = event.tickets && event.tickets.length > 1;

  const date = parseDate(event.date);
  const formattedDate = date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatLabel = {
    en: { live: 'Live', replay: 'Replay', materials: 'Materials', hybrid: 'Hybrid' },
    fr: { live: 'En direct', replay: 'Replay', materials: 'Supports', hybrid: 'Hybride' },
  };

  return (
    <Link
      href={`/e/${event.slug}`}
      className={`group surface card-hover overflow-hidden flex flex-col ${
        !isUpcoming ? 'opacity-75 hover:opacity-100' : ''
      }`}
    >
      {/* Banner */}
      <div className="h-52 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        {event.bannerUrl ? (
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, var(--color-gray-800), var(--color-gray-900))' }}
          />
        )}

        {/* Past overlay */}
        {!isUpcoming && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-4 py-2 bg-black/60 text-white text-sm font-medium rounded-full">
              {t.eventsPage?.eventEnded || 'Event Ended'}
            </span>
          </div>
        )}

        {/* Price badge */}
        <div
          className="absolute top-3 right-3 glass px-3 py-1 rounded-full"
        >
          {price === 0 ? (
            <span className="font-bold" style={{ color: 'var(--color-success)' }}>
              {t.common.free}
            </span>
          ) : (
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {hasMultipleTickets && `${t.common.from} `}
              {price} €
            </span>
          )}
        </div>

        {/* Language & Format badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="glass px-2.5 py-1 rounded-full text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {event.language === 'fr' ? 'FR' : 'EN'}
          </span>
          {event.format && (
            <span className="glass px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              {event.format === 'live' && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
              {(formatLabel[locale] || formatLabel.en)[event.format] || event.format}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-1">
        <h3
          className="text-lg font-semibold mb-2 line-clamp-2 group-hover:text-[var(--color-primary-600)] transition-colors"
          style={{ color: 'var(--text-primary)' }}
        >
          {event.title}
        </h3>

        {event.organizer && (
          <p className="text-sm mb-2" style={{ color: 'var(--color-primary-600)' }}>
            {event.organizer}
          </p>
        )}

        <div className="flex items-center gap-3 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          <span>{formattedDate}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>|</span>
          <span>{formattedTime}</span>
        </div>

        <p className="text-sm line-clamp-2 mb-4 flex-1" style={{ color: 'var(--text-secondary)' }}>
          {event.description || (locale === 'fr' ? 'Rejoignez ce cours en ligne !' : 'Join this amazing online class!')}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <span
            className="font-medium"
            style={{ color: isUpcoming ? 'var(--color-primary-600)' : 'var(--text-tertiary)' }}
          >
            {isUpcoming
              ? (t.eventsPage?.registerNow || 'Register Now →')
              : (t.eventsPage?.viewDetails || 'View Details →')
            }
          </span>
          {hasMultipleTickets && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {event.tickets.length} {t.eventsPage?.ticketOptions || 'ticket options'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}