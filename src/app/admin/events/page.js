// src/app/admin/events/page.js

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function EventsListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const eventsSnap = await getDocs(query(eventsRef, orderBy('createdAt', 'desc')));
      const eventsData = eventsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEvents(eventsData);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId, eventTitle) => {
    if (!confirm(`Are you sure you want to delete "${eventTitle}"?`)) return;

    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents(events.filter((e) => e.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1">{events.length} total events</p>
        </div>
        <Link
          href="/admin/events/new"
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Create Event
        </Link>
      </div>

      {/* Events Grid */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Banner */}
              <div className="h-40 bg-gradient-to-br from-indigo-400 to-purple-500 relative">
                {event.bannerUrl ? (
                  <img
                    src={event.bannerUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl opacity-50">🎓</span>
                  </div>
                )}
                {/* Price badge */}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="font-semibold text-gray-900">{event.price} €</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                  {event.title}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  📅 {formatDate(event.date)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="flex-1 px-3 py-2 text-center text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}/edit`}
                    className="flex-1 px-3 py-2 text-center text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(event.id, event.title)}
                    className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    🗑
                  </button>
                </div>

                {/* Public link */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Public link:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-50 px-2 py-1 rounded truncate">
                      /e/{event.slug}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/e/${event.slug}`
                        );
                        alert('Link copied!');
                      }}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🎓</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No events yet</h3>
          <p className="text-gray-500 mb-6">Create your first event to get started</p>
          <Link
            href="/admin/events/new"
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create Event
          </Link>
        </div>
      )}
    </div>
  );
}