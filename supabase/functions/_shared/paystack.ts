const defaultApiBaseUrl = 'https://api.paystack.co';

export type PaystackConfig = {
  secretKey: string;
  apiBaseUrl: string;
  currency: string;
};

export type PaystackTransaction = {
  id: number | string | null;
  status: string | null;
  reference: string;
  amountSubunit: number | null;
  currency: string | null;
  paidAt: string | null;
  channel: string | null;
  gatewayResponse: string | null;
  authorizationCode: string | null;
  customerEmail: string | null;
  metadata: Record<string, unknown> | null;
  raw: unknown;
};

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required for Paystack billing.`);
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function parseMetadata(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

export function loadPaystackConfig(): PaystackConfig {
  return {
    secretKey: requireEnv('PAYSTACK_SECRET_KEY'),
    apiBaseUrl: Deno.env.get('PAYSTACK_API_BASE_URL')?.trim() || defaultApiBaseUrl,
    currency: Deno.env.get('PAYSTACK_CURRENCY')?.trim().toUpperCase() || 'KES',
  };
}

export function buildPaystackReference(prefix = 'pzania') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${prefix}-${timestamp}-${random}`.slice(0, 50);
}

export function toPaystackSubunit(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Paystack amount must be positive.');
  return Math.round(amount * 100);
}

export async function initializePaystackTransaction(
  config: PaystackConfig,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${config.apiBaseUrl}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.json().catch(() => null);
  const body = asRecord(raw);
  const data = asRecord(body?.data);
  const authorizationUrl = stringValue(data, 'authorization_url');
  const reference = stringValue(data, 'reference');
  const accessCode = stringValue(data, 'access_code');

  if (!response.ok || body?.status !== true || !authorizationUrl || !reference) {
    throw new Error(stringValue(body, 'message') || 'Paystack transaction initialization failed.');
  }

  return { authorizationUrl, reference, accessCode, raw };
}

export async function verifyPaystackTransaction(
  config: PaystackConfig,
  reference: string,
): Promise<PaystackTransaction> {
  const response = await fetch(`${config.apiBaseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` },
  });
  const raw = await response.json().catch(() => null);
  const body = asRecord(raw);
  const data = asRecord(body?.data);
  const resolvedReference = stringValue(data, 'reference');

  if (!response.ok || body?.status !== true || !data || !resolvedReference) {
    throw new Error(stringValue(body, 'message') || 'Paystack transaction verification failed.');
  }

  const authorization = asRecord(data.authorization);
  const customer = asRecord(data.customer);

  return {
    id: numberValue(data, 'id') ?? stringValue(data, 'id'),
    status: stringValue(data, 'status'),
    reference: resolvedReference,
    amountSubunit: numberValue(data, 'amount'),
    currency: stringValue(data, 'currency'),
    paidAt: stringValue(data, 'paid_at') || stringValue(data, 'paidAt'),
    channel: stringValue(data, 'channel'),
    gatewayResponse: stringValue(data, 'gateway_response'),
    authorizationCode: stringValue(authorization, 'authorization_code'),
    customerEmail: stringValue(customer, 'email'),
    metadata: parseMetadata(data.metadata),
    raw,
  };
}

export function mapPaystackStatus(status: string | null) {
  switch (status?.trim().toLowerCase()) {
    case 'success': return 'completed';
    case 'failed': return 'failed';
    case 'abandoned': return 'cancelled';
    case 'reversed': return 'reversed';
    case 'ongoing':
    case 'pending':
    case 'processing':
    case 'queued': return 'processing';
    default: return 'invalid';
  }
}

export function assertPaystackPaymentMatches(
  transaction: PaystackTransaction,
  expected: { reference: string; amountKes: number; currency: string },
) {
  if (transaction.reference !== expected.reference) throw new Error('Paystack reference mismatch.');
  if (transaction.amountSubunit !== toPaystackSubunit(expected.amountKes)) throw new Error('Paystack amount mismatch.');
  if (transaction.currency?.toUpperCase() !== expected.currency.toUpperCase()) throw new Error('Paystack currency mismatch.');
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyPaystackWebhookSignature(rawBody: string, signature: string | null, secretKey: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(bytesToHex(new Uint8Array(digest)), signature.trim().toLowerCase());
}
