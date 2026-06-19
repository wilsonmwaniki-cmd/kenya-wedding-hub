import posthog from 'posthog-js';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let posthogInitialized = false;

export const posthogEnabled = Boolean(posthogKey);

if (typeof window !== 'undefined' && posthogKey && !posthogInitialized) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    person_profiles: 'identified_only',
  });

  posthogInitialized = true;
}

export { posthog };
