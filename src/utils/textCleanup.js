// src/utils/textCleanup.js
// Utility to clean text across the website - removes em dashes, en dashes, etc.

/**
 * Replace long dashes (em dash, en dash) with regular hyphens or remove them.
 * Removes the "ChatGPT vibe" of em dashes throughout the site.
 */
export function cleanDashes(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\u2014/g, ' - ')  // em dash -> space-hyphen-space
    .replace(/\u2013/g, '-')     // en dash -> hyphen
    .replace(/\s*—\s*/g, ' - ')  // fallback em dash
    .replace(/\s*–\s*/g, '-')    // fallback en dash
    .replace(/\s+-\s+-\s+/g, ' - ') // clean double dashes
    .trim();
}

/**
 * Clean all string values in an object (shallow)
 */
export function cleanObjectDashes(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    cleaned[key] = typeof value === 'string' ? cleanDashes(value) : value;
  }
  return cleaned;
}

/**
 * Process event data to remove dashes from text fields
 */
export function cleanEventText(event) {
  if (!event) return event;
  return {
    ...event,
    title: cleanDashes(event.title),
    description: cleanDashes(event.description),
    organizer: cleanDashes(event.organizer),
    whoThisIsFor: cleanDashes(event.whoThisIsFor),
  };
}
