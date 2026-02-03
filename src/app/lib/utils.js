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

export function formatEventDate(date, locale = 'en') {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB');
}

export function formatEventTime(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatEventDateTime(date, locale = 'en') {
  return `${formatEventDate(date, locale)} - ${formatEventTime(date)}`;
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