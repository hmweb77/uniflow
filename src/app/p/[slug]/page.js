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
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {product.price === 0
                  ? (locale === 'fr' ? 'Gratuit' : 'Free')
                  : `${product.price} EUR`}
              </p>
              <a
                href={product.downloadUrl || '#'}
                target={product.downloadUrl ? '_blank' : undefined}
                rel={product.downloadUrl ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                {product.downloadUrl
                  ? (locale === 'fr' ? 'Accéder au contenu' : 'Access content')
                  : (locale === 'fr' ? 'Bientôt disponible' : 'Coming soon')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
