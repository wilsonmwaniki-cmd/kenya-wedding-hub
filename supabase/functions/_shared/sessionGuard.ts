type SupabaseAdminClient = {
  rpc: (
    functionName: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export class AuthSessionError extends Error {
  status = 401;

  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

export function isAuthSessionError(error: unknown): error is AuthSessionError {
  return error instanceof AuthSessionError;
}

function extractBearerToken(authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

function getSessionIdFromAccessToken(authHeader: string | null) {
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as { session_id?: unknown };
    return typeof decoded.session_id === 'string' && decoded.session_id.trim()
      ? decoded.session_id
      : null;
  } catch {
    return null;
  }
}

export async function assertActiveAuthSession(
  adminClient: SupabaseAdminClient,
  authHeader: string | null,
  userId: string,
) {
  const sessionId = getSessionIdFromAccessToken(authHeader);
  if (!sessionId) {
    throw new AuthSessionError();
  }

  const { data, error } = await adminClient.rpc('is_active_auth_session', {
    target_session_id: sessionId,
    target_user_id: userId,
  });

  if (error) {
    console.error('Could not validate auth session state:', error.message ?? error);
    throw new AuthSessionError();
  }

  if (data !== true) {
    throw new AuthSessionError();
  }

  const trustedResult = await adminClient.rpc('is_current_trusted_auth_session', {
    target_session_id: sessionId,
    target_user_id: userId,
  });

  if (trustedResult.error) {
    console.error('Could not validate trusted device state:', trustedResult.error.message ?? trustedResult.error);
    throw new AuthSessionError();
  }

  if (trustedResult.data !== true) {
    throw new AuthSessionError();
  }

  return { sessionId };
}
