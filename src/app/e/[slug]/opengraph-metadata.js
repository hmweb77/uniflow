// src/app/e/[slug]/opengraph-metadata.js
// Dynamic Open Graph metadata for WhatsApp/social sharing
// FIXED: Strip markdown formatting for clean social previews

import { adminDb } from '../../lib/firebase-admin';

/**
 * Strip markdown formatting and HTML tags for clean OG/social previews.
 * Removes **bold**, *italic*, # headings, HTML tags, and cleans up whitespace.
 */
function cleanForPreview(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove markdown headings (### ## #)
    .replace(/^#{1,4}\s*/gm, '')
    // Remove bold markers **text** -> text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // Remove italic markers *text* -> text
    .replace(/\*(.+?)\*/g, '$1')
    // Remove underscore italic _text_ -> text
    .replace(/_(.+?)_/g, '$1')
    // Remove em dashes and en dashes
    .replace(/[\u2014\u2013]/g, '-')
    // Collapse multiple newlines into a single space
    .replace(/\n+/g, ' ')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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

    // Clean description: strip markdown/HTML, truncate for OG
    const rawDesc = event.description || '';
    const cleanDesc = cleanForPreview(rawDesc);
    const description = cleanDesc
      ? cleanDesc.substring(0, 157) + (cleanDesc.length > 157 ? '...' : '')
      : `Register for ${event.title}`;

    // Build a richer preview with date info if available (UTC for consistent preview)
    let eventDateStr = '';
    if (event.date) {
      try {
        const d = event.date.toDate ? event.date.toDate() : new Date(event.date);
        eventDateStr = d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });
      } catch {}
    }
    const ogDescription = eventDateStr ? `${eventDateStr} · ${description}` : description;

    return {
      title,
      description: ogDescription,
      openGraph: {
        title: event.title,
        description: ogDescription,
        url: `${appUrl}/e/${slug}`,
        siteName: 'Uniflow',
        images: [{ url: shareImage, width: 1200, height: 630, alt: event.title }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: event.title,
        description: ogDescription,
        images: [shareImage],
      },
    };
  } catch (err) {
    console.error('[METADATA] Error generating event metadata:', err);
    return { title: 'Uniflow', description: 'University event ticketing platform' };
  }
}