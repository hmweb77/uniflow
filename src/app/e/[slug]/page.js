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

  // Registration form
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    emailPrefix: '', // For domain-restricted emails
  });
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  const t = getTranslations(locale);

  useEffect(() => {
    if (slug) {
      fetchEvent();
    }
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

        // Auto-select first ticket if only one exists
        if (eventData.tickets && eventData.tickets.length === 1) {
          setSelectedTicket(eventData.tickets[0]);
        }
        // Legacy: create ticket from price if no tickets array
        else if (!eventData.tickets && eventData.price) {
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

    // If domain restriction exists
    if (emailDomain) {
      const fullEmail = `${formData.emailPrefix}@${emailDomain}`;
      // Basic validation
      if (!formData.emailPrefix || formData.emailPrefix.length < 2) {
        setEmailError(
          locale === 'fr'
            ? 'Veuillez entrer votre identifiant email'
            : 'Please enter your email prefix'
        );
        return null;
      }
      return fullEmail;
    }

    // No domain restriction - validate full email
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
      setError(locale === 'fr' ? 'Veuillez sélectionner un ticket' : 'Please select a ticket');
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
    const options = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', options);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFormatIcon = (format) => {
    switch (format) {
      case 'live':
        return '🔴';
      case 'replay':
        return '📹';
      case 'materials':
        return '📚';
      case 'hybrid':
        return '🎯';
      default:
        return '🎓';
    }
  };

  const getFormatLabel = (format) => {
    const labels = {
      en: {
        live: 'Live Session',
        replay: 'Replay / Recording',
        materials: 'Materials Only',
        hybrid: 'Live + Materials',
      },
      fr: {
        live: 'Session en direct',
        replay: 'Replay / Enregistrement',
        materials: 'Supports uniquement',
        hybrid: 'Live + Supports',
      },
    };
    return labels[locale]?.[format] || format;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {locale === 'fr' ? 'Événement non trouvé' : 'Event Not Found'}
          </h1>
          <p className="text-gray-500">
            {locale === 'fr'
              ? "L'événement que vous cherchez n'existe pas."
              : "The event you're looking for doesn't exist."}
          </p>
        </div>
      </div>
    );
  }

  const tickets = event.tickets || [];
  const hasEmailRestriction = event.emailDomain && event.emailDomain.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Language Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}
          className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium shadow-sm hover:bg-white transition-colors"
        >
          {locale === 'en' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </button>
      </div>

      {/* Banner */}
      <div className="h-64 md:h-80 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative">
        {event.bannerUrl && (
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/30"></div>

        {/* Logo */}
        {event.logoUrl && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
            <div className="w-24 h-24 bg-white rounded-xl shadow-lg p-2">
              <img
                src={event.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`max-w-2xl mx-auto px-4 py-12 ${event.logoUrl ? 'pt-16' : ''}`}>
        {/* Title & Meta */}
        <div className="text-center mb-8">
          {/* Format badge */}
          {event.format && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-4">
              {getFormatIcon(event.format)} {getFormatLabel(event.format)}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {event.title}
          </h1>

          {/* Organizer */}
          {event.organizer && (
            <p className="text-gray-600 mb-4">
              {locale === 'fr' ? 'Par' : 'By'} <span className="font-medium">{event.organizer}</span>
            </p>
          )}

          {/* Date & Time */}
          <div className="flex items-center justify-center gap-4 text-gray-600">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span>{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🕐</span>
              <span>{formatTime(event.date)}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">
              {locale === 'fr' ? 'À propos' : 'About'}
            </h2>
            <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Who This Is For */}
        {event.whoThisIsFor && (
          <div className="bg-indigo-50 rounded-xl p-6 mb-6">
            <h2 className="font-semibold text-indigo-900 mb-2">
              {locale === 'fr' ? '👤 Pour qui ?' : '👤 Who is this for?'}
            </h2>
            <p className="text-indigo-700">{event.whoThisIsFor}</p>
          </div>
        )}

        {/* Tickets Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">
            {locale === 'fr' ? '🎫 Choisir un ticket' : '🎫 Select a Ticket'}
          </h2>

          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setShowRegistration(true);
                }}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedTicket?.id === ticket.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{ticket.name}</h3>
                  <span className="text-xl font-bold text-indigo-600">
                    {ticket.price} €
                  </span>
                </div>

                {ticket.description && (
                  <p className="text-sm text-gray-500 mb-3">{ticket.description}</p>
                )}

                {ticket.includes && ticket.includes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ticket.includes.map((item, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full"
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Registration Form */}
          {showRegistration && selectedTicket && (
            <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-gray-200 space-y-4">
              <h3 className="font-semibold text-gray-900">
                {locale === 'fr' ? 'Vos informations' : 'Your Information'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.registration.name} *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder={t.registration.namePlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.registration.surname} *
                  </label>
                  <input
                    type="text"
                    name="surname"
                    value={formData.surname}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder={t.registration.surnamePlaceholder}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.registration.email} *
                </label>

                {hasEmailRestriction ? (
                  // Domain-restricted email input
                  <div className="flex items-center">
                    <input
                      type="text"
                      name="emailPrefix"
                      value={formData.emailPrefix}
                      onChange={handleInputChange}
                      required
                      className={`flex-1 px-4 py-3 border rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                        emailError ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder={locale === 'fr' ? 'prenom.nom' : 'firstname.lastname'}
                    />
                    <span className="px-4 py-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                      @{event.emailDomain}
                    </span>
                  </div>
                ) : (
                  // Standard email input
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                      emailError ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder={t.registration.emailPlaceholder}
                  />
                )}

                {emailError && (
                  <p className="text-red-500 text-sm mt-1">{emailError}</p>
                )}

                {hasEmailRestriction && (
                  <p className="text-xs text-gray-400 mt-1">
                    {locale === 'fr'
                      ? `Seules les adresses @${event.emailDomain} sont acceptées`
                      : `Only @${event.emailDomain} addresses are accepted`}
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-500">{t.registration.termsNotice}</p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting
                  ? t.common.loading
                  : `${t.registration.proceedToPayment} - ${selectedTicket.price} €`}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRegistration(false);
                  setSelectedTicket(null);
                }}
                className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                {t.common.cancel}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400">
          <p>Powered by Uniflow</p>
        </div>
      </div>
    </div>
  );
}