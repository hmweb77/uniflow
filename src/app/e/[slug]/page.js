// src/app/e/[slug]/page.js

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useLocale } from '@/contexts/LocaleContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';
import RegistrationForm from '@/components/RegistrationForm';
import { useCart } from '@/contexts/CartContext';
import { cleanDashes } from '@/utils/textCleanup';
import { renderDescription } from '@/utils/descriptionFormat';
import { formatEventDate, formatEventTime } from '../../lib/utils';

function EventCountdownWidget({ date, label, locale }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = date?.toDate ? date.toDate() : new Date(date);
  if (target <= now) return null;

  const diff = target - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
    >
      <svg className="w-5 h-5 flex-shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div>
        <p className="text-sm font-semibold">{label || (locale === 'fr' ? 'Examen approche' : 'Exam approaching')}</p>
        <p className="text-xs opacity-80 font-mono">{days}d {hours}h {minutes}m</p>
      </div>
    </div>
  );
}

export default function PublicEventPage() {
  const params = useParams();
  const slug = params.slug;
  const { locale, setLocale, t } = useLocale();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const { addItem } = useCart();
  const [addedToCart, setAddedToCart] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);


  useEffect(() => {
    if (slug) fetchEvent();
  }, [slug]);

  const fetchEvent = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const eventQuery = query(eventsRef, where('slug', '==', slug));
      const eventSnap = await getDocs(eventQuery);

      if (!eventSnap.empty) {
        const eventDoc = eventSnap.docs[0];
        const eventData = { id: eventDoc.id, ...eventDoc.data() };
        setEvent(eventData);

        // Set locale to match event language
        if (eventData.language === 'fr' || eventData.language === 'en') {
          setLocale(eventData.language);
        }

        if (eventData.tickets && eventData.tickets.length === 1) {
          setSelectedTicket(eventData.tickets[0]);
        } else if (!eventData.tickets && eventData.price) {
          const legacyTicket = {
            id: 'default',
            name: 'General Admission',
            price: eventData.price,
            description: '',
            includes: [],
          };
          setEvent({ ...eventData, tickets: [legacyTicket] });
          setSelectedTicket(legacyTicket);
        }

        // Fetch related products
        const relIds = eventData.relatedProductIds || [];
        if (relIds.length > 0) {
          const relPromises = relIds.slice(0, 4).map(async (id) => {
            try {
              const relDoc = await getDoc(doc(db, 'products', id));
              if (relDoc.exists() && relDoc.data().status === 'published') {
                return { id: relDoc.id, ...relDoc.data() };
              }
            } catch {}
            return null;
          });
          const related = (await Promise.all(relPromises)).filter(Boolean);
          setRelatedProducts(related);
        }
      } else {
        setError('Event not found');
      }
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => formatEventDate(timestamp, locale, { long: true });
  const formatTime = (timestamp) => formatEventTime(timestamp, locale);

  const getFormatLabel = (format) => {
    const labels = {
      en: { live: 'Live Session', replay: 'Replay', materials: 'Materials Only', hybrid: 'Live + Materials' },
      fr: { live: 'En direct', replay: 'Replay', materials: 'Supports uniquement', hybrid: 'Live + Supports' },
    };
    return labels[locale]?.[format] || format;
  };

  // ─── Determine if event is in the past ─────────────────────
  const isPastEvent = (() => {
    if (!event?.date) return false;
    const date = event.date.toDate ? event.date.toDate() : new Date(event.date);
    return date < new Date();
  })();

  // ─── Sold out (manual flag or max tickets reached) ─────────
  const attendeeCount = event?.attendeeCount ?? 0;
  const maxTickets = event?.maxTickets != null ? Number(event.maxTickets) : null;
  const isSoldOut = event?.soldOut === true || (maxTickets != null && attendeeCount >= maxTickets);
  const registrationClosed = isPastEvent || isSoldOut;

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div
          className="w-8 h-8 border-[3px] rounded-full animate-spin"
          style={{
            borderColor: 'var(--border-default)',
            borderTopColor: 'var(--color-primary-500)',
          }}
        />
      </div>
    );
  }

  // ─── Error / Not found ─────────────────────────────────────
  if (error && !event) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="text-center max-w-md">
          <div
            className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: 'var(--text-tertiary)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {t.eventDetail?.eventNotFound || 'Event not found'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            {t.eventDetail?.eventNotFoundDesc || "This link doesn't match any event."}
          </p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const tickets = event.tickets || [];

  return (
    <div className="event-detail-page min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
   

      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* ─── Past event / Sold out banner ───────────────── */}
        {(isPastEvent || isSoldOut) && (
          <div
            className="event-card rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
            }}
          >
            <span className="text-2xl flex-shrink-0">⏰</span>
            <div>
              <p
                className="font-semibold text-sm"
                style={{ color: 'var(--text-primary)' }}
              >
                {isSoldOut && !isPastEvent
                  ? (locale === 'fr' ? 'Complet' : 'Sold Out')
                  : (locale === 'fr' ? 'Événement terminé' : 'Event Ended')}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {isSoldOut && !isPastEvent
                  ? (locale === 'fr' ? 'Les places sont épuisées. Inscriptions fermées.' : 'All spots are taken. Registration is closed.')
                  : (locale === 'fr'
                    ? 'Cet événement a déjà eu lieu. Les inscriptions sont fermées.'
                    : 'This event has already taken place. Registration is closed.')}
              </p>
            </div>
          </div>
        )}

        {/* ─── Banner ────────────────────────────────────── */}
        <div
          className="event-card rounded-2xl overflow-hidden mb-6 shadow-sm relative"
          style={{ backgroundColor: 'var(--bg-inverse)' }}
        >
          {event.bannerUrl ? (
            <img
              src={event.bannerUrl}
              alt={event.title}
              className={`w-full h-auto max-h-[420px] object-contain mx-auto ${isPastEvent ? 'opacity-60' : ''}`}
            />
          ) : (
            <div
              className="aspect-[16/7]"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-gray-800), var(--color-gray-900))',
              }}
            />
          )}

          {/* Past overlay on banner */}
          {isPastEvent && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="px-5 py-2.5 bg-black/60 text-white text-sm font-semibold rounded-full">
                {locale === 'fr' ? 'Événement terminé' : 'Event Ended'}
              </span>
            </div>
          )}
        </div>

        {/* ─── Event info ────────────────────────────────── */}
        <div className="mb-8 px-1">
          {/* Format badge */}
          {event.format && (
            <div className="mb-3">
              <span
                className="badge"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {event.format === 'live' && !isPastEvent && (
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: 'var(--color-error)' }}
                  />
                )}
                {getFormatLabel(event.format)}
              </span>
            </div>
          )}

          <h1
            className="event-page-title text-2xl md:text-3xl font-bold leading-tight mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {cleanDashes(event.title)}
          </h1>

          {event.organizer && (
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t.eventDetail?.by || 'By'}{' '}
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {cleanDashes(event.organizer)}
              </span>
            </p>
          )}

          {/* Date & Time — prominent */}
          <div
            className="flex items-center gap-6 py-4 px-5 rounded-xl"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div className="flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  {locale === 'fr' ? 'Date' : 'Date'}
                </p>
                <p className="text-lg font-semibold leading-tight">{formatDate(event.date)}</p>
              </div>
            </div>
            <div className="w-px h-12" style={{ backgroundColor: 'var(--border-default)' }} />
            <div className="flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  {locale === 'fr' ? 'Heure' : 'Time'}
                </p>
                <p className="text-lg font-semibold leading-tight">{formatTime(event.date)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Two-column: content + sticky ticket sidebar ── */}
        <div className="md:flex md:gap-8 md:items-start">
          {/* Left: details */}
          <div className="md:flex-1 space-y-5 mb-8 md:mb-0">
            {/* Description */}
            {event.description && (
              <div
                className="event-card rounded-xl p-5 border event-description"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-light)',
                }}
              >
                <h2
                  className="event-section-label text-xs font-semibold uppercase tracking-wider mb-3"
                 
                >
                  {t.eventDetail?.about || 'About'}
                </h2>
                <div
                  className="text-[15px] leading-relaxed event-description-content"
                  style={{ color: 'var(--text-secondary)' }}
                  dangerouslySetInnerHTML={{ __html: renderDescription(cleanDashes(event.description)) }}
                />
              </div>
            )}

            {/* Who is this for */}
            {event.whoThisIsFor && (
              <div
                className="event-card event-card-who rounded-xl p-5 border"
                style={{
                  backgroundColor: 'var(--color-primary-50)',
                  borderColor: 'var(--color-primary-100)',
                }}
              >
                <h2
                  className="event-section-label text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-primary-400)' }}
                >
                  {t.eventDetail?.whoIsThisFor || 'Who is this for?'}
                </h2>
                <p
                  className="text-[15px] leading-relaxed event-card-who-body "
            
                >
                  {event.whoThisIsFor}
                </p>
              </div>
            )}
          </div>

          {/* Right: ticket selection — sticky on desktop */}
          <div className="md:w-[340px] md:sticky md:top-[72px]">
            <div
              className="event-card event-ticket-card rounded-xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Header */}
              <div
                className="p-5 border-b"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <h2
                  className="event-section-label text-sm font-semibold"
                  style={{ color: registrationClosed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
                >
                  {registrationClosed
                    ? (locale === 'fr' ? 'Inscriptions fermées' : 'Registration Closed')
                    : (t.eventDetail?.bookYourSpot || 'Book your spot')}
                </h2>
              </div>

              {/* Ticket options */}
              <div className="p-4 space-y-3">
                {tickets.map((ticket) => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => {
                        if (registrationClosed) return;
                        setSelectedTicket(ticket);
                        setShowRegistration(true);
                      }}
                      className={`ticket-option relative p-4 rounded-lg border-2 transition-all duration-150 ${
                        isSelected ? 'ticket-option-selected' : ''
                      } ${
                        registrationClosed
                          ? 'opacity-50 cursor-default'
                          : 'cursor-pointer'
                      }`}
                      style={{
                        borderColor: registrationClosed
                          ? 'var(--border-default)'
                          : isSelected
                            ? 'var(--text-primary)'
                            : 'var(--border-default)',
                        backgroundColor: registrationClosed
                          ? 'var(--bg-secondary)'
                          : isSelected
                            ? 'var(--bg-secondary)'
                            : 'var(--bg-primary)',
                      }}
                    >
                      {/* Selection indicator — hidden for past events */}
                      {!registrationClosed && (
                        <div
                          className={`ticket-option-indicator absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'ticket-option-indicator-selected' : ''}`}
                          style={{
                            borderColor: isSelected
                              ? 'var(--text-primary)'
                              : 'var(--border-default)',
                            backgroundColor: isSelected
                              ? 'var(--text-primary)'
                              : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 ticket-option-check"
                              style={{ color: 'var(--bg-primary)' }}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      )}

                      <div className={registrationClosed ? '' : 'pr-8'}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span
                            className={`text-lg font-bold ${registrationClosed ? 'line-through' : ''}`}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {ticket.price} €
                          </span>
                        </div>
                        <p
                          className="font-medium text-sm"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {ticket.name}
                        </p>

                        {ticket.description && (
                          <p
                            className="text-xs mt-1.5 leading-relaxed"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {ticket.description}
                          </p>
                        )}

                        {ticket.includes && ticket.includes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {ticket.includes.map((item, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-[11px] rounded-md font-medium"
                                style={{
                                  backgroundColor: 'var(--bg-tertiary)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ─── Error message (inline) ─────────────────── */}
              {error && event && (
                <div className="px-4 pb-2">
                  <div
                    className="rounded-lg px-4 py-3 text-sm"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.08)',
                      color: 'var(--color-error)',
                    }}
                  >
                    {error}
                  </div>
                </div>
              )}

              {/* ─── Past event notice ─────────────────────── */}
              {registrationClosed && (
                <div
                  className="p-5 text-center border-t"
                  style={{ borderColor: 'var(--border-light)' }}
                >
                 
                  <p
                    className="text-xl font-medium mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {isSoldOut && !isPastEvent
                      ? (locale === 'fr' ? 'Complet' : 'Sold out')
                      : (locale === 'fr' ? 'Événement terminé' : 'Event has ended')}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {locale === 'fr'
                      ? 'Les inscriptions sont fermées pour cet événement.'
                      : 'Registration is no longer available for this event.'}
                  </p>
                </div>
              )}

              {/* ─── Registration Form (only when not closed) ── */}
              {!registrationClosed && showRegistration && selectedTicket && (
                <div className="event-registration-form border-t p-5" style={{ borderColor: 'var(--border-light)' }}>
                <RegistrationForm
                  event={event}
                  selectedTicket={selectedTicket}
                  locale={locale}
                  t={t}
                  onSuccess={(url) => { window.location.href = url; }}
                  onError={setError}
                />
                </div>
              )}

              {/* Not yet selected — prompt (only for upcoming events) */}
              {!registrationClosed && !showRegistration && tickets.length > 0 && (
                <div className="p-4 pt-0 space-y-2">
                  <button
                    onClick={() => {
                      if (selectedTicket) setShowRegistration(true);
                    }}
                    disabled={!selectedTicket}
                    className={`w-full ${
                      selectedTicket
                        ? 'btn btn-primary btn-lg'
                        : 'btn btn-lg cursor-not-allowed opacity-50'
                    }`}
                    style={
                      !selectedTicket
                        ? {
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-tertiary)',
                          }
                        : undefined
                    }
                  >
                    {selectedTicket
                      ? `${t.eventDetail?.continue || 'Continue'} — ${selectedTicket.price} €`
                      : t.eventDetail?.selectTicket || 'Select a ticket'}
                  </button>

                  {selectedTicket && (
                    <button
                      type="button"
                      onClick={() => {
                        addItem({
                          id: event.id,
                          type: 'event',
                          title: event.title,
                          price: Number(selectedTicket.price) || 0,
                          subject: event.subject || '',
                          bannerUrl: event.bannerUrl || '',
                          slug: event.slug,
                          ticketId: selectedTicket.id,
                          ticketName: selectedTicket.name,
                        });
                        setAddedToCart(true);
                        setTimeout(() => setAddedToCart(false), 2000);
                      }}
                      className="w-full btn btn-lg font-medium transition-colors"
                      style={{
                        backgroundColor: addedToCart ? '#16a34a' : 'var(--bg-tertiary)',
                        color: addedToCart ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-default)',
                      }}
                    >
                      {addedToCart
                        ? (locale === 'fr' ? 'Ajouté au panier' : 'Added to Cart')
                        : (locale === 'fr' ? 'Ajouter au panier' : 'Add to Cart')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Countdown widget ───────────────────────────── */}
        {event.countdownDate && (() => {
          const target = event.countdownDate?.toDate ? event.countdownDate.toDate() : new Date(event.countdownDate);
          if (target <= new Date()) return null;
          return (
            <div className="mt-8">
              <EventCountdownWidget date={event.countdownDate} label={event.countdownLabel} locale={locale} />
            </div>
          );
        })()}

        {/* ─── Related products ──────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {locale === 'fr' ? 'Produits recommandés' : 'Recommended for you'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {relatedProducts.map((rp) => (
                <a
                  key={rp.id}
                  href={`/p/${rp.slug}`}
                  className="block rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
                >
                  <div className="h-24 overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    {rp.bannerUrl ? (
                      <img src={rp.bannerUrl} alt={rp.title} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #2d2d3f, #1a1a2e)' }} />
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-semibold line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>{rp.title}</h4>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-primary-600)' }}>
                      {rp.price === 0 ? (locale === 'fr' ? 'Gratuit' : 'Free') : `${rp.price} EUR`}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ─── Footer ──────────────────────────────────────── */}
        <div className="mt-16 pb-8 text-center">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t.common?.poweredBy || 'Powered by Uniflow'}
          </p>
        </div>
      </div>
    </div>
  );
}