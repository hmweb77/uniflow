// src/components/CartDrawer.js
// Slide-over cart panel with items, multi-subject discounts, private call add-on, upsell recommendations, and checkout

'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useLocale } from '@/contexts/LocaleContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import Link from 'next/link';

export default function CartDrawer() {
  const {
    items, isOpen, closeCart, removeItem, clearCart,
    subtotal, discountPercent, discountAmount, savings, total,
    privateCallProduct, privateCallAdded, setPrivateCallAdded,
    itemCount,
  } = useCart();

  const { locale } = useLocale();
  const isEn = locale === 'en';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [campusesLoaded, setCampusesLoaded] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState([]);

  // Load campuses lazily when drawer opens
  if (isOpen && !campusesLoaded) {
    fetch('/api/campuses')
      .then((r) => r.json())
      .then((data) => setCampuses(data.campuses || []))
      .catch(() => {});
    setCampusesLoaded(true);
  }

  // Fetch upsell recommendations based on cart items
  useEffect(() => {
    if (!isOpen || items.length === 0) {
      setRecommendations([]);
      return;
    }

    const fetchRecs = async () => {
      try {
        const cartIds = new Set(items.map((i) => i.id));
        const cartSubjects = new Set(items.map((i) => i.subject).filter(Boolean));
        const relatedIds = new Set();

        // Collect relatedProductIds from items in cart
        for (const item of items) {
          const col = item.type === 'event' ? 'events' : 'products';
          try {
            const { doc: docRef, getDoc } = await import('firebase/firestore');
            const d = await getDoc(docRef(db, col, item.id));
            if (d.exists()) {
              (d.data().relatedProductIds || []).forEach((id) => {
                if (!cartIds.has(id)) relatedIds.add(id);
              });
            }
          } catch {}
        }

        if (relatedIds.size === 0) {
          // Fallback: suggest products from same subjects not in cart
          try {
            const productsSnap = await getDocs(collection(db, 'products'));
            const recs = productsSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((p) => p.status === 'published' && !cartIds.has(p.id))
              .filter((p) => cartSubjects.has(p.subject))
              .slice(0, 3);
            setRecommendations(recs);
          } catch {}
          return;
        }

        // Fetch related products
        const recs = [];
        for (const recId of [...relatedIds].slice(0, 3)) {
          try {
            const { doc: docRef, getDoc } = await import('firebase/firestore');
            let d = await getDoc(docRef(db, 'products', recId));
            if (d.exists() && d.data().status === 'published') {
              recs.push({ id: d.id, ...d.data() });
            } else {
              d = await getDoc(docRef(db, 'events', recId));
              if (d.exists()) recs.push({ id: d.id, ...d.data(), _isEvent: true });
            }
          } catch {}
        }
        setRecommendations(recs);
      } catch {}
    };

    fetchRecs();
  }, [isOpen, items.length]);

  const handleCheckout = async () => {
    setError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError(isEn ? 'Please fill in your name and email.' : 'Veuillez remplir votre nom et email.');
      return;
    }
    if (items.length === 0) {
      setError(isEn ? 'Your cart is empty.' : 'Votre panier est vide.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.id,
            type: item.type,
            ticketId: item.ticketId || null,
            title: item.title,
            price: item.price,
            subject: item.subject || null,
          })),
          privateCallAdded: privateCallAdded && privateCallProduct ? true : false,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          campus: campus || undefined,
          locale,
          promoCode: promoCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isEn ? 'Something went wrong.' : 'Une erreur est survenue.'));
        return;
      }

      if (data.type === 'free' && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError(isEn ? 'Something went wrong.' : 'Une erreur est survenue.');
    } catch (err) {
      console.error('Cart checkout error:', err);
      setError(isEn ? 'Network error. Please try again.' : 'Erreur réseau. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 transition-opacity" onClick={closeCart} />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEn ? 'Your Cart' : 'Votre Panier'} ({items.length})
          </h2>
          <button
            onClick={closeCart}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {isEn ? 'Your cart is empty' : 'Votre panier est vide'}
              </p>
              <Link
                href="/classes"
                onClick={closeCart}
                className="inline-block mt-4 text-sm font-medium hover:underline"
                style={{ color: 'var(--color-primary-600)' }}
              >
                {isEn ? 'Browse courses' : 'Parcourir les cours'} →
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.type}-${item.id}-${item.ticketId || ''}`}
                className="flex gap-3 p-3 border rounded-lg"
                style={{ borderColor: 'var(--border-light)' }}
              >
                {item.bannerUrl ? (
                  <img src={item.bannerUrl} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{item.type === 'event' ? 'E' : 'P'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                  {item.ticketName && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.ticketName}</p>
                  )}
                  {item.subject && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-700)' }}>
                      {item.subject}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{Number(item.price).toFixed(2)}€</span>
                  <button
                    onClick={() => removeItem(item.id, item.type, item.ticketId)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    {isEn ? 'Remove' : 'Retirer'}
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Private Call Add-on */}
          {privateCallProduct && items.length > 0 && (
            <div className="mt-4 p-3 border rounded-lg" style={{ borderColor: 'var(--color-primary-200)', backgroundColor: 'var(--color-primary-50)' }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privateCallAdded}
                  onChange={(e) => setPrivateCallAdded(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{privateCallProduct.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {isEn ? '30-min private call with a top student' : 'Appel privé de 30 min avec un étudiant top'}
                  </p>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{Number(privateCallProduct.price).toFixed(2)}€</span>
              </label>
            </div>
          )}

          {/* Discount Banner */}
          {discountPercent > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                {isEn
                  ? `${discountPercent}% multi-subject discount applied! You save ${savings.toFixed(2)}€`
                  : `Réduction multi-matière de ${discountPercent}% appliquée ! Vous économisez ${savings.toFixed(2)}€`}
              </p>
            </div>
          )}

          {/* Upsell Recommendations */}
          {items.length > 0 && recommendations.length > 0 && (
            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                {isEn ? 'Students also bought' : 'Les étudiants ont aussi acheté'}
              </p>
              <div className="space-y-2">
                {recommendations.slice(0, 3).map((rec) => (
                  <Link
                    key={rec.id}
                    href={rec._isEvent ? `/e/${rec.slug}` : `/p/${rec.slug}`}
                    onClick={closeCart}
                    className="flex items-center gap-3 p-2.5 rounded-lg border transition-colors hover:bg-[var(--bg-secondary)]"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    {rec.bannerUrl ? (
                      <img src={rec.bannerUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{rec.title}</p>
                      {rec.subject && (
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{rec.subject}</span>
                      )}
                    </div>
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                      {(rec.price || 0) === 0 ? (isEn ? 'Free' : 'Gratuit') : `${rec.price}€`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Checkout Form & Total */}
        {items.length > 0 && (
          <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: 'var(--border-default)' }}>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input"
                placeholder={isEn ? 'First name *' : 'Prénom *'}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="input"
                placeholder={isEn ? 'Last name *' : 'Nom *'}
              />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="Email *"
            />
            {campuses.length > 0 && (
              <select
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                className="input select"
              >
                <option value="">{isEn ? 'Campus (optional)' : 'Campus (optionnel)'}</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="input font-mono"
              placeholder={isEn ? 'Promo code (optional)' : 'Code promo (optionnel)'}
            />

            {/* Totals */}
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>{isEn ? 'Subtotal' : 'Sous-total'}</span>
                <span>{subtotal.toFixed(2)}€</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{isEn ? `Discount (${discountPercent}%)` : `Réduction (${discountPercent}%)`}</span>
                  <span>-{discountAmount.toFixed(2)}€</span>
                </div>
              )}
              {privateCallAdded && privateCallProduct && (
                <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{isEn ? 'Private call' : 'Appel privé'}</span>
                  <span>+{Number(privateCallProduct.price).toFixed(2)}€</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1" style={{ color: 'var(--text-primary)' }}>
                <span>Total</span>
                <span>{total.toFixed(2)}€</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={submitting}
              className="w-full py-3 font-semibold rounded-lg transition-all disabled:opacity-50"
              style={{
                background: 'var(--gradient-brand)',
                color: '#fff',
              }}
            >
              {submitting
                ? (isEn ? 'Processing...' : 'Traitement...')
                : total === 0
                  ? (isEn ? 'Get for free' : 'Obtenir gratuitement')
                  : (isEn ? `Pay ${total.toFixed(2)}€` : `Payer ${total.toFixed(2)}€`)}
            </button>

            <button
              onClick={clearCart}
              className="w-full text-center text-xs py-1 transition-colors hover:text-red-500"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {isEn ? 'Clear cart' : 'Vider le panier'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
