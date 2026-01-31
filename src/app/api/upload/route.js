// src/app/api/upload/route.js
// Server-side image upload to Firebase Storage using Admin SDK

import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

export const dynamic = 'force-dynamic';

// Initialize Firebase Admin for Storage
function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  // Option 1: Full service account JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({
        credential: cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (err) {
      console.error('[UPLOAD] Failed to parse service account:', err);
    }
  }

  // Option 2: Individual credentials
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  throw new Error('Firebase Admin not configured for storage. Set FIREBASE_SERVICE_ACCOUNT_KEY or individual credentials.');
}

export async function POST(request) {
  console.log('[UPLOAD] Request received');

  try {
    // Check storage bucket configuration
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
      console.error('[UPLOAD] Storage bucket not configured');
      return NextResponse.json(
        { error: 'Storage not configured. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const path = formData.get('path') || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('[UPLOAD] File:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP` },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Initialize Firebase Admin
    let app;
    try {
      app = getAdminApp();
    } catch (initErr) {
      console.error('[UPLOAD] Firebase init error:', initErr);
      return NextResponse.json(
        { error: 'Storage service not available. Check Firebase configuration.' },
        { status: 500 }
      );
    }

    const bucket = getStorage(app).bucket();

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const filename = `${path}/${timestamp}-${random}.${ext}`;

    console.log('[UPLOAD] Uploading to:', filename);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Firebase Storage
    const fileRef = bucket.file(filename);
    
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Make the file publicly accessible
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    console.log('[UPLOAD] Success:', publicUrl);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type,
    });

  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    
    // Return helpful error message
    let errorMessage = 'Failed to upload file';
    if (error.message?.includes('not configured')) {
      errorMessage = 'Storage not configured. Please contact admin.';
    } else if (error.message?.includes('permission')) {
      errorMessage = 'Storage permission denied. Check Firebase rules.';
    } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('network')) {
      errorMessage = 'Network error. Please try again.';
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}

// GET: Check upload configuration
export async function GET() {
  const config = {
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Configured' : '❌ Missing',
    adminCredentials: 
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? '✅ Service account' :
      process.env.FIREBASE_ADMIN_PRIVATE_KEY ? '✅ Individual credentials' :
      '❌ Missing',
  };

  // Try to initialize and test
  try {
    const app = getAdminApp();
    const bucket = getStorage(app).bucket();
    config.connection = '✅ Connected to: ' + bucket.name;
  } catch (err) {
    config.connection = '❌ Error: ' + err.message;
  }

  return NextResponse.json(config);
}