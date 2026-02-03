// src/app/events/page.js

'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';
import PublicLayout from '@/components/layout/PublicLayout';
import EventCard from '@/components/events/EventCard';
import { useLocale } from '@/contexts/LocaleContext';

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

export default function EventsPage() {
  const { locale, t } = useLocale();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const ep = t.eventsPage || {};

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const eventsQuery = query(eventsRef, orderBy('createdAt', 'desc'));
      const eventsSnap = await getDocs(eventsQuery);
      const eventsData = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData.filter((event) => event.status !== 'cancelled'));
    } catch {
      try {
        const eventsRef = collection(db, 'events');
        const eventsSnap = await getDocs(eventsRef);
        const eventsData = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setEvents(eventsData.filter((e) => e.status !== 'cancelled'));
      } catch (err) {
        console.error('Fallback query failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const isUpcoming = (timestamp) => parseDate(timestamp) > new Date();

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

    if (selectedLanguage !== 'all') result = result.filter((e) => e.language === selectedLanguage);
    if (selectedFormat !== 'all') result = result.filter((e) => e.format === selectedFormat);
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
      case 'date':       result.sort((a, b) => parseDate(a.date) - parseDate(b.date)); break;
      case 'date-desc':  result.sort((a, b) => parseDate(b.date) - parseDate(a.date)); break;
      case 'price':      result.sort((a, b) => getLowestPrice(a) - getLowestPrice(b)); break;
      case 'price-desc': result.sort((a, b) => getLowestPrice(b) - getLowestPrice(a)); break;
      case 'title':      result.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
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

  const hasActiveFilters = searchTerm || selectedLanguage !== 'all' || selectedFormat !== 'all' || priceRange !== 'all';
  const activeFilterCount = [
    selectedLanguage !== 'all',
    selectedFormat !== 'all',
    priceRange !== 'all',
    searchTerm.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="pt-8 pb-6 px-4" style={{ background: 'var(--gradient-hero)' }}>
        <div className="container-wide">
          <div className="text-center mb-8">
            <h1
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {ep.title}
            </h1>
            <p
              className="text-xl max-w-2xl mx-auto"
              style={{ color: 'var(--text-secondary)' }}
            >
              {ep.subtitle}
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder={ep.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-12 pr-4 py-4 text-lg"
                style={{
                  borderRadius: 'var(--radius-2xl)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Sticky Filter Bar ─────────────────────────────── */}
      <div
        className="sticky z-40 border-b glass"
        style={{
          top: 'var(--nav-height)',
          borderColor: 'var(--border-light)',
        }}
      >
        <div className="container-wide px-4">
          {/* Desktop — single compact row of chip selects */}
          <div className="hidden md:flex items-center gap-2 py-3">
            <FilterChip
              value={selectedLanguage}
              onChange={setSelectedLanguage}
              options={[
                { value: 'all', label: ep.allLanguages || 'All Languages' },
                { value: 'en', label: ep.english || 'English' },
                { value: 'fr', label: ep.french || 'French' },
              ]}
              active={selectedLanguage !== 'all'}
            />
            <FilterChip
              value={selectedFormat}
              onChange={setSelectedFormat}
              options={[
                { value: 'all', label: ep.allFormats || 'All Formats' },
                { value: 'live', label: ep.liveSession || 'Live Session' },
                { value: 'replay', label: ep.replay || 'Replay' },
                { value: 'materials', label: ep.materialsOnly || 'Materials Only' },
                { value: 'hybrid', label: ep.hybrid || 'Hybrid' },
              ]}
              active={selectedFormat !== 'all'}
            />
            <FilterChip
              value={priceRange}
              onChange={setPriceRange}
              options={[
                { value: 'all', label: ep.allPrices || 'All Prices' },
                { value: 'free', label: t.common?.free || 'Free' },
                { value: 'under10', label: ep.under10 || 'Under €10' },
                { value: '10to25', label: ep.range10to25 || '€10 – €25' },
                { value: 'over25', label: ep.over25 || 'Over €25' },
              ]}
              active={priceRange !== 'all'}
            />

            {/* Divider */}
            <div
              className="w-px h-6 mx-1"
              style={{ backgroundColor: 'var(--border-default)' }}
            />

            {/* Sort */}
            <FilterChip
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'date', label: ep.dateSoonest || 'Date (Soonest)' },
                { value: 'date-desc', label: ep.dateLatest || 'Date (Latest)' },
                { value: 'price', label: ep.priceLow || 'Price (Low)' },
                { value: 'price-desc', label: ep.priceHigh || 'Price (High)' },
                { value: 'title', label: ep.titleAZ || 'Title (A–Z)' },
              ]}
              active={false}
            />

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{
                  color: 'var(--color-error)',
                  backgroundColor: 'rgba(239,68,68,0.08)',
                }}
              >
                ✕ {ep.clearFilters || 'Clear'}
              </button>
            )}

            <span
              className="ml-auto text-xs font-medium tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {filteredEvents.length}{' '}
              {filteredEvents.length !== 1 ? ep.eventsFound || 'events' : ep.eventFound || 'event'}
            </span>
          </div>

          {/* Mobile — toggle button row */}
          <div className="flex md:hidden items-center justify-between py-3">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: hasActiveFilters
                  ? 'var(--color-primary-50)'
                  : 'var(--bg-tertiary)',
                color: hasActiveFilters
                  ? 'var(--color-primary-700)'
                  : 'var(--text-secondary)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              {locale === 'fr' ? 'Filtres' : 'Filters'}
              {activeFilterCount > 0 && (
                <span
                  className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: 'var(--color-primary-600)' }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {filteredEvents.length}{' '}
              {filteredEvents.length !== 1 ? ep.eventsFound || 'events' : ep.eventFound || 'event'}
            </span>
          </div>

          {/* Mobile — expanded filter grid */}
          {showMobileFilters && (
            <div
              className="md:hidden pb-4 pt-1 space-y-2 border-t"
              style={{ borderColor: 'var(--border-light)' }}
            >
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="input select text-sm py-2.5"
                >
                  <option value="all">{ep.allLanguages || 'All Languages'}</option>
                  <option value="en">{ep.english || 'English'}</option>
                  <option value="fr">{ep.french || 'French'}</option>
                </select>

                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="input select text-sm py-2.5"
                >
                  <option value="all">{ep.allFormats || 'All Formats'}</option>
                  <option value="live">{ep.liveSession || 'Live'}</option>
                  <option value="replay">{ep.replay || 'Replay'}</option>
                  <option value="materials">{ep.materialsOnly || 'Materials'}</option>
                  <option value="hybrid">{ep.hybrid || 'Hybrid'}</option>
                </select>

                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="input select text-sm py-2.5"
                >
                  <option value="all">{ep.allPrices || 'All Prices'}</option>
                  <option value="free">{t.common?.free || 'Free'}</option>
                  <option value="under10">{ep.under10 || 'Under €10'}</option>
                  <option value="10to25">{ep.range10to25 || '€10 – €25'}</option>
                  <option value="over25">{ep.over25 || 'Over €25'}</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input select text-sm py-2.5"
                >
                  <option value="date">{ep.dateSoonest || 'Soonest'}</option>
                  <option value="date-desc">{ep.dateLatest || 'Latest'}</option>
                  <option value="price">{ep.priceLow || 'Price ↑'}</option>
                  <option value="price-desc">{ep.priceHigh || 'Price ↓'}</option>
                  <option value="title">{ep.titleAZ || 'A–Z'}</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="w-full py-2 text-xs font-medium rounded-lg transition-colors"
                  style={{
                    color: 'var(--color-error)',
                    backgroundColor: 'rgba(239,68,68,0.08)',
                  }}
                >
                  ✕ {ep.clearAll || 'Clear All Filters'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Events Grid ───────────────────────────────────── */}
      <section className="section px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container-wide">
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{
                  borderColor: 'var(--color-primary-500)',
                  borderTopColor: 'transparent',
                }}
              />
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="space-y-12">
              {upcomingEvents.length > 0 && (
                <div>
                  <h2
                    className="text-2xl font-bold mb-6 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: 'var(--color-success)' }}
                    />
                    {ep.upcoming}
                    <span
                      className="text-sm font-normal"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      ({upcomingEvents.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingEvents.map((event) => (
                      <EventCard key={event.id} event={event} isUpcoming />
                    ))}
                  </div>
                </div>
              )}

              {pastEvents.length > 0 && (
                <div>
                  <h2
                    className="text-2xl font-bold mb-6 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: 'var(--text-tertiary)' }}
                    />
                    {ep.past}
                    <span
                      className="text-sm font-normal"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      ({pastEvents.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastEvents.map((event) => (
                      <EventCard key={event.id} event={event} isUpcoming={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3
                className="text-xl font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {ep.noEvents}
              </h3>
              <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                {hasActiveFilters ? ep.noEventsHint : ep.checkBack}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="btn btn-primary btn-md">
                  {ep.clearAll}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

/* ─── FilterChip — compact pill-style dropdown ─────────────── */
function FilterChip({ value, onChange, options, active }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer text-[13px] font-medium pl-3 pr-7 py-2 rounded-lg border outline-none transition-all"
        style={{
          backgroundColor: active ? 'var(--color-primary-50)' : 'var(--bg-primary)',
          borderColor: active ? 'var(--color-primary-200)' : 'var(--border-default)',
          color: active ? 'var(--color-primary-700)' : 'var(--text-secondary)',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: active ? 'var(--color-primary-500)' : 'var(--text-tertiary)' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}