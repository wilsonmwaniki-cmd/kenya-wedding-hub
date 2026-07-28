const BUNDLE_RECOVERY_KEY = 'zania:bundle-recovery-attempted';

const BUNDLE_ERROR_PATTERNS = [
  /chunkloaderror/i,
  /loading chunk [\d-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /unable to preload css/i,
];

function errorMessage(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isRecoverableBundleError(error: unknown) {
  const message = errorMessage(error);
  return BUNDLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function tryRecoverFromBundleError(error: unknown) {
  if (typeof window === 'undefined' || !isRecoverableBundleError(error)) return false;

  try {
    if (window.sessionStorage.getItem(BUNDLE_RECOVERY_KEY)) return false;
    window.sessionStorage.setItem(BUNDLE_RECOVERY_KEY, String(Date.now()));
  } catch {
    // Without a durable marker, reloading could create an infinite loop.
    return false;
  }

  window.location.reload();
  return true;
}

export function installBundleRecovery() {
  if (typeof window === 'undefined') return () => undefined;

  const handlePreloadError = (event: Event) => {
    const preloadEvent = event as Event & { payload?: unknown };
    if (tryRecoverFromBundleError(preloadEvent.payload)) {
      event.preventDefault();
    }
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    if (tryRecoverFromBundleError(event.reason)) {
      event.preventDefault();
    }
  };
  const handleWindowError = (event: ErrorEvent) => {
    if (tryRecoverFromBundleError(event.error ?? event.message)) {
      event.preventDefault();
    }
  };

  window.addEventListener('vite:preloadError', handlePreloadError);
  window.addEventListener('unhandledrejection', handleRejection);
  window.addEventListener('error', handleWindowError);

  // A successful startup clears the one-shot marker for a future deployment.
  const clearMarkerTimer = window.setTimeout(() => {
    try {
      window.sessionStorage.removeItem(BUNDLE_RECOVERY_KEY);
    } catch {
      // Storage can be unavailable in hardened browsing modes.
    }
  }, 10_000);

  return () => {
    window.clearTimeout(clearMarkerTimer);
    window.removeEventListener('vite:preloadError', handlePreloadError);
    window.removeEventListener('unhandledrejection', handleRejection);
    window.removeEventListener('error', handleWindowError);
  };
}
