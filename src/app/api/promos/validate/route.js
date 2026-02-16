// src/app/api/promos/validate/route.js
// Validate promo code and return discount info

import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';

export async function POST(request) {
  try {
    const { code, eventId } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
    }

    // Find promo by code
    const promosRef = adminDb.collection('promos');
    const snapshot = await promosRef.where('code', '==', code.toUpperCase()).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 404 });
    }

    const promoDoc = snapshot.docs[0];
    const promo = promoDoc.data();

    // Check if active
    if (promo.active === false) {
      return NextResponse.json({ error: 'This promo code is no longer active' }, { status: 400 });
    }

    // Check expiry
    if (promo.expiresAt) {
      const expiryDate = promo.expiresAt.toDate ? promo.expiresAt.toDate() : new Date(promo.expiresAt);
      if (expiryDate < new Date()) {
        return NextResponse.json({ error: 'This promo code has expired' }, { status: 400 });
      }
    }

    // Check max uses
    if (promo.maxUses && (promo.usedCount || 0) >= promo.maxUses) {
      return NextResponse.json({ error: 'This promo code has reached its usage limit' }, { status: 400 });
    }

    // Check event restriction
    if (promo.eventId && promo.eventId !== eventId) {
      return NextResponse.json({ error: 'This promo code is not valid for this event' }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      code: promo.code,
    });
  } catch (err) {
    console.error('[PROMO VALIDATE] Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
