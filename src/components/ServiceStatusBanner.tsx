import { useEffect, useSyncExternalStore } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getServiceAvailabilitySnapshot,
  reportServiceFailure,
  reportServiceRecovery,
  subscribeToServiceAvailability,
} from '@/lib/serviceAvailability';

export default function ServiceStatusBanner() {
  const service = useSyncExternalStore(
    subscribeToServiceAvailability,
    getServiceAvailabilitySnapshot,
    getServiceAvailabilitySnapshot,
  );

  useEffect(() => {
    const handleOffline = () => reportServiceFailure('offline');
    const handleOnline = () => reportServiceRecovery();

    if (!window.navigator.onLine) handleOffline();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (service.available) return null;

  const offline = service.reason === 'offline';
  const Icon = offline ? WifiOff : AlertTriangle;

  return (
    <section
      role="alert"
      aria-live="polite"
      className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-amber-950 shadow-[0_12px_28px_rgba(120,78,20,0.08)] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            {offline ? 'You appear to be offline' : 'Some Zania services are temporarily unavailable'}
          </p>
          <p className="mt-0.5 text-sm leading-5 text-amber-900/80">
            {offline
              ? 'Reconnect to the internet, then try again. Previously saved information is safe.'
              : 'Some pages or account details may not load correctly. Previously saved information is safe; please try again shortly.'}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
        className="shrink-0 border-amber-400/70 bg-white/70 text-amber-950 hover:bg-white"
      >
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
        Try again
      </Button>
    </section>
  );
}
