const OAUTH_CONSENT_RETURN_KEY = 'zania.oauth-consent.return';

export function getOAuthConsentPath(authorizationId: string) {
  const normalized = authorizationId.trim();
  if (!normalized || normalized.length > 512) return null;
  return `/oauth/consent?authorization_id=${encodeURIComponent(normalized)}`;
}

export function rememberOAuthConsentReturn(path: string) {
  if (!path.startsWith('/oauth/consent?') || path.startsWith('//')) return;
  window.sessionStorage.setItem(OAUTH_CONSENT_RETURN_KEY, path);
}

export function consumeOAuthConsentReturn() {
  const path = window.sessionStorage.getItem(OAUTH_CONSENT_RETURN_KEY);
  window.sessionStorage.removeItem(OAUTH_CONSENT_RETURN_KEY);
  return path?.startsWith('/oauth/consent?') && !path.startsWith('//') ? path : null;
}

export function clearOAuthConsentReturn() {
  window.sessionStorage.removeItem(OAUTH_CONSENT_RETURN_KEY);
}
