// src/app/e/[slug]/page.js

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getTranslations } from '@/i18n';

export default function PublicEventPage() {
  const params = useParams();
  const slug = params.slug;

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locale, setLocale] = useState('en');
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

  const t = getTranslations(locale);

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
        setLocale(eventData.language || 'en');

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
        setEmailError(
          locale === 'fr'
            ? 'Veuillez entrer votre identifiant email'
            : 'Please enter your email prefix'
        );
        return null;
      }
      return `${formData.emailPrefix}@${emailDomain}`;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setEmailError(
        locale === 'fr'
          ? 'Veuillez entrer une adresse email valide'
          : 'Please enter a valid email address'
      );
      return null;
    }
    return formData.email;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) {
      setError(
        locale === 'fr' ? 'Veuillez sélectionner un ticket' : 'Please select a ticket'
      );
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
      alert(
        locale === 'fr'
          ? 'Échec du paiement. Veuillez réessayer.'
          : 'Failed to proceed to payment. Please try again.'
      );
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
      en: {
        live: 'Live Session',
        replay: 'Replay',
        materials: 'Materials Only',
        hybrid: 'Live + Materials',
      },
      fr: {
        live: 'En direct',
        replay: 'Replay',
        materials: 'Supports uniquement',
        hybrid: 'Live + Supports',
      },
    };
    return labels[locale]?.[format] || format;
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-gray-200 border-t-gray-800 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Error
  if (error || !event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {locale === 'fr' ? 'Événement non trouvé' : 'Event not found'}
          </h1>
          <p className="text-gray-500 text-sm">
            {locale === 'fr'
              ? "Ce lien ne correspond à aucun événement."
              : "This link doesn't match any event."}
          </p>
        </div>
      </div>
    );
  }

  const tickets = event.tickets || [];
  const hasEmailRestriction = event.emailDomain && event.emailDomain.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-[13px] font-medium text-gray-400 tracking-wide uppercase">
            Uniflow
          </span>
          <button
            onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}
            className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors px-2.5 py-1 rounded-md hover:bg-gray-100"
          >
            {locale === 'en' ? 'Français' : 'English'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* Banner — contained, rounded, object-contain so full image shows */}
        <div className="rounded-2xl overflow-hidden mb-6 bg-gray-900 shadow-sm">
          {event.bannerUrl ? (
            <img
              src={event.bannerUrl}
              alt={event.title}
              className="w-full h-auto max-h-[420px] object-contain mx-auto"
            />
          ) : (
            <div className="aspect-[16/7] bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
          )}
        </div>

        {/* Event info — below the banner */}
        <div className="mb-8 px-1">
          {/* Format badge */}
          {event.format && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">
                {event.format === 'live' && (
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                )}
                {getFormatLabel(event.format)}
              </span>
            </div>
          )}

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-2">
            {event.title}
          </h1>

          {event.organizer && (
            <p className="text-gray-500 text-sm mb-4">
              {locale === 'fr' ? 'Par' : 'By'}{' '}
              <span className="text-gray-700 font-medium">{event.organizer}</span>
            </p>
          )}

          {/* Date & Time */}
          <div className="flex items-center gap-5 text-gray-600">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{formatDate(event.date)}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatTime(event.date)}</span>
            </div>
          </div>
        </div>

        {/* Two-column on desktop: content + sticky ticket sidebar */}
        <div className="md:flex md:gap-8 md:items-start">
          {/* Left: details */}
          <div className="md:flex-1 space-y-5 mb-8 md:mb-0">
            {/* Description */}
            {event.description && (
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {locale === 'fr' ? 'À propos' : 'About'}
                </h2>
                <p className="text-gray-700 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}

            {/* Who is this for */}
            {event.whoThisIsFor && (
              <div className="bg-blue-50/60 rounded-xl p-5 border border-blue-100/60">
                <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                  {locale === 'fr' ? 'Pour qui ?' : 'Who is this for?'}
                </h2>
                <p className="text-blue-800 text-[15px] leading-relaxed">
                  {event.whoThisIsFor}
                </p>
              </div>
            )}
          </div>

          {/* Right: ticket selection — sticky on desktop */}
          <div className="md:w-[340px] md:sticky md:top-[72px]">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">
                  {locale === 'fr' ? 'Réserver' : 'Book your spot'}
                </h2>
              </div>

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
                      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-150 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {/* Selection indicator */}
                      <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      <div className="pr-8">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-lg font-bold text-gray-900">
                            {ticket.price} €
                          </span>
                        </div>
                        <p className="font-medium text-sm text-gray-800">{ticket.name}</p>

                        {ticket.description && (
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                            {ticket.description}
                          </p>
                        )}

                        {ticket.includes && ticket.includes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {ticket.includes.map((item, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-md font-medium"
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

              {/* Registration Form — inside the ticket card */}
              {showRegistration && selectedTicket && (
                <form onSubmit={handleSubmit} className="border-t border-gray-100 p-5 space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {t.registration.name}
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all bg-gray-50/50 placeholder:text-gray-300"
                        placeholder={t.registration.namePlaceholder}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {t.registration.surname}
                      </label>
                      <input
                        type="text"
                        name="surname"
                        value={formData.surname}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all bg-gray-50/50 placeholder:text-gray-300"
                        placeholder={t.registration.surnamePlaceholder}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {t.registration.email}
                    </label>

                    {hasEmailRestriction ? (
                      <div className="flex">
                        <input
                          type="text"
                          name="emailPrefix"
                          value={formData.emailPrefix}
                          onChange={handleInputChange}
                          required
                          className={`flex-1 px-3 py-2.5 text-sm border rounded-l-lg focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all bg-gray-50/50 placeholder:text-gray-300 ${
                            emailError ? 'border-red-300' : 'border-gray-200'
                          }`}
                          placeholder={locale === 'fr' ? 'prenom.nom' : 'firstname.lastname'}
                        />
                        <span className="px-3 py-2.5 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-xs text-gray-500 flex items-center whitespace-nowrap">
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
                        className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all bg-gray-50/50 placeholder:text-gray-300 ${
                          emailError ? 'border-red-300' : 'border-gray-200'
                        }`}
                        placeholder={t.registration.emailPlaceholder}
                      />
                    )}

                    {emailError && (
                      <p className="text-red-500 text-xs mt-1">{emailError}</p>
                    )}

                    {hasEmailRestriction && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {locale === 'fr'
                          ? `Seules les adresses @${event.emailDomain} sont acceptées`
                          : `Only @${event.emailDomain} addresses accepted`}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 active:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting
                      ? (locale === 'fr' ? 'Chargement...' : 'Loading...')
                      : `${locale === 'fr' ? 'Payer' : 'Pay'} ${selectedTicket.price} €`}
                  </button>

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    {t.registration.termsNotice}
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
                    className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                  >
                    {selectedTicket
                      ? `${locale === 'fr' ? 'Continuer' : 'Continue'} — ${selectedTicket.price} €`
                      : locale === 'fr'
                      ? 'Choisissez un ticket'
                      : 'Select a ticket'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pb-8 text-center">
          <p className="text-xs text-gray-300">Powered by Uniflow</p>
        </div>
      </div>
    </div>
  );
}