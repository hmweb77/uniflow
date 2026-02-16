// src/app/api/campuses/route.js
// API for fetching campuses (used by registration forms)

import { NextResponse } from 'next/server';
import { adminDb } from '../../lib/firebase-admin';

export async function GET() {
  try {
    const snapshot = await adminDb.collection('campuses').get();
    const campuses = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return NextResponse.json({ campuses });
  } catch (err) {
    console.error('[CAMPUSES API] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch campuses' }, { status: 500 });
  }
}
