// src/app/e/[slug]/layout.js
// Provides dynamic Open Graph / Twitter metadata for event pages (WhatsApp sharing)

// import { generateEventMetadata } from './opengraph-metadata';

// export async function generateMetadata({ params }) {
//   const resolved = await params;
//   const slug = typeof resolved?.slug === 'string' ? resolved.slug : null;
//   return generateEventMetadata(slug);
// }

export default function EventSlugLayout({ children }) {
  return children;
}
