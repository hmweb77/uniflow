// src/app/p/[slug]/page.js
// Public product (digital course) detail page

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';

function ProductPurchaseForm({ product, locale }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState(null);
  const [promoDiscount, setPromoDiscount] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEn = locale === 'en';
  const basePrice = Number(product.price) || 0;

  useEffect(() => {
    fetch('/api/campuses')
      .then((r) => r.json())
      .then((data) => setCampuses(data.campuses || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPromo = params.get('promo');
      if (urlPromo) {
        setPromoCode(urlPromo);
        validatePromo(urlPromo);
      }
    }
  }, [product.id]);

  const validatePromo = async (code) => {
    if (!code.trim()) {
      setPromoStatus(null);
      setPromoDiscount(null);
      return;
    }
    setPromoStatus('checking');
    try {
      const res = await fetch('/api/promos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), productId: product.id }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoStatus('valid');
        setPromoDiscount(data);
      } else {
        setPromoStatus('invalid');
        setPromoDiscount(null);
      }
    } catch {
      setPromoStatus('invalid');
      setPromoDiscount(null);
    }
  };

  const getDiscountedPrice = () => {
    if (!promoDiscount) return basePrice;
    if (promoDiscount.discountType === 'percentage') {
      return Math.max(0, basePrice - basePrice * (promoDiscount.discountValue / 100));
    }
    return Math.max(0, basePrice - promoDiscount.discountValue);
  };

  const finalPrice = getDiscountedPrice();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError(isEn ? 'Please fill in all required fields' : 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          locale,
          promoCode: promoStatus === 'valid' ? promoCode.trim() : '',
          campus: campus || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isEn ? 'Something went wrong. Please try again.' : 'Une erreur est survenue. Veuillez réessayer.'));
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
      console.error(err);
      setError(isEn ? 'Network error. Please check your connection and try again.' : 'Erreur réseau. Vérifiez votre connexion et réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.15)' }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {isEn ? 'First Name' : 'Prénom'} *
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="input w-full"
            placeholder={isEn ? 'First name' : 'Prénom'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {isEn ? 'Last Name' : 'Nom'} *
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="input w-full"
            placeholder={isEn ? 'Last name' : 'Nom'}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Email *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input w-full"
          placeholder="email@example.com"
        />
      </div>

      {campuses.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {isEn ? 'Campus (optional)' : 'Campus (optionnel)'}
          </label>
          <select
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            className="input w-full"
          >
            <option value="">{isEn ? 'Select your campus' : 'Sélectionnez votre campus'}</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}{c.city ? ` (${c.city})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {basePrice > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {isEn ? 'Promo Code (optional)' : 'Code promo (optionnel)'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                if (promoStatus) {
                  setPromoStatus(null);
                  setPromoDiscount(null);
                }
              }}
              className="input flex-1 font-mono"
              placeholder="e.g., ESCP20"
            />
            <button
              type="button"
              onClick={() => validatePromo(promoCode)}
              disabled={!promoCode.trim() || promoStatus === 'checking'}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-secondary"
              style={{ border: '1px solid var(--border-default)' }}
            >
              {promoStatus === 'checking' ? '...' : isEn ? 'Apply' : 'Appliquer'}
            </button>
          </div>
          {promoStatus === 'valid' && (
            <p className="text-xs mt-1 text-green-600 font-medium">
              {promoDiscount?.discountType === 'percentage'
                ? `${promoDiscount.discountValue}% off applied`
                : `${promoDiscount?.discountValue} EUR off applied`}
            </p>
          )}
          {promoStatus === 'invalid' && (
            <p className="text-xs mt-1 text-red-500">
              {isEn ? 'Invalid or expired promo code' : 'Code promo invalide ou expiré'}
            </p>
          )}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {isEn
          ? "We'll send your confirmation and access link to this email. If you don't see it, please check your spam folder."
          : "Nous enverrons la confirmation et le lien d'accès à cet email. Si vous ne la voyez pas, vérifiez vos spams."}
      </p>

      {(basePrice > 0 || (basePrice === 0 && finalPrice === 0)) && (
        <div
          className="flex items-center justify-between p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isEn ? 'Total' : 'Total'}
          </span>
          <div className="text-right">
            {promoDiscount && finalPrice !== basePrice ? (
              <div className="flex items-center gap-2">
                <span className="text-sm line-through" style={{ color: 'var(--text-tertiary)' }}>
                  {basePrice.toFixed(2)} EUR
                </span>
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {finalPrice === 0 ? (isEn ? 'Free' : 'Gratuit') : `${finalPrice.toFixed(2)} EUR`}
                </span>
              </div>
            ) : (
              <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {basePrice === 0 ? (isEn ? 'Free' : 'Gratuit') : `${basePrice.toFixed(2)} EUR`}
              </span>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full btn btn-primary btn-lg disabled:opacity-50"
        style={{ minHeight: '48px' }}
      >
        {isLoading
          ? (isEn ? 'Processing...' : 'Traitement...')
          : finalPrice === 0
            ? (isEn ? 'Get for free' : 'Obtenir gratuitement')
            : (isEn ? `Pay ${finalPrice.toFixed(2)} EUR` : `Payer ${finalPrice.toFixed(2)} EUR`)}
      </button>
    </form>
  );
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug;
  const { locale } = useLocale();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (slug) fetchProduct();
  }, [slug]);

  const fetchProduct = async () => {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('slug', '==', slug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const doc = snap.docs[0];
        setProduct({ id: doc.id, ...doc.data() });
      } else {
        setError(locale === 'fr' ? 'Produit introuvable' : 'Product not found');
      }
    } catch (err) {
      console.error('Error fetching product:', err);
      setError(locale === 'fr' ? 'Erreur de chargement' : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--color-primary-500)' }} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <p className="text-lg mb-4" style={{ color: 'var(--text-secondary)' }}>{error || 'Not found'}</p>
        <Link href="/classes" className="text-indigo-600 hover:underline">← {locale === 'fr' ? 'Retour aux cours' : 'Back to classes'}</Link>
      </div>
    );
  }

  if (product.status !== 'published') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <p className="text-lg mb-4" style={{ color: 'var(--text-secondary)' }}>{locale === 'fr' ? 'Ce produit n\'est pas disponible.' : 'This product is not available.'}</p>
        <Link href="/classes" className="text-indigo-600 hover:underline">← {locale === 'fr' ? 'Retour aux cours' : 'Back to classes'}</Link>
      </div>
    );
  }

  const typeLabel =
    product.type === 'recording'
      ? locale === 'fr' ? 'Enregistrement' : 'Recording'
      : product.type === 'notes'
        ? locale === 'fr' ? 'Notes' : 'Notes'
        : product.type === 'bundle'
          ? locale === 'fr' ? 'Pack' : 'Bundle'
          : product.type;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <nav
        className="sticky top-0 z-50 glass border-b"
        style={{ borderColor: 'var(--border-light)', height: '56px' }}
      >
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/classes" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            ← {locale === 'fr' ? 'Tous les cours' : 'All courses'}
          </Link>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
        >
          {product.bannerUrl && (
            <div className="aspect-video w-full bg-gray-900">
              <img
                src={product.bannerUrl}
                alt={product.title}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap gap-2 mb-3">
              {product.categoryName && (
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  {product.categoryName}
                </span>
              )}
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {typeLabel}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {product.title}
            </h1>
            {product.description && (
              <p className="text-base whitespace-pre-wrap mb-6" style={{ color: 'var(--text-secondary)' }}>
                {product.description}
              </p>
            )}
            {product.includes && product.includes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {locale === 'fr' ? 'Ce que vous obtenez' : 'What you get'}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {product.includes.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <ProductPurchaseForm product={product} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}
