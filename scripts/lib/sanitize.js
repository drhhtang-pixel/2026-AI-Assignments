// Shared helpers for turning untrusted submission data (folder names, <title>,
// url.txt) into safe HTML. Used by build-gallery.js and validate-submission.js.
// Node.js built-ins only.

// Escapes text for HTML element content and for double- or single-quoted
// attribute values. Not safe for unquoted attributes, <script>, or <style>.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Decodes the entities a <title> commonly contains, so that escaping the
// result again does not show "&amp;" literally. Output must still be escaped.
function decodeBasicEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|#39);/gi, (m, code) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    const lower = code.toLowerCase();
    if (named[lower]) return named[lower];
    const num = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    if (!Number.isFinite(num) || num < 0x20 || num > 0x10ffff || (num >= 0xd800 && num <= 0xdfff)) return m;
    return String.fromCodePoint(num);
  });
}

// Percent-encodes one path segment (e.g. a submission folder name) for use in
// a relative URL. Callers must still escapeHtml() the full URL for attributes.
function encodePathSegment(segment) {
  return encodeURIComponent(segment);
}

// Characters never allowed in a url.txt link: whitespace, controls, quotes,
// angle brackets, backtick, backslash.
const FORBIDDEN_URL_CHARS = /[\s\u0000-\u001f\u007f"'<>`\\]/;

// Returns { ok: true, url } with the normalized https URL, or { ok: false, reason }.
function checkExternalUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, reason: 'empty URL' };
  }
  if (FORBIDDEN_URL_CHARS.test(raw)) {
    return { ok: false, reason: 'URL contains whitespace, control characters, quotes, <, >, ` or \\' };
  }
  if (!raw.startsWith('https://')) {
    return { ok: false, reason: 'URL must start with https://' };
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL cannot be parsed' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `URL scheme must be https: (got ${parsed.protocol})` };
  }
  if (!parsed.hostname) {
    return { ok: false, reason: 'URL has no host' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL must not contain a username or password' };
  }
  // Normalization can decode characters (e.g. https://%22.example/ → a literal quote in the host)
  if (FORBIDDEN_URL_CHARS.test(parsed.href)) {
    return { ok: false, reason: 'normalized URL contains whitespace, control characters, quotes, <, >, ` or \\' };
  }
  return { ok: true, url: parsed.href };
}

module.exports = { escapeHtml, decodeBasicEntities, encodePathSegment, checkExternalUrl };
