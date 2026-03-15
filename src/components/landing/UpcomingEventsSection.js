'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';
import { useCart } from '@/contexts/CartContext';

export default function UpcomingEventsSection() {
  const { locale } = useLocale();
  const { addItem } = useCart();
  const isEn = locale === 'en';
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicEvents();
  }, []);

  const fetchPublicEvents = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const eventsQuery = query(eventsRef, orderBy('date', 'asc'));
      const eventsSnap = await getDocs(eventsQuery);
      const eventsData = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const now = new Date();
      const upcoming = eventsData
        .filter((event) => {
          if (event.status === 'cancelled' || event.archived) return false;
          const eventDate = parseDate(event.date);
          return eventDate > now;
        })
        .slice(0, 4);

      setEvents(upcoming);
    } catch {
      try {
        const eventsRef = collection(db, 'events');
        const eventsSnap = await getDocs(eventsRef);
        const eventsData = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const now = new Date();
        const upcoming = eventsData
          .filter((e) => {
            if (e.status === 'cancelled' || e.archived) return false;
            return parseDate(e.date) > now;
          })
          .sort((a, b) => parseDate(a.date) - parseDate(b.date))
          .slice(0, 4);
        setEvents(upcoming);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    const d = parseDate(timestamp);
    return d.toLocaleDateString(isEn ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };

  const formatTime = (timestamp) => {
    const d = parseDate(timestamp);
    return d.toLocaleTimeString(isEn ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  return (
    <section className="section px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="container-wide">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {isEn ? 'Upcoming Classes' : 'Prochains cours'}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {isEn ? 'Don\'t miss these sessions' : 'Ne manque pas ces sessions'}
            </p>
          </div>
          <Link
            href="/classes"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: 'var(--color-primary-600)' }}
          >
            {isEn ? 'View all classes' : 'Voir tous les cours'}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary-500)', borderTopColor: 'transparent' }} />
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {events.map((event) => {
              const price = event.tickets?.length > 0
                ? Math.min(...event.tickets.map((t) => t.price || 0))
                : event.price || 0;
              return (
                <Link
                  key={event.id}
                  href={`/e/${event.slug}`}
                  className="group block rounded-xl border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
                >
                  {/* Banner */}
                  <div className="h-36 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    {event.bannerUrl ? (
                      <img src={event.bannerUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }} />
                    )}
                    {event.format === 'live' && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Live
                      </div>
                    )}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-sm font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#1a1a2e' }}>
                      {price === 0 ? (isEn ? 'Free' : 'Gratuit') : `${price}€`}
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span>{formatDate(event.date)}</span>
                      <span className="mx-0.5">-</span>
                      <span>{formatTime(event.date)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}>
            <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              {isEn ? 'No upcoming classes' : 'Pas de cours prévus'}
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {isEn ? 'Check back soon!' : 'Reviens bientôt !'}
            </p>
            <Link href="/classes" className="btn btn-primary btn-md">
              {isEn ? 'Browse all courses' : 'Voir tous les cours'}
            </Link>
          </div>
        )}

        {/* Mobile "View all" link */}
        {events.length > 0 && (
          <div className="text-center mt-8 sm:hidden">
            <Link href="/classes" className="btn btn-primary btn-lg">
              {isEn ? 'View all classes' : 'Voir tous les cours'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function parseDate(timestamp) {
  if (!timestamp) return new Date(0);
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
  return new Date(timestamp);
}
