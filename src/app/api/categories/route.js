// src/app/api/categories/route.js
// API for fetching categories (used by classes page and registration)

import { NextResponse } from 'next/server';
import { adminDb } from '../../lib/firebase-admin';

export async function GET() {
  try {
    const snapshot = await adminDb.collection('categories').get();
    const categories = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    return NextResponse.json({ categories });
  } catch (err) {
    console.error('[CATEGORIES API] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
