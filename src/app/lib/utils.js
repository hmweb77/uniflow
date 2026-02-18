// src/app/lib/utils.js

export function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

export function generateEventSlug(title) {
  const baseSlug = slugify(title);
  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

export function formatPrice(amount) { return `${amount.toFixed(2)} €`; }

/**
 * Normalize event date from Firestore timestamp, Date, or ISO string.
 * Use in client components only (display uses environment default = user timezone).
 */
export function parseEventDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp._seconds != null) return new Date(timestamp._seconds * 1000);
  if (timestamp.seconds != null) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}

const localeToBcp47 = (locale) => (locale === 'fr' ? 'fr-FR' : 'en-GB');

/**
 * Format event date in the viewer's timezone (client-only; no timeZone = browser default).
 * @param {Date|object} date - Date, Firestore timestamp, or ISO string
 * @param {string} locale - 'en' | 'fr'
 * @param {{ long?: boolean }} options - long: weekday + long month (e.g. event page)
 */
export function formatEventDate(date, locale = 'en', options = {}) {
  const dateObj = parseEventDate(date);
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const bcp = localeToBcp47(locale);
  if (options.long) {
    return dateObj.toLocaleDateString(bcp, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return dateObj.toLocaleDateString(bcp, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format event time in the viewer's timezone (client-only; no timeZone = browser default).
 */
export function formatEventTime(date, locale = 'en') {
  const dateObj = parseEventDate(date);
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleTimeString(localeToBcp47(locale), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatEventDateTime(date, locale = 'en') {
  return `${formatEventDate(date, locale)} - ${formatEventTime(date, locale)}`;
}

export function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateCSV(data, headers) {
  const headerRow = headers.map((h) => `"${h.label}"`).join(',');
  const dataRows = data.map((row) =>
    headers.map((h) => { const escaped = String(row[h.key] || '').replace(/"/g, '""'); return `"${escaped}"`; }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

export function downloadCSV(content, filename) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function generateXLS(data, headers) {
  const headerRow = headers.map((h) => h.label).join('\t');
  const dataRows = data.map((row) =>
    headers.map((h) => String(row[h.key] || '').replace(/[\t\n\r]/g, ' ')).join('\t')
  );
  return [headerRow, ...dataRows].join('\n');
}

export function downloadXLS(content, filename) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function cn(...classes) { return classes.filter(Boolean).join(' '); }

export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

export function getShortOrderId(id) { return '#' + id.substring(0, 8).toUpperCase(); }

export function percentageChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}