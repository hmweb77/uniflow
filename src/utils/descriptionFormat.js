// src/utils/descriptionFormat.js
// Renders event description with bold, italic, and headings (markdown-like + safe HTML)

/**
 * Escape HTML to prevent XSS, then apply simple markdown-like formatting:
 * **bold**, *italic*, ## heading, # main title, newlines -> <br>
 */
export function formatDescription(text) {
  if (!text || typeof text !== 'string') return '';

  // Escape HTML first
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Headings (at line start): ### -> h4, ## -> h3, # -> h2 (optional space after #)
  out = out.replace(/^###\s*(.+)$/gm, (_, c) => '<h4 class="font-semibold text-base mt-4 mb-1">' + c.trim() + '</h4>');
  out = out.replace(/^##\s*(.+)$/gm, (_, c) => '<h3 class="font-semibold text-lg mt-4 mb-1">' + c.trim() + '</h3>');
  out = out.replace(/^#\s*(.+)$/gm, (_, c) => '<h2 class="font-bold text-xl mt-4 mb-2">' + c.trim() + '</h2>');

  // Bold and italic: **bold** and *italic* (bold before italic to avoid conflict)
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/_(.+?)_/g, '<em>$1</em>');

  // Newlines
  out = out.replace(/\n/g, '<br />');

  return out;
}

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'span'];

/** Strip disallowed HTML tags (keeps content). */
function stripDisallowedTags(html) {
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*>/g;
  return html.replace(tagRe, (match, tagName) =>
    ALLOWED_TAGS.includes(tagName.toLowerCase()) ? match : ''
  );
}

/**
 * If description contains pasted HTML (e.g. from Word), allow only safe tags.
 */
export function sanitizeDescriptionHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return stripDisallowedTags(html);
}

/**
 * Render description: if it contains HTML, sanitize; otherwise use markdown-like formatting.
 */
export function renderDescription(text) {
  if (!text || typeof text !== 'string') return '';
  if (text.includes('<') && text.includes('>')) {
    return sanitizeDescriptionHtml(text);
  }
  return formatDescription(text);
}
