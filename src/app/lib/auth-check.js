// src/app/lib/auth-check.js
// Verify Firebase Auth token from request headers

import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from './firebase-admin';

export async function verifyAdminAuth(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const app = initAdmin();
    if (!app) return null;

    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.error('[AUTH] Token verification failed:', err.message);
    return null;
  }
}
