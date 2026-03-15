// src/app/classes/page.js
// Student-facing classes page with B1/B2 navigation, enriched cards, countdown

'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';
import { useCart } from '@/contexts/CartContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';
import CartButton from '@/components/CartButton';
import CountdownBanner from '@/components/CountdownBanner';
import { formatEventDate, formatEventTime } from '../lib/utils';

const SUBJECT_COLORS = {
  stats: { bg: '#eef2ff', text: '#4f46e5' },
  accounting: { bg: '#fffbeb', text: '#a16207' },
  psychology: { bg: '#fdf2f8', text: '#be185d' },
  law: { bg: '#ecfdf5', text: '#047857' },
  'computer-skills': { bg: '#eff6ff', text: '#1d4ed8' },
};

const SUBJECT_LABELS = {
  stats: { en: 'Statistics', fr: 'Statistiques' },
  accounting: { en: 'Accounting', fr: 'Comptabilité' },
  psychology: { en: 'Psychology', fr: 'Psychologie' },
  law: { en: 'Law', fr: 'Droit' },
  'computer-skills': { en: 'Computer Skills', fr: 'Informatique' },
};

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

function ClassesContent() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { addItem } = useCart();
  const isEn = locale === 'en';
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [examCountdowns, setExamCountdowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    const typeFromUrl = searchParams.get('type');
    if (categoryFromUrl) setActiveCategory(categoryFromUrl);
    if (typeFromUrl) setActiveType(typeFromUrl);
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      try {
        const catsRef = collection(db, 'categories');
        const catsSnap = await getDocs(catsRef);
        const catsData = catsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setCategories(catsData);
      } catch {
        setCategories([
          { id: 'b1', name: 'B1', slug: 'b1', order: 0 },
          { id: 'b2', name: 'B2', slug: 'b2', order: 1 },
        ]);
      }

      const eventsRef = collection(db, 'events');
      const eventsSnap = await getDocs(query(eventsRef, orderBy('date', 'asc')));
      const eventsData = eventsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => e.status !== 'cancelled' && e.visibility !== 'private' && !e.archived);
      setEvents(eventsData);

      try {
        const productsRef = collection(db, 'products');
        const productsSnap = await getDocs(productsRef);
        const productsData = productsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.status === 'published');
        setProducts(productsData);
      } catch { setProducts([]); }

      try {
        const configDoc = await getDoc(doc(db, 'site_config', 'global'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.examCountdowns) setExamCountdowns(data.examCountdowns);
        }
      } catch {}
    } catch (err) {
      console.error('Error fetching classes:', err);
      try {
        const eventsRef = collection(db, 'events');
        const eventsSnap = await getDocs(eventsRef);
        const eventsData = eventsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((e) => e.status !== 'cancelled' && e.visibility !== 'private');
        setEvents(eventsData);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  const filteredEvents = useMemo(() => {
    if (activeType === 'product' || activeType === 'bundle') return [];
    let result = events.filter((e) => parseDate(e.date) > now);
    if (activeCategory !== 'all') {
      result = result.filter((e) => e.category === activeCategory || e.categoryId === activeCategory);
    }
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter((e) =>
        (e.title || '').toLowerCase().includes(search) ||
        (e.organizer || '').toLowerCase().includes(search) ||
        (e.subject || '').toLowerCase().includes(search)
      );
    }
    return result.sort((a, b) => parseDate(a.date) - parseDate(b.date));
  }, [events, activeCategory, activeType, searchTerm, now]);

  const filteredProducts = useMemo(() => {
    if (activeType === 'event') return [];
    let result = products;
    if (activeType === 'bundle') result = result.filter((p) => p.type === 'bundle');
    else if (activeType === 'product') result = result.filter((p) => p.type !== 'bundle');
    if (activeCategory !== 'all') {
      result = result.filter((p) => {
        if (p.category === activeCategory || p.categoryId === activeCategory) return true;
        return (p.tags || []).includes(`cohort:${activeCategory}`);
      });
    }
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter((p) =>
        (p.title || '').toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search) ||
        (p.subject || '').toLowerCase().includes(search)
      );
    }
    return result;
  }, [products, activeCategory, activeType, searchTerm]);

  const groupedItems = useMemo(() => {
    if (activeCategory !== 'all') return null;
    const groups = {};
    categories.forEach((cat) => {
      const catEvents = filteredEvents.filter((e) => e.category === cat.id || e.categoryId === cat.id);
      const catProducts = filteredProducts.filter((p) => {
        if (p.category === cat.id || p.categoryId === cat.id) return true;
        return (p.tags || []).includes(`cohort:${cat.id}`);
      });
      if (catEvents.length > 0 || catProducts.length > 0) {
        groups[cat.id] = { category: cat, events: catEvents, products: catProducts };
      }
    });
    return groups;
  }, [filteredEvents, filteredProducts, categories, activeCategory, locale]);

  const formatDate = (timestamp) => formatEventDate(timestamp, locale);
  const formatTime = (timestamp) => formatEventTime(timestamp, locale);

  const typeFilters = [
    { id: 'all', labelEn: 'All', labelFr: 'Tout' },
    { id: 'event', labelEn: 'Live Classes', labelFr: 'Cours en direct' },
    { id: 'bundle', labelEn: 'Bundles', labelFr: 'Packs' },
    { id: 'product', labelEn: 'Materials', labelFr: 'Supports' },
  ];

  const totalItems = filteredEvents.length + filteredProducts.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <CountdownBanner countdowns={examCountdowns} locale={locale} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b" style={{ borderColor: 'var(--border-light)', height: '56px' }}>
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>UniFlow</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <CartButton />
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {activeCategory === 'b1'
              ? (isEn ? 'B1 Courses' : 'Cours B1')
              : activeCategory === 'b2'
                ? (isEn ? 'B2 Courses' : 'Cours B2')
                : (isEn ? 'All Courses' : 'Tous les cours')}
          </h1>
          <p className="text-base max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            {isEn
              ? 'Live classes, revision bundles, and study materials to excel at ESCP.'
              : 'Cours en direct, packs de révision et supports de cours pour exceller à ESCP.'}
          </p>
        </div>

        {/* Category toggle */}
        <div className="mb-6">
          <div className="inline-flex rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-primary)' }}>
            {[
              { id: 'all', label: isEn ? 'All' : 'Tout' },
              { id: 'b1', label: 'B1' },
              { id: 'b2', label: 'B2' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setActiveType('all'); }}
                className="px-6 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: activeCategory === cat.id ? 'var(--color-primary-600)' : 'transparent',
                  color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder={isEn ? 'Search courses...' : 'Rechercher...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 py-2.5 w-full"
              style={{ borderRadius: '10px' }}
            />
          </div>
          <div className="flex gap-1.5">
            {typeFilters.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setActiveType(tf.id)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: activeType === tf.id ? 'var(--color-primary-50)' : 'var(--bg-primary)',
                  color: activeType === tf.id ? 'var(--color-primary-700)' : 'var(--text-tertiary)',
                  border: `1px solid ${activeType === tf.id ? 'var(--color-primary-200)' : 'var(--border-light)'}`,
                }}
              >
                {isEn ? tf.labelEn : tf.labelFr}
              </button>
            ))}
          </div>
        </div>

        {!loading && (
          <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
            {totalItems} {totalItems === 1 ? (isEn ? 'course' : 'cours') : (isEn ? 'courses' : 'cours')}
          </p>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && totalItems === 0 && (
          <div className="text-center py-16 rounded-xl border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}>
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {isEn ? 'No courses found' : 'Aucun cours trouvé'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isEn ? 'Try adjusting your filters.' : 'Essaie de modifier tes filtres.'}
            </p>
          </div>
        )}

        {/* Grouped View */}
        {!loading && activeCategory === 'all' && groupedItems && (
          <div className="space-y-12">
            {Object.entries(groupedItems).map(([key, group]) => {
              const total = (group.events?.length || 0) + (group.products?.length || 0);
              if (total === 0) return null;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      {group.category.name}
                      <span className="text-sm font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                        {total}
                      </span>
                    </h2>
                    <Link href={`/classes?category=${key}`} className="text-sm font-medium hover:underline" style={{ color: 'var(--color-primary-600)' }}>
                      {isEn ? 'View all' : 'Voir tout'} →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.events?.map((event) => (
                      <CourseCard key={`e-${event.id}`} item={event} type="event" locale={locale} formatDate={formatDate} formatTime={formatTime} addItem={addItem} />
                    ))}
                    {group.products?.map((product) => (
                      <CourseCard key={`p-${product.id}`} item={product} type="product" locale={locale} addItem={addItem} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filtered View */}
        {!loading && activeCategory !== 'all' && totalItems > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((event) => (
              <CourseCard key={`e-${event.id}`} item={event} type="event" locale={locale} formatDate={formatDate} formatTime={formatTime} addItem={addItem} />
            ))}
            {filteredProducts.map((product) => (
              <CourseCard key={`p-${product.id}`} item={product} type="product" locale={locale} addItem={addItem} />
            ))}
          </div>
        )}
      </div>

      <div className="py-8 text-center">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Uniflow</p>
      </div>
    </div>
  );
}

function SubjectBadge({ subject, locale }) {
  if (!subject) return null;
  const colors = SUBJECT_COLORS[subject] || {};
  const label = SUBJECT_LABELS[subject]?.[locale] || subject;
  return (
    <span
      className="px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ backgroundColor: colors.bg || 'var(--bg-tertiary)', color: colors.text || 'var(--text-secondary)' }}
    >
      {label}
    </span>
  );
}

function BadgeRow({ badgeToggles, locale }) {
  if (!badgeToggles) return null;
  const isEn = locale === 'en';
  const badges = [];
  if (badgeToggles.bestseller) badges.push({ label: isEn ? 'Bestseller' : 'Best-seller', bg: '#fef3c7', color: '#92400e' });
  if (badgeToggles.new) badges.push({ label: isEn ? 'New' : 'Nouveau', bg: '#dbeafe', color: '#1e40af' });
  if (badgeToggles.limited) badges.push({ label: isEn ? 'Limited' : 'Limité', bg: '#fee2e2', color: '#991b1b' });
  if (badges.length === 0) return null;
  return (
    <>
      {badges.map((b) => (
        <span key={b.label} className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: b.bg, color: b.color }}>
          {b.label}
        </span>
      ))}
    </>
  );
}

function CourseCard({ item, type, locale, formatDate, formatTime, addItem }) {
  const [added, setAdded] = useState(false);
  const isEn = locale === 'en';
  const isEvent = type === 'event';
  const href = isEvent ? `/e/${item.slug}` : `/p/${item.slug}`;
  const price = isEvent ? getLowestPrice(item) : (Number(item.price) || 0);
  const hasMultipleTickets = isEvent && item.tickets?.length > 1;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: item.id,
      type: isEvent ? 'event' : 'product',
      title: item.title,
      price,
      subject: item.subject || '',
      bannerUrl: item.bannerUrl || '',
      slug: item.slug,
      ...(isEvent && item.tickets?.length === 1 && {
        ticketId: item.tickets[0].id,
        ticketName: item.tickets[0].name,
      }),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const learningOutcomes = item.learningOutcomes || [];
  const examAlignment = item.examAlignment;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
    >
      {/* Banner */}
      <div className="h-40 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        {item.bannerUrl ? (
          <img src={item.bannerUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }} />
        )}
        <div className="absolute top-3 right-3 px-3 py-1 rounded-lg text-sm font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: '#1a1a2e' }}>
          {price === 0
            ? (isEn ? 'Free' : 'Gratuit')
            : `${hasMultipleTickets ? (isEn ? 'From ' : 'Dès ') : ''}${price}€`}
        </div>
        {isEvent && item.format === 'live' && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Live
          </div>
        )}
        {!isEvent && item.type === 'bundle' && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500 text-white">
            {isEn ? 'Bundle' : 'Pack'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <SubjectBadge subject={item.subject} locale={locale} />
          <BadgeRow badgeToggles={item.badgeToggles} locale={locale} />
        </div>

        <h3 className="text-base font-semibold mb-1.5 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
          {item.title}
        </h3>

        {learningOutcomes.length > 0 ? (
          <div className="mb-3 space-y-1">
            {learningOutcomes.slice(0, 2).map((outcome, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="line-clamp-1">{outcome}</span>
              </div>
            ))}
            {learningOutcomes.length > 2 && (
              <p className="text-xs pl-5" style={{ color: 'var(--text-tertiary)' }}>
                +{learningOutcomes.length - 2} {isEn ? 'more' : 'de plus'}
              </p>
            )}
          </div>
        ) : item.description ? (
          <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {item.description}
          </p>
        ) : null}

        {examAlignment && (
          <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="line-clamp-1">{examAlignment}</span>
          </div>
        )}

        {isEvent && (
          <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{formatDate(item.date)}</span>
            <span>-</span>
            <span>{formatTime(item.date)}</span>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={handleAddToCart}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: added ? '#16a34a' : 'var(--color-primary-50)',
            color: added ? '#fff' : 'var(--color-primary-700)',
            border: added ? 'none' : '1px solid var(--color-primary-200)',
          }}
        >
          {added
            ? (isEn ? 'Added to cart' : 'Ajouté au panier')
            : (isEn ? 'Add to Cart' : 'Ajouter au panier')}
        </button>
      </div>
    </Link>
  );
}

function ClassesFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="w-8 h-8 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--color-primary-500)' }} />
    </div>
  );
}

export default function ClassesPage() {
  return (
    <Suspense fallback={<ClassesFallback />}>
      <ClassesContent />
    </Suspense>
  );
}
