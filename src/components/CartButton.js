// src/components/CartButton.js
// Floating/navbar cart icon with item count badge

'use client';

import { useCart } from '@/contexts/CartContext';

export default function CartButton() {
  const { itemCount, openCart } = useCart();

  return (
    <button
      onClick={openCart}
      className="relative p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Open cart"
      style={{ color: 'var(--text-secondary)' }}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
    </button>
  );
}
