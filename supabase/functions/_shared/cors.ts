const allowedExactOrigins = new Set([
  'https://www.zaniaweddings.com',
  'https://zaniaweddings.com',
  'https://labs.zaniaweddings.com',
  'https://kenya-wedding-hub.vercel.app',
]);

const allowedHostSuffixes = [
  '-mwaniki.vercel.app',
];

const allowedHeaders =
  'authorization, x-client-info, apikey, content-type, x-request-id, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';

function resolveAllowedOrigin(origin: string | null) {
  if (!origin) return allowedExactOrigins.values().next().value ?? 'https://www.zaniaweddings.com';

  if (allowedExactOrigins.has(origin)) return origin;

  try {
    const { protocol, hostname } = new URL(origin);
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && protocol === 'http:') {
      return origin;
    }

    if (protocol === 'https:' && allowedHostSuffixes.some((suffix) => hostname.endsWith(suffix))) {
      return origin;
    }
  } catch {
    return null;
  }

  return null;
}

export function createCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(req.headers.get('Origin'));

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

export function createJsonHeaders(req: Request, headers: HeadersInit = {}): HeadersInit {
  return {
    ...createCorsHeaders(req),
    'Content-Type': 'application/json',
    ...headers,
  };
}
