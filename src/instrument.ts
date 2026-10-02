import * as Sentry from "@sentry/react";
import React from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createTraceTargets() {
  const targets: (string | RegExp)[] = [
    "localhost",
    /^https:\/\/([a-z0-9-]+\.)?(zaniaweddings|planwithzania)\.com/,
  ];

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    return targets;
  }

  try {
    targets.push(new URL(supabaseUrl).origin);
  } catch {
    console.warn("[sentry] VITE_SUPABASE_URL is not a valid URL. Skipping trace propagation target.");
  }

  return targets;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: sentryEnvironment,
    sendDefaultPii: false,
    enableLogs: true,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACE_SAMPLE_RATE,
      import.meta.env.DEV ? 1 : 0.2,
    ),
    tracePropagationTargets: createTraceTargets(),
    replaysSessionSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
      import.meta.env.DEV ? 1 : 0.1,
    ),
    replaysOnErrorSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE,
      1,
    ),
  });
}
