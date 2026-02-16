# Uniflow Update - Integration Guide

## Overview

This update covers all requested features organized by category. Each file is ready to drop into the existing codebase.

---

## 1. Email & Confirmation Improvements

### Changed Files
- **`src/app/lib/brevo.js`** - Complete rewrite
  - Sender email changed to: `uniflow.escp@gmail.com`
  - All emojis removed from templates
  - Professional, sober color palette: dark navy (#1a1a2e), neutral grays, white
  - Added templates: `getConfirmationEmailTemplate`, `getThankYouEmailTemplate`, `get24HourReminderTemplate`
  - "Check your spam folder" notice included in confirmation email

- **`src/app/success/page.js`** - Redesigned confirmation page
  - Matches the email design (navy header, clean white body)
  - No emojis anywhere
  - Visible "Check your spam folder" notice
  - Calendar integration preserved
  - "View All Classes" button links to new `/classes` page

### ENV Update
```env
EMAIL_SENDER_ADDRESS=uniflow.escp@gmail.com
EMAIL_SENDER_NAME=Uniflow
```

---

## 2. Event Navigation & Redirect Logic

### How it works
- The checkout API now passes `category` in the redirect URL: `/success?event=X&category=b1`
- The success page shows a "View All Classes" button (links to `/classes`)
- Students can filter by B1/B2 categories on the classes page
- Direct link to all events: `/classes`

### Redirect Logic (in success page)
When a student registers for a B1 class, the success page includes `category=b1` in params, allowing the "View Classes" link to pre-filter to their level.

---

## 3. Website Structure & UX Changes

### Remove em dashes
- **`src/utils/textCleanup.js`** - Utility functions
  - `cleanDashes(text)` - Replaces em/en dashes with hyphens
  - `cleanEventText(event)` - Cleans title, description, organizer fields
  - Import and use in any component: `import { cleanDashes } from '@/utils/textCleanup'`

### Apply in components:
```jsx
import { cleanDashes } from '@/utils/textCleanup';
// In render:
<h1>{cleanDashes(event.title)}</h1>
<p>{cleanDashes(event.description)}</p>
```

### New Classes Page
- **`src/app/classes/page.js`** - Student-facing classes page
  - Categories displayed as tabs (B1 Classes, B2 Classes, etc.)
  - Grouped view when "All" is selected
  - Search functionality
  - Only shows upcoming, non-private events
  - Clean card layout with date, time, price, category badges

### Hide main page from students
- Share `/classes` as the student entry point instead of `/`
- The main landing page (`/`) remains for marketing/public
- Admin sidebar has a "Student Page" link pointing to `/classes`

---

## 4. Registration System Improvements

### Campus Field
- **Admin: `src/app/admin/campuses/page.js`** - CRUD for campuses
- **API: `src/app/api/campuses/route.js`** - Public endpoint for fetching campuses
- When creating an event, toggle "Require campus selection"
- Registration form shows campus dropdown if enabled

### Categories
- **Admin: `src/app/admin/categories/page.js`** - CRUD for categories
- **API: `src/app/api/categories/route.js`** - Public endpoint
- Categories have: name, slug, description, display order, color

### Custom Registration Fields
- Added to event creation form (admin/events/new)
- Admin defines: label, type (text/email/number/select/textarea), required flag
- For dropdown type: admin sets comma-separated options
- Fields stored in event doc as `customFields` array
- Registration form renders them dynamically
- Values saved to attendee record

### Updated Components
- **`src/components/RegistrationForm.js`** - Full registration form with:
  - Campus selector (conditional)
  - Custom fields (dynamic)
  - Promo code input
  - Price display with discount

---

## 5. WhatsApp Sharing

### Open Graph Metadata
- **`src/app/e/[slug]/opengraph-metadata.js`** - Dynamic OG tags
  - Uses `shareImageUrl` if set by admin, otherwise falls back to `bannerUrl`
  - Proper og:image, og:title, og:description tags
  - Twitter card support

### Admin Control
- Event creation form has "WhatsApp / Social Share Image URL" field
- Admin can paste a URL to any image
- If empty, defaults to event banner

### Integration in event page
```jsx
// In src/app/e/[slug]/page.js
import { generateEventMetadata } from './opengraph-metadata';
export async function generateMetadata({ params }) {
  return generateEventMetadata(params.slug);
}
```

---

## 6. Event Visibility Controls

### How it works
- Event creation form has a "Visibility" dropdown: Public / Private
- Private events are excluded from `/classes` page listings
- Private events remain accessible via direct URL (`/e/[slug]`)
- This allows creating events in advance without publishing

### Filter in classes page
```js
.filter((e) => e.status !== 'cancelled' && e.visibility !== 'private')
```

---

## 7. Marketing Features

### Post-Event Thank You Email
- **API: `src/app/api/email/thank-you/route.js`**
  - Takes `eventId`, finds all attendees, sends thank-you email
  - Includes feedback form link if configured
  - Marks event as `thankYouSent: true`
- **Template in `brevo.js`:** `getThankYouEmailTemplate()`

### Usage from admin (add button to event detail page):
```jsx
const sendThankYou = async (eventId) => {
  const res = await fetch('/api/email/thank-you', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  });
  const data = await res.json();
  alert(`Sent ${data.sent} emails`);
};
```

### Promo Codes
- **Admin: `src/app/admin/promos/page.js`** - Full management UI
  - Create codes with % or fixed EUR discounts
  - Scope to specific events or all events
  - Set max uses and expiration dates
  - Toggle active/inactive
  - Copy shareable discount links
- **API: `src/app/api/promos/validate/route.js`** - Validation endpoint
- **Checkout: `src/app/api/checkout/route.js`** - Applies promo at checkout
  - Server-side validation (never trusts client discount)
  - Increments usage counter atomically
  - Records promo on attendee record

### Digital Products
- **Admin: `src/app/admin/products/page.js`** - Product management
  - Types: Notes, Bundle, Recording, Other
  - Price, description, image, download URL
  - "Includes" list (comma-separated items)
  - Published/Draft status

---

## 8. Admin Layout

### Updated Navigation
- **`src/app/admin/layout.js`** - New sidebar items:
  - Dashboard, Events, Orders, Customers
  - Categories, Campuses, Promos, Products (NEW)
  - Quick links: Create Event, Student Page, View Site

---

## New Firestore Collections

```
campuses/
  - name: string
  - city: string
  - country: string
  - createdAt: timestamp

categories/
  - name: string
  - slug: string
  - description: string
  - order: number
  - color: string
  - createdAt: timestamp

promos/
  - code: string (uppercase)
  - discountType: 'percentage' | 'fixed'
  - discountValue: number
  - eventId: string | null
  - maxUses: number | null
  - usedCount: number
  - expiresAt: timestamp | null
  - active: boolean
  - createdAt: timestamp

products/
  - title: string
  - slug: string
  - description: string
  - price: number
  - type: 'notes' | 'bundle' | 'recording' | 'other'
  - includes: string[]
  - downloadUrl: string
  - bannerUrl: string
  - status: 'published' | 'draft'
  - isDigitalProduct: true
  - purchaseCount: number
  - totalRevenue: number
  - createdAt: timestamp
```

## Updated Event Document Fields

```
events/ (new fields)
  - visibility: 'public' | 'private'
  - category: string (category doc ID)
  - categoryName: string
  - campusRequired: boolean
  - feedbackFormUrl: string
  - shareImageUrl: string
  - customFields: Array<{
      id: string,
      label: string,
      type: 'text' | 'email' | 'number' | 'select' | 'textarea',
      required: boolean,
      options: string[]
    }>
  - thankYouSent: boolean
  - thankYouSentAt: timestamp
```

## Updated Attendee Document Fields

```
attendees/ (new fields)
  - campus: string | null
  - promoCode: string | null
  - discountAmount: number
  - originalPrice: number
  - customFields: object (key-value pairs from custom fields)
  - paymentStatus: 'paid' | 'free' | 'promo_free'
```

---

## File Summary

| File | Action | Category |
|------|--------|----------|
| `src/app/lib/brevo.js` | Replace | Email templates |
| `src/app/success/page.js` | Replace | Confirmation page |
| `src/app/classes/page.js` | New | Student classes page |
| `src/app/admin/layout.js` | Replace | Admin navigation |
| `src/app/admin/campuses/page.js` | New | Campus management |
| `src/app/admin/categories/page.js` | New | Category management |
| `src/app/admin/promos/page.js` | New | Promo code management |
| `src/app/admin/products/page.js` | New | Digital products |
| `src/app/admin/events/new/page.js` | Replace | Event creation form |
| `src/app/api/checkout/route.js` | Replace | Checkout with promos |
| `src/app/api/promos/validate/route.js` | New | Promo validation |
| `src/app/api/email/thank-you/route.js` | New | Post-event emails |
| `src/app/api/campuses/route.js` | New | Campuses API |
| `src/app/api/categories/route.js` | New | Categories API |
| `src/app/e/[slug]/opengraph-metadata.js` | New | WhatsApp sharing |
| `src/components/RegistrationForm.js` | New/Replace | Registration form |
| `src/utils/textCleanup.js` | New | Em dash removal |
