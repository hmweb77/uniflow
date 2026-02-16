// Lazy-init Firebase Admin — safe at build time (no cert/init until first request)

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let _app = null;
let _db = null;

function initAdmin() {
  if (_app) return _app;
  const apps = getApps();
  if (apps.length > 0) {
    _app = apps[0];
    return _app;
  }

  // Option 1: Full service account JSON (must have project_id or projectId)
  const jsonKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (jsonKey) {
    try {
      const serviceAccount = JSON.parse(jsonKey);
      const projectId = serviceAccount.project_id ?? serviceAccount.projectId;
      if (projectId) {
        _app = initializeApp({
          credential: cert(serviceAccount),
          projectId: projectId,
        });
        return _app;
      }
    } catch (err) {
      console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', err.message);
    }
  }

  // Option 2: Individual env vars (FIREBASE_ADMIN_* or FIREBASE_*)
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY
  )?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    _app = initializeApp({
      credential: cert({
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      }),
      projectId,
    });
    return _app;
  }

  // Option 3: Project ID only (e.g. emulator) — no credential
  const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (publicProjectId) {
    _app = initializeApp({ projectId: publicProjectId });
    return _app;
  }

  return null;
}

function getAdminDb() {
  if (_db) return _db;
  const app = initAdmin();
  _db = app ? getFirestore(app) : null;
  return _db;
}

// Lazy proxy so `adminDb.collection(...)` only runs init on first use (at request time, not build time)
export const adminDb = new Proxy(
  {},
  {
    get(_, prop) {
      const db = getAdminDb();
      if (!db) {
        throw new Error(
          'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
        );
      }
      return db[prop];
    },
  }
);

export { getAdminDb };
export default { adminDb, getAdminDb };
