import { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      appearance?: 'always' | 'execute' | 'interaction-only';
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
      'timeout-callback': () => void;
      'unsupported-callback': () => void;
      size?: 'normal' | 'compact' | 'flexible';
      theme?: 'light' | 'dark' | 'auto';
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileChallengeProps = {
  action?: string;
  siteKey: string;
  onError: (message: string | null) => void;
  onVerify: (token: string | null) => void;
};

const loadTurnstile = () => new Promise<TurnstileApi>((resolve, reject) => {
  if (window.turnstile) {
    resolve(window.turnstile);
    return;
  }

  const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  const script = existingScript ?? document.createElement('script');

  const handleLoad = () => {
    if (window.turnstile) resolve(window.turnstile);
    else reject(new Error('The security check could not be loaded.'));
  };
  const handleError = () => reject(new Error('The security check could not be loaded. Check your connection and try again.'));

  script.addEventListener('load', handleLoad, { once: true });
  script.addEventListener('error', handleError, { once: true });

  if (!existingScript) {
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    // Dynamic scripts default to async. The Turnstile API is rendered only from
    // its load callback, so keep the script ordered and avoid its async/defer
    // readiness warning in single-page navigation.
    script.async = false;
    document.head.appendChild(script);
  }
});

export default function TurnstileChallenge({ action = 'authenticate', siteKey, onError, onVerify }: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const recoveryAttemptRef = useRef(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let widgetId: string | null = null;

    onVerify(null);
    onError(null);
    setLoading(true);
    recoveryAttemptRef.current = 0;

    void loadTurnstile()
      .then((turnstile) => {
        if (disposed || !containerRef.current) return;
        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: 'interaction-only',
          size: 'flexible',
          theme: 'light',
          callback: (token) => {
            if (disposed) return;
            setLoading(false);
            onError(null);
            onVerify(token);
          },
          'expired-callback': () => {
            if (disposed) return;
            onVerify(null);
            onError('The security check expired. Please complete it again.');
          },
          'timeout-callback': () => {
            if (disposed) return;
            onVerify(null);
            onError('The security check timed out. Please try again.');
          },
          'unsupported-callback': () => {
            if (disposed) return;
            setLoading(false);
            onVerify(null);
            onError('This browser cannot run the security check. Try another browser or disable strict content blocking.');
          },
          'error-callback': () => {
            if (disposed) return;

            // Mobile browsers can occasionally lose the first challenge request
            // while switching networks. Reset it once before asking the person
            // to do anything, keeping sign-in out of a dead end.
            if (recoveryAttemptRef.current === 0 && widgetId) {
              recoveryAttemptRef.current += 1;
              setLoading(true);
              onVerify(null);
              onError(null);
              window.setTimeout(() => {
                if (!disposed && widgetId && window.turnstile) window.turnstile.reset(widgetId);
              }, 700);
              return;
            }

            setLoading(false);
            onVerify(null);
            onError('The security check could not be completed. Check your connection and try again.');
          },
        });
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setLoading(false);
        onVerify(null);
        onError(cause instanceof Error ? cause.message : 'The security check could not be loaded.');
      });

    return () => {
      disposed = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onError, onVerify, siteKey]);

  return (
    <div className="min-w-0" aria-live="polite">
      <div ref={containerRef} className="min-h-0 w-full overflow-hidden" />
      {loading ? <p className="text-xs leading-5 text-current/60">Running a quick security check…</p> : null}
    </div>
  );
}
