// src/app/admin/events/page.js

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

export default function EventsListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

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

  const handleArchive = async (eventId, eventTitle) => {
    if (!confirm(`Archive "${eventTitle}"? You can restore it later.`)) return;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        archived: true,
        archivedAt: serverTimestamp(),
      });
      setEvents(events.map((e) => e.id === eventId ? { ...e, archived: true } : e));
    } catch (error) {
      console.error('Error archiving event:', error);
      alert('Failed to archive event');
    }
  };

  const handleRestore = async (eventId) => {
    try {
      await updateDoc(doc(db, 'events', eventId), {
        archived: false,
        archivedAt: null,
      });
      setEvents(events.map((e) => e.id === eventId ? { ...e, archived: false } : e));
    } catch (error) {
      console.error('Error restoring event:', error);
      alert('Failed to restore event');
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

  const filteredEvents = events.filter((e) => showArchived ? e.archived : !e.archived);
  const archivedCount = events.filter((e) => e.archived).length;
  const activeCount = events.filter((e) => !e.archived).length;

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
          <p className="text-gray-500 mt-1">{activeCount} active, {archivedCount} archived</p>
        </div>
        <Link
          href="/admin/events/new"
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Create Event
        </Link>
      </div>

      {/* Archive Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            !showArchived ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showArchived ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Archived ({archivedCount})
        </button>
      </div>

      {/* Events Grid */}
      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow ${
                event.archived ? 'border-gray-300 opacity-75' : 'border-gray-200'
              }`}
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
                    <span className="text-6xl opacity-50">E</span>
                  </div>
                )}
                {/* Price badge */}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="font-semibold text-gray-900">{event.price} EUR</span>
                </div>
                {event.archived && (
                  <div className="absolute top-3 left-3 bg-gray-800/80 text-white px-2 py-1 rounded text-xs font-medium">
                    Archived
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                  {event.title}
                </h3>
                <p className="text-sm text-gray-500 mb-1">
                  {formatDate(event.date)}
                </p>
                {event.subject && (
                  <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium mb-3">
                    {event.subject}
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  {!event.archived ? (
                    <>
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
                        onClick={() => handleArchive(event.id, event.title)}
                        className="px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                        title="Archive"
                      >
                        A
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="flex-1 px-3 py-2 text-center text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleRestore(event.id)}
                        className="flex-1 px-3 py-2 text-center text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        Restore
                      </button>
                    </>
                  )}
                </div>

                {/* Public link */}
                {!event.archived && (
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
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          {showArchived ? (
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No archived events</h3>
              <p className="text-gray-500">Archived events will appear here</p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No events yet</h3>
              <p className="text-gray-500 mb-6">Create your first event to get started</p>
              <Link
                href="/admin/events/new"
                className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Event
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
