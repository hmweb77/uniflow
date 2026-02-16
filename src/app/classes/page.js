// src/app/classes/page.js
// Student-facing classes page with categories (B1, B2, etc.)

'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';

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

export default function ClassesPage() {
  const { locale, t } = useLocale();
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch categories
      try {
        const catsRef = collection(db, 'categories');
        const catsSnap = await getDocs(catsRef);
        const catsData = catsSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setCategories(catsData);
      } catch {
        // Default categories if collection doesn't exist
        setCategories([
          { id: 'b1', name: 'B1 Classes', slug: 'b1', order: 0 },
          { id: 'b2', name: 'B2 Classes', slug: 'b2', order: 1 },
        ]);
      }

      // Fetch events
      const eventsRef = collection(db, 'events');
      const eventsSnap = await getDocs(query(eventsRef, orderBy('date', 'asc')));
      const eventsData = eventsSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((e) => e.status !== 'cancelled' && e.visibility !== 'private');
      setEvents(eventsData);
    } catch (err) {
      console.error('Error fetching classes:', err);
      // Fallback fetch without ordering
      try {
        const eventsRef = collection(db, 'events');
        const eventsSnap = await getDocs(eventsRef);
        const eventsData = eventsSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((e) => e.status !== 'cancelled' && e.visibility !== 'private');
        setEvents(eventsData);
      } catch (fallbackErr) {
        console.error('Fallback fetch failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  const filteredEvents = useMemo(() => {
    let result = events.filter((e) => {
      const eventDate = parseDate(e.date);
      return eventDate > now; // Only upcoming
    });

    if (activeCategory !== 'all') {
      result = result.filter((e) => e.category === activeCategory || e.categoryId === activeCategory);
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(search) ||
          (e.organizer || '').toLowerCase().includes(search) ||
          (e.description || '').toLowerCase().includes(search)
      );
    }

    return result.sort((a, b) => parseDate(a.date) - parseDate(b.date));
  }, [events, activeCategory, searchTerm, now]);

  // Group by category
  const groupedEvents = useMemo(() => {
    if (activeCategory !== 'all') return null;

    const groups = {};
    categories.forEach((cat) => {
      groups[cat.id] = {
        category: cat,
        events: filteredEvents.filter((e) => e.category === cat.id || e.categoryId === cat.id),
      };
    });

    // Uncategorized
    const categorizedIds = new Set(categories.map((c) => c.id));
    const uncategorized = filteredEvents.filter(
      (e) => !categorizedIds.has(e.category) && !categorizedIds.has(e.categoryId)
    );
    if (uncategorized.length > 0) {
      groups['_uncategorized'] = {
        category: { id: '_uncategorized', name: locale === 'fr' ? 'Autres cours' : 'Other Classes' },
        events: uncategorized,
      };
    }

    return groups;
  }, [filteredEvents, categories, activeCategory, locale]);

  const formatDate = (timestamp) => {
    const date = parseDate(timestamp);
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp) => {
    const date = parseDate(timestamp);
    return date.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 glass border-b"
        style={{ borderColor: 'var(--border-light)', height: '56px' }}
      >
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/classes" className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Uniflow
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {locale === 'fr' ? 'Cours disponibles' : 'Available Classes'}
          </h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {locale === 'fr'
              ? 'Parcourez les cours a venir et inscrivez-vous en quelques clics.'
              : 'Browse upcoming classes and register in just a few clicks.'}
          </p>
        </div>

        {/* Search + Category Tabs */}
        <div className="mb-8 space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-tertiary)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={locale === 'fr' ? 'Rechercher un cours...' : 'Search classes...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 py-2.5"
              style={{ borderRadius: '8px' }}
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeCategory === 'all' ? '#1a1a2e' : 'var(--bg-primary)',
                color: activeCategory === 'all' ? '#ffffff' : 'var(--text-secondary)',
                border: activeCategory === 'all' ? 'none' : '1px solid var(--border-default)',
              }}
            >
              {locale === 'fr' ? 'Tous' : 'All'}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: activeCategory === cat.id ? '#1a1a2e' : 'var(--bg-primary)',
                  color: activeCategory === cat.id ? '#ffffff' : 'var(--text-secondary)',
                  border: activeCategory === cat.id ? 'none' : '1px solid var(--border-default)',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* Events Display */}
        {!loading && filteredEvents.length === 0 && (
          <div className="text-center py-16">
            <div
              className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <svg className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {locale === 'fr' ? 'Aucun cours a venir' : 'No upcoming classes'}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {locale === 'fr' ? 'Revenez bientot pour de nouveaux cours.' : 'Check back soon for new classes.'}
            </p>
          </div>
        )}

        {/* Grouped View (when "All" is selected) */}
        {!loading && activeCategory === 'all' && groupedEvents && (
          <div className="space-y-10">
            {Object.entries(groupedEvents).map(([key, group]) => {
              if (group.events.length === 0) return null;
              return (
                <div key={key}>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    {group.category.name}
                    <span className="text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>
                      ({group.events.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.events.map((event) => (
                      <ClassCard
                        key={event.id}
                        event={event}
                        locale={locale}
                        formatDate={formatDate}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filtered View (when specific category is selected) */}
        {!loading && activeCategory !== 'all' && filteredEvents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((event) => (
              <ClassCard
                key={event.id}
                event={event}
                locale={locale}
                formatDate={formatDate}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-8 text-center">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Uniflow
        </p>
      </div>
    </div>
  );
}

function ClassCard({ event, locale, formatDate, formatTime }) {
  const price = getLowestPrice(event);
  const hasMultipleTickets = event.tickets && event.tickets.length > 1;

  return (
    <Link
      href={`/e/${event.slug}`}
      className="group block overflow-hidden rounded-xl border transition-all"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-light)',
      }}
    >
      {/* Banner */}
      <div className="h-44 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        {event.bannerUrl ? (
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #2d2d3f, #1a1a2e)' }} />
        )}

        {/* Price */}
        <div
          className="absolute top-3 right-3 px-3 py-1 rounded-md text-sm font-semibold"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#1a1a2e' }}
        >
          {price === 0
            ? (locale === 'fr' ? 'Gratuit' : 'Free')
            : `${hasMultipleTickets ? (locale === 'fr' ? 'Des ' : 'From ') : ''}${price} EUR`}
        </div>

        {/* Category badge */}
        {event.category && (
          <div
            className="absolute top-3 left-3 px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#48485c' }}
          >
            {event.categoryName || event.category}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3
          className="text-base font-semibold mb-1 line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {event.title}
        </h3>

        {event.organizer && (
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            {event.organizer}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          <span>{formatDate(event.date)}</span>
          <span>|</span>
          <span>{formatTime(event.date)}</span>
        </div>

        {event.format && (
          <div className="mt-2">
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {event.format === 'live'
                ? (locale === 'fr' ? 'En direct' : 'Live')
                : event.format === 'replay'
                  ? 'Replay'
                  : event.format === 'materials'
                    ? (locale === 'fr' ? 'Supports' : 'Materials')
                    : event.format === 'hybrid'
                      ? (locale === 'fr' ? 'Hybride' : 'Hybrid')
                      : event.format}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
