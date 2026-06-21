const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_HTML_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', '']);
const SAFE_HTML_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'small',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);
const SAFE_HTML_ATTRS = new Set([
  'align',
  'alt',
  'aria-label',
  'class',
  'colspan',
  'href',
  'rel',
  'rowspan',
  'style',
  'target',
  'title',
]);
const DANGEROUS_CSS_PATTERNS = /(?:expression\s*\(|javascript\s*:|data\s*:|url\s*\()/i;

export function normalizeSafeUrl(value?: string | null, options: { allowRelative?: boolean } = {}) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, options.allowRelative ? window.location.origin : undefined);
    if (!SAFE_URL_PROTOCOLS.has(url.protocol)) return null;
    return options.allowRelative && url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : url.href;
  } catch {
    return null;
  }
}

export function normalizeExternalUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const safeUrl = normalizeSafeUrl(candidate);
  if (!safeUrl) return null;

  const protocol = new URL(safeUrl).protocol;
  return protocol === 'http:' || protocol === 'https:' ? safeUrl : null;
}

export function normalizeEmailHref(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  return normalizeSafeUrl(`mailto:${trimmed}`);
}

export function normalizePhoneHref(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  return normalizeSafeUrl(`tel:${trimmed.replace(/[^\d+*#(),.\-\s]/g, '')}`);
}

export function displaySafeUrl(value?: string | null) {
  const safeUrl = normalizeExternalUrl(value);
  if (!safeUrl) return '';
  return safeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function sanitizeHtml(html: string) {
  if (typeof window === 'undefined' || !html.trim()) return '';

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  document.querySelectorAll('script, iframe, object, embed, link, meta, base, form, input, button, textarea, select').forEach((node) => {
    node.remove();
  });

  document.body.querySelectorAll('*').forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (!SAFE_HTML_TAGS.has(tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith('on') || !SAFE_HTML_ATTRS.has(name)) {
        element.removeAttribute(attr.name);
        return;
      }

      if ((name === 'href' || name === 'src') && !isSafeHtmlUrl(value)) {
        element.removeAttribute(attr.name);
        return;
      }

      if (name === 'style' && DANGEROUS_CSS_PATTERNS.test(value)) {
        element.removeAttribute(attr.name);
      }
    });

    if (tagName === 'a') {
      element.setAttribute('rel', 'noopener noreferrer');
      if (element.getAttribute('target') === '_blank') {
        element.setAttribute('target', '_blank');
      }
    }
  });

  return document.body.innerHTML;
}

export function isSafeMarkdownUrl(value?: string | null) {
  if (!value) return '';
  const safeUrl = normalizeSafeUrl(value, { allowRelative: true });
  return safeUrl ?? '';
}

function isSafeHtmlUrl(value: string) {
  if (!value || value.startsWith('#')) return true;
  try {
    const url = new URL(value, window.location.origin);
    return SAFE_HTML_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}
