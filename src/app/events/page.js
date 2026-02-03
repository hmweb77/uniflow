// src/app/events/page.js

'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const eventsQuery = query(eventsRef, orderBy('createdAt', 'desc'));
      const eventsSnap = await getDocs(eventsQuery);
      const eventsData = eventsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEvents(eventsData.filter((event) => event.status !== 'cancelled'));
    } catch (error) {
      console.error('Error fetching events:', error);
      try {
        const eventsRef = collection(db, 'events');
        const eventsSnap = await getDocs(eventsRef);
        const eventsData = eventsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEvents(eventsData.filter((e) => e.status !== 'cancelled'));
      } catch (err) {
        console.error('Fallback query failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (timestamp) => {
    if (!timestamp) return new Date(0);
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
    return new Date(timestamp);
  };

  const formatDate = (timestamp) => {
    const date = parseDate(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp) => {
    const date = parseDate(timestamp);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isUpcoming = (timestamp) => parseDate(timestamp) > new Date();

  const getLowestPrice = (event) => {
    if (event.tickets && event.tickets.length > 0) {
      return Math.min(...event.tickets.map((t) => t.price || 0));
    }
    return event.price || 0;
  };

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      result = result.filter((event) => {
        const title = (event.title || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const organizer = (event.organizer || '').toLowerCase();
        return title.includes(search) || description.includes(search) || organizer.includes(search);
      });
    }

    if (selectedLanguage !== 'all') {
      result = result.filter((event) => event.language === selectedLanguage);
    }
    if (selectedFormat !== 'all') {
      result = result.filter((event) => event.format === selectedFormat);
    }
    if (priceRange !== 'all') {
      result = result.filter((event) => {
        const price = getLowestPrice(event);
        switch (priceRange) {
          case 'free': return price === 0;
          case 'under10': return price > 0 && price < 10;
          case '10to25': return price >= 10 && price <= 25;
          case 'over25': return price > 25;
          default: return true;
        }
      });
    }

    switch (sortBy) {
      case 'date': result.sort((a, b) => parseDate(a.date) - parseDate(b.date)); break;
      case 'date-desc': result.sort((a, b) => parseDate(b.date) - parseDate(a.date)); break;
      case 'price': result.sort((a, b) => getLowestPrice(a) - getLowestPrice(b)); break;
      case 'price-desc': result.sort((a, b) => getLowestPrice(b) - getLowestPrice(a)); break;
      case 'title': result.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
    }

    return result;
  }, [events, searchTerm, selectedLanguage, selectedFormat, priceRange, sortBy]);

  const upcomingEvents = filteredEvents.filter((e) => isUpcoming(e.date));
  const pastEvents = filteredEvents.filter((e) => !isUpcoming(e.date));

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedLanguage('all');
    setSelectedFormat('all');
    setPriceRange('all');
    setSortBy('date');
  };

  const hasActiveFilters =
    searchTerm || selectedLanguage !== 'all' || selectedFormat !== 'all' || priceRange !== 'all';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Uniflow</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
              <Link href="/events" className="text-indigo-600 font-medium">Events</Link>
              <Link href="/login" className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                Admin Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-8 px-4 bg-gradient-to-b from-indigo-50 to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Explore Events</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover online classes and masterclasses from top educators
            </p>
          </div>

          {/* Search Bar — no emoji icon */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search by title, topic, or instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Filters — no emojis */}
      <section className="py-4 px-4 bg-white border-b border-gray-100 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
            >
              <option value="all">All Languages</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>

            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
            >
              <option value="all">All Formats</option>
              <option value="live">Live Session</option>
              <option value="replay">Replay</option>
              <option value="materials">Materials Only</option>
              <option value="hybrid">Hybrid</option>
            </select>

            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
            >
              <option value="all">All Prices</option>
              <option value="free">Free</option>
              <option value="under10">Under €10</option>
              <option value="10to25">€10 – €25</option>
              <option value="over25">Over €25</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
            >
              <option value="date">Date (Soonest)</option>
              <option value="date-desc">Date (Latest)</option>
              <option value="price">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="title">Title (A–Z)</option>
            </select>

            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                Clear Filters
              </button>
            )}

            <div className="ml-auto text-sm text-gray-500">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="space-y-12">
              {upcomingEvents.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    Upcoming Events
                    <span className="text-sm font-normal text-gray-500">({upcomingEvents.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        getLowestPrice={getLowestPrice}
                        isUpcoming={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {pastEvents.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                    Past Events
                    <span className="text-sm font-normal text-gray-500">({pastEvents.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        getLowestPrice={getLowestPrice}
                        isUpcoming={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No events found</h3>
              <p className="text-gray-500 mb-6">
                {hasActiveFilters ? 'Try adjusting your search or filters' : 'Check back soon for new classes!'}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>© 2025 Uniflow. Made for universities.</p>
        </div>
      </footer>
    </div>
  );
}

// Event Card Component — taller banner, no emojis, no logo
function EventCard({ event, formatDate, formatTime, getLowestPrice, isUpcoming }) {
  const price = getLowestPrice(event);
  const hasMultipleTickets = event.tickets && event.tickets.length > 1;

  return (
    <Link
      href={`/e/${event.slug}`}
      className={`group bg-white rounded-2xl border overflow-hidden transition-all ${
        isUpcoming
          ? 'border-gray-100 hover:shadow-xl hover:border-indigo-100'
          : 'border-gray-100 opacity-75 hover:opacity-100'
      }`}
    >
      {/* Event Banner — object-contain so full image shows */}
      <div className="h-52 bg-white relative overflow-hidden">
        {event.bannerUrl ? (
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
        )}

        {/* Past Event Overlay */}
        {!isUpcoming && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-4 py-2 bg-black/60 text-white text-sm font-medium rounded-full">
              Event Ended
            </span>
          </div>
        )}

        {/* Price Badge */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
          {price === 0 ? (
            <span className="font-bold text-green-600">Free</span>
          ) : (
            <span className="font-bold text-gray-900">
              {hasMultipleTickets && 'From '}
              {price} €
            </span>
          )}
        </div>

        {/* Language & Format Badges — text only, no emojis */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-medium text-gray-700">
            {event.language === 'fr' ? 'FR' : 'EN'}
          </span>
          {event.format && (
            <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-medium text-gray-700 inline-flex items-center gap-1.5">
              {event.format === 'live' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
              {event.format === 'live' && 'Live'}
              {event.format === 'replay' && 'Replay'}
              {event.format === 'materials' && 'Materials'}
              {event.format === 'hybrid' && 'Hybrid'}
            </span>
          )}
        </div>
      </div>

      {/* Event Info */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
          {event.title}
        </h3>

        {event.organizer && (
          <p className="text-sm text-indigo-600 mb-2">{event.organizer}</p>
        )}

        {/* Date & Time — clean text, no emojis */}
        <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
          <span>{formatDate(event.date)}</span>
          <span className="text-gray-300">|</span>
          <span>{formatTime(event.date)}</span>
        </div>

        <p className="text-gray-600 text-sm line-clamp-2 mb-4">
          {event.description || 'Join this amazing online class!'}
        </p>

        {/* CTA */}
        <div className="flex items-center justify-between">
          <span
            className={`font-medium ${
              isUpcoming ? 'text-indigo-600 group-hover:underline' : 'text-gray-400'
            }`}
          >
            {isUpcoming ? 'Register Now →' : 'View Details →'}
          </span>
          {hasMultipleTickets && (
            <span className="text-xs text-gray-400">
              {event.tickets.length} ticket options
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}