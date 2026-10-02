const blockedTagsPattern = /<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|style)\b[^>]*>/gi;
const eventHandlerPattern = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const dangerousUrlPattern = /\s+(href|src)\s*=\s*(["']?)\s*(?:javascript|data|vbscript):[^"'\s>]*/gi;
const dangerousStylePattern = /\s+style\s*=\s*(["'])[^"']*(?:expression\s*\(|javascript\s*:|data\s*:|url\s*\()[^"']*\1/gi;

export function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function sanitizeBasicHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(blockedTagsPattern, '')
    .replace(eventHandlerPattern, '')
    .replace(dangerousUrlPattern, '')
    .replace(dangerousStylePattern, '');
}
