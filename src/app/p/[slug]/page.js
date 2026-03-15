// src/app/p/[slug]/page.js
// Public product (digital course) detail page

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';
import { useCart } from '@/contexts/CartContext';
import CartButton from '@/components/CartButton';
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

// ─── Countdown Widget ────────────────────────────────────────────
function CountdownWidget({ date, label, locale }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = date?.toDate ? date.toDate() : new Date(date);
  if (target <= now) return null;

  const diff = target - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
    >
      <svg className="w-5 h-5 flex-shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div>
        <p className="text-sm font-semibold">{label || (locale === 'fr' ? 'Examen approche' : 'Exam approaching')}</p>
        <p className="text-xs opacity-80 font-mono">{days}d {hours}h {minutes}m</p>
      </div>
    </div>
  );
}

// ─── Star Rating ─────────────────────────────────────────────────
function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className="text-sm"
          style={{ color: star <= rating ? '#f59e0b' : '#d1d5db' }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ─── Testimonial Card ────────────────────────────────────────────
function TestimonialCard({ testimonial }) {
  if (!testimonial || !testimonial.visible) return null;
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
    >
      <StarRating rating={testimonial.rating || 5} />
      <p className="text-sm mt-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
        &ldquo;{testimonial.text}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        {testimonial.photoUrl && (
          <img src={testimonial.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        )}
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {testimonial.name}
        </span>
      </div>
    </div>
  );
}

// ─── Badge Row ───────────────────────────────────────────────────
function BadgeDisplay({ badgeToggles }) {
  if (!badgeToggles) return null;
  const badges = [];
  if (badgeToggles.bestseller) badges.push({ label: 'Bestseller', bg: '#fef3c7', color: '#92400e' });
  if (badgeToggles.new) badges.push({ label: 'New', bg: '#dbeafe', color: '#1e40af' });
  if (badgeToggles.limited) badges.push({ label: 'Limited', bg: '#fee2e2', color: '#991b1b' });
  if (badges.length === 0) return null;
  return (
    <>
      {badges.map((b) => (
        <span key={b.label} className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: b.bg, color: b.color }}>
          {b.label}
        </span>
      ))}
    </>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────
function RecommendationCard({ product, locale }) {
  return (
    <Link
      href={`/p/${product.slug}`}
      className="block rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
    >
      <div className="h-28 overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        {product.bannerUrl ? (
          <img src={product.bannerUrl} alt={product.title} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #2d2d3f, #1a1a2e)' }} />
        )}
      </div>
      <div className="p-3">
        <h4 className="text-sm font-semibold line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>{product.title}</h4>
        <p className="text-sm font-medium" style={{ color: 'var(--color-primary-600)' }}>
          {product.price === 0 ? (locale === 'fr' ? 'Gratuit' : 'Free') : `${product.price} EUR`}
        </p>
      </div>
    </Link>
  );
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug;
  const { locale } = useLocale();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    if (slug) fetchProduct();
  }, [slug]);

  const fetchProduct = async () => {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('slug', '==', slug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const productDoc = snap.docs[0];
        const productData = { id: productDoc.id, ...productDoc.data() };
        setProduct(productData);

        // Fetch related products
        const relatedIds = productData.relatedProductIds || [];
        if (relatedIds.length > 0) {
          const relatedPromises = relatedIds.slice(0, 4).map(async (id) => {
            try {
              const relDoc = await getDoc(doc(db, 'products', id));
              if (relDoc.exists() && relDoc.data().status === 'published') {
                return { id: relDoc.id, ...relDoc.data() };
              }
            } catch {}
            return null;
          });
          const related = (await Promise.all(relatedPromises)).filter(Boolean);
          setRelatedProducts(related);
        }
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
        <Link href="/classes" className="text-indigo-600 hover:underline">{locale === 'fr' ? '← Retour aux cours' : '← Back to classes'}</Link>
      </div>
    );
  }

  if (product.status !== 'published') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <p className="text-lg mb-4" style={{ color: 'var(--text-secondary)' }}>{locale === 'fr' ? 'Ce produit n\'est pas disponible.' : 'This product is not available.'}</p>
        <Link href="/classes" className="text-indigo-600 hover:underline">{locale === 'fr' ? '← Retour aux cours' : '← Back to classes'}</Link>
      </div>
    );
  }

  const isEn = locale === 'en';
  const typeLabel =
    product.type === 'recording' ? (isEn ? 'Recording' : 'Enregistrement')
    : product.type === 'notes' ? 'Notes'
    : product.type === 'bundle' ? (isEn ? 'Bundle' : 'Pack')
    : product.type;

  const testimonials = (product.testimonials || []).filter((t) => t.visible);
  const hasRichDescription = product.descriptionRich && product.descriptionRich.trim().length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <nav
        className="sticky top-0 z-50 glass border-b"
        style={{ borderColor: 'var(--border-light)', height: '56px' }}
      >
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/classes" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isEn ? '← All courses' : '← Tous les cours'}
          </Link>
          <div className="flex items-center gap-2">
            <CartButton />
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ─── Main product card ──────────────────────────────── */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
        >
          {product.bannerUrl && (
            <div className="aspect-video w-full bg-gray-900">
              <img src={product.bannerUrl} alt={product.title} className="w-full h-full object-contain" />
            </div>
          )}
          <div className="p-6 md:p-8">
            {/* Badges row */}
            <div className="flex flex-wrap gap-2 mb-3">
              <BadgeDisplay badgeToggles={product.badgeToggles} />
              {product.categoryName && (
                <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  {product.categoryName}
                </span>
              )}
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {typeLabel}
              </span>
              {product.subject && (
                <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>
                  {product.subject}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {product.title}
            </h1>

            {/* Countdown widget */}
            {product.countdownDate && (
              <div className="mb-6">
                <CountdownWidget date={product.countdownDate} label={product.countdownLabel} locale={locale} />
              </div>
            )}

            {/* Description */}
            {hasRichDescription ? (
              <div
                className="prose prose-sm max-w-none mb-6"
                style={{ color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: product.descriptionRich }}
              />
            ) : product.description ? (
              <p className="text-base whitespace-pre-wrap mb-6" style={{ color: 'var(--text-secondary)' }}>
                {product.description}
              </p>
            ) : null}

            {/* What you get */}
            {product.includes && product.includes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isEn ? 'What you get' : 'Ce que vous obtenez'}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {product.includes.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Learning outcomes */}
            {product.learningOutcomes && product.learningOutcomes.length > 0 && (
              <div
                className="mb-6 rounded-xl p-5 border"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isEn ? 'What you\'ll learn' : 'Ce que vous apprendrez'}
                </h3>
                <ul className="space-y-2">
                  {product.learningOutcomes.map((outcome, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Exam alignment */}
            {product.examAlignment && (
              <div
                className="mb-6 rounded-xl p-4 border flex items-start gap-3"
                style={{ backgroundColor: '#fefce8', borderColor: '#fde68a' }}
              >
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#a16207' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                    {isEn ? 'Exam Alignment' : 'Alignement examen'}
                  </p>
                  <p className="text-sm" style={{ color: '#a16207' }}>{product.examAlignment}</p>
                </div>
              </div>
            )}

            {/* Who is this for */}
            {product.whoIsThisFor && (
              <div
                className="mb-6 rounded-xl p-4 border"
                style={{ backgroundColor: 'var(--color-primary-50)', borderColor: 'var(--color-primary-100)' }}
              >
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-primary-600)' }}>
                  {isEn ? 'Who is this for?' : 'Pour qui est ce cours ?'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-primary-700)' }}>{product.whoIsThisFor}</p>
              </div>
            )}

            {/* Bundle contents */}
            {product.type === 'bundle' && product.bundleContents && product.bundleContents.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isEn ? 'Included in this bundle' : 'Inclus dans ce pack'}
                </h3>
                <div className="space-y-2">
                  {product.bundleContents.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-3 rounded-lg border"
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {item.title || item.productId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Add to Cart + Buy Now ──────────────────────── */}
            <button
              type="button"
              onClick={() => {
                addItem({
                  id: product.id,
                  type: 'product',
                  title: product.title,
                  price: Number(product.price) || 0,
                  subject: product.subject || '',
                  bannerUrl: product.bannerUrl || '',
                  slug: product.slug,
                });
                setAddedToCart(true);
                setTimeout(() => setAddedToCart(false), 2000);
              }}
              className="w-full btn btn-lg mb-4 font-semibold transition-colors"
              style={{
                backgroundColor: addedToCart ? '#16a34a' : 'var(--bg-tertiary)',
                color: addedToCart ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                minHeight: '48px',
              }}
            >
              {addedToCart
                ? (isEn ? 'Added to Cart' : 'Ajouté au panier')
                : (isEn ? 'Add to Cart' : 'Ajouter au panier')}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'var(--border-light)' }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>
                  {isEn ? 'or buy now' : 'ou acheter directement'}
                </span>
              </div>
            </div>

            <ProductPurchaseForm product={product} locale={locale} />
          </div>
        </div>

        {/* ─── Testimonials section ───────────────────────────── */}
        {testimonials.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {isEn ? 'What students say' : 'Ce que disent les étudiants'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testimonials.slice(0, 3).map((t, i) => (
                <TestimonialCard key={i} testimonial={t} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Recommendations section ────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {isEn ? 'Students who bought this also bought' : 'Les étudiants ont aussi acheté'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((rp) => (
                <RecommendationCard key={rp.id} product={rp} locale={locale} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
