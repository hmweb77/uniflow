// src/app/e/[slug]/opengraph-metadata.js
// Dynamic Open Graph metadata for WhatsApp/social sharing
// This file should be imported in the event page's generateMetadata function

/**
 * Generate metadata for an event page including WhatsApp-optimized Open Graph tags.
 * The admin can choose which image appears when the event link is shared.
 *
 * Usage in src/app/e/[slug]/page.js:
 *   import { generateEventMetadata } from './opengraph-metadata';
 *   export async function generateMetadata({ params }) { return generateEventMetadata(params.slug); }
 */

// import { initializeApp, getApps, cert } from 'firebase-admin/app';
// import { getFirestore } from 'firebase-admin/firestore';

// function getAdminDb() {
//   if (!getApps().length) {
//     const projectId = process.env.FIREBASE_PROJECT_ID;
//     const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
//     const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
//     if (!projectId || !clientEmail || !privateKey) {
//       return null;
//     }
//     initializeApp({
//       credential: cert({
//         project_id: projectId,
//         client_email: clientEmail,
//         private_key: privateKey,
//       }),
//     });
//   }
//   return getFirestore();
// }

// export async function generateEventMetadata(slug) {
//   try {
//     const adminDb = getAdminDb();
//     if (!adminDb) {
//       return {
//         title: 'Uniflow',
//         description: 'University event ticketing platform',
//       };
//     }
//     const eventsRef = adminDb.collection('events');
//     const snapshot = await eventsRef.where('slug', '==', slug).limit(1).get();

//     if (snapshot.empty) {
//       return {
//         title: 'Event Not Found | Uniflow',
//         description: 'This event could not be found.',
//       };
//     }

//     const event = snapshot.docs[0].data();
//     const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uniflow.com';

//     // Use shareImageUrl if set by admin, otherwise fall back to bannerUrl
//     const shareImage = event.shareImageUrl || event.bannerUrl || `${appUrl}/default-og.png`;

//     const title = `${event.title} | Uniflow`;
//     const description = event.description
//       ? event.description.substring(0, 160)
//       : `Register for ${event.title}`;

//     return {
//       title,
//       description,
//       openGraph: {
//         title: event.title,
//         description,
//         url: `${appUrl}/e/${slug}`,
//         siteName: 'Uniflow',
//         images: [
//           {
//             url: shareImage,
//             width: 1200,
//             height: 630,
//             alt: event.title,
//           },
//         ],
//         type: 'website',
//       },
//       twitter: {
//         card: 'summary_large_image',
//         title: event.title,
//         description,
//         images: [shareImage],
//       },
//     };
//   } catch (err) {
//     console.error('[METADATA] Error generating event metadata:', err);
//     return {
//       title: 'Uniflow',
//       description: 'University event ticketing platform',
//     };
//   }
// }
