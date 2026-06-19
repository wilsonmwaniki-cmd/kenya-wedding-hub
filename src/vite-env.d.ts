/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_ALL_FEATURES?: string;
  readonly VITE_ENABLE_APPLE_AUTH?: string;
  readonly VITE_ENABLE_PROFESSIONAL_NETWORK?: string;
  readonly VITE_ENABLE_SPACE_TABLE_PLAN?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_PRICING_CONFIG_JSON?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_TRACE_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
