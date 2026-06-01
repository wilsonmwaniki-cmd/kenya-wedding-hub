type ConnectionAction = 'accept' | 'decline';
type ConnectionRequestType = 'planner' | 'vendor';

const encoder = new TextEncoder();

function getConnectionTokenSecret() {
  return (
    Deno.env.get('CONNECTION_RESPONSE_SECRET') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    ''
  );
}

function buildPayload(
  requestId: string,
  action: ConnectionAction,
  requestType: ConnectionRequestType,
  exp: number,
) {
  return `${requestId}:${action}:${requestType}:${exp}`;
}

async function hmacHex(key: string, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createConnectionResponseToken(params: {
  requestId: string;
  action: ConnectionAction;
  requestType: ConnectionRequestType;
  exp: number;
}) {
  const secret = getConnectionTokenSecret();
  if (!secret) {
    throw new Error('Connection response signing secret is not configured');
  }

  return hmacHex(
    secret,
    buildPayload(params.requestId, params.action, params.requestType, params.exp),
  );
}

export async function verifyConnectionResponseToken(params: {
  requestId: string;
  action: ConnectionAction;
  requestType: ConnectionRequestType;
  exp: number;
  token: string;
}) {
  const secret = getConnectionTokenSecret();
  if (!secret) {
    return false;
  }

  if (!Number.isFinite(params.exp) || params.exp <= Date.now()) {
    return false;
  }

  const expected = await hmacHex(
    secret,
    buildPayload(params.requestId, params.action, params.requestType, params.exp),
  );
  return params.token === expected;
}
