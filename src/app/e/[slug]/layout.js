// src/app/e/[slug]/layout.js
// Provides dynamic Open Graph / Twitter metadata for event pages (WhatsApp sharing)

import { generateEventMetadata } from './opengraph-metadata';
import { Navbar } from '@/components'; // Assuming barrel export, as in src/components/index.js

export async function generateMetadata({ params }) {
  const resolved = await params;
  const slug = typeof resolved?.slug === 'string' ? resolved.slug : null;
  return generateEventMetadata(slug);
}

export default function EventSlugLayout({ children }) {
  return (
    <>
      <Navbar />
      <div style={{ marginTop: 'var(--nav-height,4rem)' }}>
        {children}
      </div>
    </>
  );
}
