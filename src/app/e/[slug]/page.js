// src/app/e/[slug]/page.js

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useLocale } from '@/contexts/LocaleContext';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';

export default function PublicEventPage() {
  const params = useParams();
  const slug = params.slug;
  const { locale, setLocale, t } = useLocale();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    emailPrefix: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setEmailError('');
  };

  const validateEmail = () => {
    const emailDomain = event?.emailDomain?.trim();
    if (emailDomain) {
      if (!formData.emailPrefix || formData.emailPrefix.length < 2) {
        setEmailError(t.eventDetail?.enterEmailPrefix || 'Please enter your email prefix');
        return null;
      }
      return `${formData.emailPrefix}@${emailDomain}`;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setEmailError(t.eventDetail?.invalidEmail || 'Please enter a valid email address');
      return null;
    }
    return formData.email;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) {
      setError(t.eventDetail?.selectTicketError || 'Please select a ticket');
      return;
    }
    const validatedEmail = validateEmail();
    if (!validatedEmail) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventTitle: event.title,
          price: selectedTicket.price,
          ticketId: selectedTicket.id,
          ticketName: selectedTicket.name,
          customerName: formData.name,
          customerSurname: formData.surname,
          customerEmail: validatedEmail,
          locale,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert(t.eventDetail?.paymentFailed || 'Failed to proceed to payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFormatLabel = (format) => {
    const labels = {
      en: { live: 'Live Session', replay: 'Replay', materials: 'Materials Only', hybrid: 'Live + Materials' },
      fr: { live: 'En direct', replay: 'Replay', materials: 'Supports uniquement', hybrid: 'Live + Supports' },
    };
    return labels[locale]?.[format] || format;
  };

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
  if (error || !event) {
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

  const tickets = event.tickets || [];
  const hasEmailRestriction = event.emailDomain && event.emailDomain.trim().length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* ─── Top bar ───────────────────────────────────────── */}
      <div
        className="sticky top-0 z-50 glass border-b"
        style={{ borderColor: 'var(--border-light)' }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-1">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* ─── Banner ────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden mb-6 shadow-sm"
          style={{ backgroundColor: 'var(--bg-inverse)' }}
        >
          {event.bannerUrl ? (
            <img
              src={event.bannerUrl}
              alt={event.title}
              className="w-full h-auto max-h-[420px] object-contain mx-auto"
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
                {event.format === 'live' && (
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
            className="text-2xl md:text-3xl font-bold leading-tight mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {event.title}
          </h1>

          {event.organizer && (
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t.eventDetail?.by || 'By'}{' '}
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {event.organizer}
              </span>
            </p>
          )}

          {/* Date & Time */}
          <div className="flex items-center gap-5" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 flex-shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{formatDate(event.date)}</span>
            </div>
            <div
              className="w-px h-4"
              style={{ backgroundColor: 'var(--border-default)' }}
            />
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 flex-shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatTime(event.date)}</span>
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
                className="rounded-xl p-5 border"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-light)',
                }}
              >
                <h2
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t.eventDetail?.about || 'About'}
                </h2>
                <p
                  className="text-[15px] leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {event.description}
                </p>
              </div>
            )}

            {/* Who is this for */}
            {event.whoThisIsFor && (
              <div
                className="rounded-xl p-5 border"
                style={{
                  backgroundColor: 'var(--color-primary-50)',
                  borderColor: 'var(--color-primary-100)',
                }}
              >
                <h2
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-primary-400)' }}
                >
                  {t.eventDetail?.whoIsThisFor || 'Who is this for?'}
                </h2>
                <p
                  className="text-[15px] leading-relaxed"
                  style={{ color: 'var(--color-primary-800)' }}
                >
                  {event.whoThisIsFor}
                </p>
              </div>
            )}
          </div>

          {/* Right: ticket selection — sticky on desktop */}
          <div className="md:w-[340px] md:sticky md:top-[72px]">
            <div
              className="rounded-xl border overflow-hidden"
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
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t.eventDetail?.bookYourSpot || 'Book your spot'}
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
                        setSelectedTicket(ticket);
                        setShowRegistration(true);
                      }}
                      className="relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-150"
                      style={{
                        borderColor: isSelected
                          ? 'var(--text-primary)'
                          : 'var(--border-default)',
                        backgroundColor: isSelected
                          ? 'var(--bg-secondary)'
                          : 'var(--bg-primary)',
                      }}
                    >
                      {/* Selection indicator */}
                      <div
                        className="absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
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
                            className="w-3 h-3"
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

                      <div className="pr-8">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span
                            className="text-lg font-bold"
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

              {/* ─── Registration Form ─────────────────────── */}
              {showRegistration && selectedTicket && (
                <form
                  onSubmit={handleSubmit}
                  className="border-t p-5 space-y-3.5"
                  style={{ borderColor: 'var(--border-light)' }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        className="block text-xs font-medium mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t.registration?.name || 'First Name'}
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="input py-2.5 text-sm"
                        placeholder={t.registration?.namePlaceholder || 'Enter your first name'}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-xs font-medium mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t.registration?.surname || 'Last Name'}
                      </label>
                      <input
                        type="text"
                        name="surname"
                        value={formData.surname}
                        onChange={handleInputChange}
                        required
                        className="input py-2.5 text-sm"
                        placeholder={t.registration?.surnamePlaceholder || 'Enter your last name'}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t.registration?.email || 'Email'}
                    </label>

                    {hasEmailRestriction ? (
                      <div className="flex">
                        <input
                          type="text"
                          name="emailPrefix"
                          value={formData.emailPrefix}
                          onChange={handleInputChange}
                          required
                          className="input py-2.5 text-sm rounded-r-none"
                          style={{
                            borderColor: emailError
                              ? 'var(--color-error)'
                              : undefined,
                          }}
                          placeholder={t.registration?.emailPrefixPlaceholder || 'firstname.lastname'}
                        />
                        <span
                          className="px-3 py-2.5 border border-l-0 rounded-r-lg text-xs flex items-center whitespace-nowrap"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            borderColor: 'var(--border-default)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          @{event.emailDomain}
                        </span>
                      </div>
                    ) : (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="input py-2.5 text-sm"
                        style={{
                          borderColor: emailError
                            ? 'var(--color-error)'
                            : undefined,
                        }}
                        placeholder={t.registration?.emailPlaceholder || 'Enter your email'}
                      />
                    )}

                    {emailError && (
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-error)' }}
                      >
                        {emailError}
                      </p>
                    )}

                    {hasEmailRestriction && (
                      <p
                        className="text-[11px] mt-1"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {(t.eventDetail?.emailRestriction || 'Only @{domain} addresses accepted').replace(
                          '{domain}',
                          event.emailDomain
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary btn-lg w-full"
                  >
                    {submitting
                      ? (t.common?.loading || 'Loading...')
                      : `${t.eventDetail?.pay || 'Pay'} ${selectedTicket.price} €`}
                  </button>

                  <p
                    className="text-[11px] text-center leading-relaxed"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t.registration?.termsNotice || 'By registering, you agree to receive event-related emails.'}
                  </p>
                </form>
              )}

              {/* Not yet selected — prompt */}
              {!showRegistration && tickets.length > 0 && (
                <div className="p-4 pt-0">
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
                </div>
              )}
            </div>
          </div>
        </div>

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