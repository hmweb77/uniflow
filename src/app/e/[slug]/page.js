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

  // Registration form
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);

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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventTitle: event.title,
          price: event.price,
          customerName: formData.name,
          customerSurname: formData.surname,
          customerEmail: formData.email,
          locale,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to proceed to payment. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-500">The event you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

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
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {event.title}
          </h1>

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
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-3">
              {locale === 'fr' ? 'À propos' : 'About'}
            </h2>
            <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Price Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-500">{t.common.price}</p>
              <p className="text-3xl font-bold text-gray-900">{event.price} €</p>
            </div>
            <div className="text-4xl">🎓</div>
          </div>

          {!showRegistration ? (
            <button
              onClick={() => setShowRegistration(true)}
              className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-lg"
            >
              {t.common.bookNow}
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.registration.email} *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder={t.registration.emailPlaceholder}
                />
              </div>

              <p className="text-xs text-gray-500">{t.registration.termsNotice}</p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting
                  ? t.common.loading
                  : `${t.registration.proceedToPayment} - ${event.price} €`}
              </button>

              <button
                type="button"
                onClick={() => setShowRegistration(false)}
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