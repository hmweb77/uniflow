'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';
import EventCard from '@/components/events/EventCard';

export default function UpcomingEventsSection() {
  const { t } = useLocale();
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
          if (event.status === 'cancelled') return false;
          const eventDate = parseDate(event.date);
          return eventDate > now;
        })
        .slice(0, 3);

      setEvents(upcoming);
    } catch {
      try {
        const eventsRef = collection(db, 'events');
        const eventsSnap = await getDocs(eventsRef);
        const eventsData = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const now = new Date();
        const upcoming = eventsData
          .filter((e) => {
            if (e.status === 'cancelled') return false;
            return parseDate(e.date) > now;
          })
          .sort((a, b) => parseDate(a.date) - parseDate(b.date))
          .slice(0, 3);
        setEvents(upcoming);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="events" className="section px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {t.eventsPage?.upcoming || 'Upcoming Events'}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t.hero.ctaSecondary !== 'How it Works' ? "Ne manquez pas ces prochains cours en ligne" : "Don't miss these upcoming online classes"}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-primary-500)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : events.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {events.map((event) => (
                <EventCard key={event.id} event={event} isUpcoming />
              ))}
            </div>
            <div className="text-center">
              <Link href="/events" className="btn btn-primary btn-xl">
                {t.hero.ctaPrimary}
                <span>→</span>
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-12 surface">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {t.eventsPage?.noEvents || 'No upcoming events'}
            </h3>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t.eventsPage?.checkBack || 'Check back soon for new classes!'}
            </p>
            <Link href="/events" className="btn btn-primary btn-md">
              {t.hero.ctaPrimary}
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