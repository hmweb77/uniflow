// src/contexts/CartContext.js
// Cart state management with localStorage persistence and multi-subject discount logic

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'uniflow-cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [discountRules, setDiscountRules] = useState({ twoSubjects: 10, threeSubjects: 20 });
  const [privateCallProduct, setPrivateCallProduct] = useState(null);
  const [privateCallAdded, setPrivateCallAdded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (parsed.privateCallAdded) setPrivateCallAdded(true);
      }
    } catch {}
  }, []);

  // Persist cart to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, privateCallAdded }));
    } catch {}
  }, [items, privateCallAdded]);

  // Fetch discount rules and private call product from site_config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/app/lib/firebase');
        const configDoc = await getDoc(doc(db, 'site_config', 'global'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.discountRules) {
            setDiscountRules({
              twoSubjects: data.discountRules.twoSubjects || 10,
              threeSubjects: data.discountRules.threeSubjects || 20,
            });
          }
          if (data.privateCallProductId) {
            const productDoc = await getDoc(doc(db, 'products', data.privateCallProductId));
            if (productDoc.exists()) {
              setPrivateCallProduct({ id: productDoc.id, ...productDoc.data() });
            }
          }
        }
      } catch (err) {
        console.error('CartContext: Failed to fetch config:', err);
      }
    };
    fetchConfig();
  }, []);

  const addItem = useCallback((item) => {
    // item: { id, type: 'product'|'event', title, price, subject, bannerUrl, slug, ticketId?, ticketName? }
    setItems((prev) => {
      // Don't add duplicates
      const exists = prev.some((i) =>
        i.id === item.id && i.type === item.type && (i.ticketId || '') === (item.ticketId || '')
      );
      if (exists) return prev;
      return [...prev, item];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id, type, ticketId) => {
    setItems((prev) =>
      prev.filter((i) => !(i.id === id && i.type === type && (i.ticketId || '') === (ticketId || '')))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setPrivateCallAdded(false);
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  // Calculate multi-subject discount
  const getDiscount = useCallback(() => {
    // Only count non-bundle items with subjects
    const subjectItems = items.filter((i) => i.subject && i.type !== 'bundle-item');
    const distinctSubjects = new Set(subjectItems.map((i) => i.subject));
    const count = distinctSubjects.size;

    if (count >= 3) return discountRules.threeSubjects;
    if (count >= 2) return discountRules.twoSubjects;
    return 0;
  }, [items, discountRules]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const privateCallPrice = privateCallAdded && privateCallProduct ? (Number(privateCallProduct.price) || 0) : 0;
  const discountPercent = getDiscount();

  // Discount applies to non-bundle items only
  const discountableTotal = items
    .filter((i) => i.type !== 'bundle-item')
    .reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const discountAmount = Math.round(discountableTotal * (discountPercent / 100) * 100) / 100;

  const total = Math.max(0, subtotal - discountAmount + privateCallPrice);
  const savings = discountAmount;

  const itemCount = items.length + (privateCallAdded ? 1 : 0);

  const value = {
    items,
    itemCount,
    isOpen,
    openCart,
    closeCart,
    addItem,
    removeItem,
    clearCart,
    subtotal,
    discountPercent,
    discountAmount,
    savings,
    total,
    privateCallProduct,
    privateCallAdded,
    setPrivateCallAdded,
    discountRules,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
