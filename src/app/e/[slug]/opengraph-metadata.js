// src/app/e/[slug]/opengraph-metadata.js
// Dynamic Open Graph metadata for WhatsApp/social sharing

import { adminDb } from '../../lib/firebase-admin';

export async function generateEventMetadata(slug) {
  try {
    if (!slug) {
      return { title: 'Uniflow', description: 'University event ticketing platform' };
    }

    const snapshot = await adminDb.collection('events').where('slug', '==', slug).limit(1).get();

    if (snapshot.empty) {
      return { title: 'Event Not Found | Uniflow', description: 'This event could not be found.' };
    }

    const event = snapshot.docs[0].data();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uniflow.com';
    const shareImage = event.shareImageUrl || event.bannerUrl || `${appUrl}/default-og.png`;
    const title = `${event.title} | Uniflow`;
    const description = event.description ? event.description.substring(0, 160) : `Register for ${event.title}`;

    return {
      title,
      description,
      openGraph: {
        title: event.title,
        description,
        url: `${appUrl}/e/${slug}`,
        siteName: 'Uniflow',
        images: [{ url: shareImage, width: 1200, height: 630, alt: event.title }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: event.title,
        description,
        images: [shareImage],
      },
    };
  } catch (err) {
    console.error('[METADATA] Error generating event metadata:', err);
    return { title: 'Uniflow', description: 'University event ticketing platform' };
  }
}
