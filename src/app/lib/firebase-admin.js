// src/app/lib/firebase-admin.js

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function initAdmin() {
  const apps = getApps();
  
  if (apps.length > 0) {
    return apps[0];
  }

  // Option 1: Using service account JSON (recommended for production)
  // You'll need to download this from Firebase Console > Project Settings > Service Accounts
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  // Option 2: Using individual environment variables
  if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    });
  }

  // Option 3: Fallback for development (uses Application Default Credentials)
  // This works if you're running locally with `gcloud auth application-default login`
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const app = initAdmin();
export const adminDb = getFirestore(app);

export default app;