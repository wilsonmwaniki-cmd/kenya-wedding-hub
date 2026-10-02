export type ServiceAvailabilityReason = 'backend' | 'offline';

export type ServiceAvailabilitySnapshot = {
  available: boolean;
  reason: ServiceAvailabilityReason | null;
  failedAt: number | null;
};

const FAILURE_DELAY_MS = 600;

let snapshot: ServiceAvailabilitySnapshot = {
  available: true,
  reason: null,
  failedAt: null,
};
let pendingFailure: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getServiceAvailabilitySnapshot() {
  return snapshot;
}

export function subscribeToServiceAvailability(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportServiceFailure(reason: ServiceAvailabilityReason = 'backend') {
  if (!snapshot.available) {
    if (snapshot.reason !== reason) {
      snapshot = { ...snapshot, reason };
      emit();
    }
    return;
  }

  if (pendingFailure) return;
  pendingFailure = setTimeout(() => {
    pendingFailure = null;
    snapshot = {
      available: false,
      reason,
      failedAt: Date.now(),
    };
    emit();
  }, FAILURE_DELAY_MS);
}

export function reportServiceRecovery() {
  if (pendingFailure) {
    clearTimeout(pendingFailure);
    pendingFailure = null;
  }
  if (snapshot.available) return;

  snapshot = {
    available: true,
    reason: null,
    failedAt: null,
  };
  emit();
}

export function isMonitoredServiceUrl(requestUrl: string, serviceUrl: string) {
  try {
    const request = new URL(requestUrl);
    const service = new URL(serviceUrl);
    if (request.origin !== service.origin) return false;
    return ['/rest/v1/', '/functions/v1/', '/storage/v1/'].some((prefix) =>
      request.pathname.startsWith(prefix),
    );
  } catch {
    return false;
  }
}

export function isServiceFailureStatus(status: number) {
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

export function resetServiceAvailabilityForTests() {
  if (pendingFailure) clearTimeout(pendingFailure);
  pendingFailure = null;
  snapshot = { available: true, reason: null, failedAt: null };
  listeners.clear();
}
