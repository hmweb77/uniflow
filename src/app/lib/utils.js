// src/app/lib/utils.js

// Generate URL-friendly slug from text
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start
    .replace(/-+$/, '');         // Trim - from end
}

// Generate unique slug with timestamp
export function generateEventSlug(title) {
  const baseSlug = slugify(title);
  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

// Format price in EUR
export function formatPrice(amount) {
  return `${amount.toFixed(2)} €`;
}

// Format date for display
export function formatEventDate(date, locale = 'en') {
  const dateObj = date instanceof Date ? date : new Date(date);
  const formatStr = locale === 'fr' ? 'dd MMMM yyyy' : 'MMMM dd, yyyy';
  return dateObj.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB');
}

// Format time for display
export function formatEventTime(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Format date and time together
export function formatEventDateTime(date, locale = 'en') {
  return `${formatEventDate(date, locale)} - ${formatEventTime(date)}`;
}

// Convert Firestore timestamp to Date
export function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}

// Validate email format
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generate CSV from data
export function generateCSV(data, headers) {
  const headerRow = headers.map((h) => `"${h.label}"`).join(',');
  const dataRows = data.map((row) =>
    headers
      .map((h) => {
        const value = row[h.key] || '';
        // Escape quotes and wrap in quotes
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// Download CSV file
export function downloadCSV(content, filename) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Generate XLS (tab-separated) from data
export function generateXLS(data, headers) {
  const headerRow = headers.map((h) => h.label).join('\t');
  const dataRows = data.map((row) =>
    headers
      .map((h) => {
        const value = row[h.key] || '';
        // Replace tabs and newlines
        return String(value).replace(/[\t\n\r]/g, ' ');
      })
      .join('\t')
  );
  return [headerRow, ...dataRows].join('\n');
}

// Download XLS file
export function downloadXLS(content, filename) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Classname helper (like clsx)
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Format currency
export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Generate short order ID from document ID
export function getShortOrderId(id) {
  return '#' + id.substring(0, 8).toUpperCase();
}

// Calculate percentage change
export function percentageChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}