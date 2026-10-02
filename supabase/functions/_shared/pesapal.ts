const defaultSandboxSubmitOrderUrl = 'https://cybqa.pesapal.com/pesapalv3/api/Transactions/SubmitOrderRequest';
const defaultProductionSubmitOrderUrl = 'https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest';
const defaultSandboxTransactionStatusUrl = 'https://cybqa.pesapal.com/pesapalv3/api/Transactions/GetTransactionStatus';
const defaultProductionTransactionStatusUrl = 'https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus';

export type PesapalEnvironment = 'sandbox' | 'production';

export type PesapalConfig = {
  environment: PesapalEnvironment;
  consumerKey: string;
  consumerSecret: string;
  authUrl: string;
  submitOrderUrl: string;
  transactionStatusUrl: string;
  notificationId: string;
  ipnUrl: string | null;
};

export type PesapalTokenResponse = {
  token: string;
  expiresAt: string | null;
  raw: unknown;
};

export type PesapalSubmitOrderResponse = {
  orderTrackingId: string;
  merchantReference: string | null;
  redirectUrl: string;
  status: string | number | null;
  error: unknown;
  message: string | null;
  raw: unknown;
};

export type PesapalTransactionStatus = {
  paymentMethod: string | null;
  amount: number | null;
  createdDate: string | null;
  confirmationCode: string | null;
  paymentStatusDescription: string | null;
  description: string | null;
  message: string | null;
  paymentAccount: string | null;
  callBackUrl: string | null;
  statusCode: string | number | null;
  merchantReference: string | null;
  currency: string | null;
  error: unknown;
  raw: unknown;
};

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`${name} is required for Pesapal billing.`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getString(source: Record<string, unknown> | null, ...keys: string[]) {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function getNumber(source: Record<string, unknown> | null, ...keys: string[]) {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function loadPesapalConfig(): PesapalConfig {
  const environment = Deno.env.get('PESAPAL_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';

  return {
    environment,
    consumerKey: requireEnv('PESAPAL_CONSUMER_KEY'),
    consumerSecret: requireEnv('PESAPAL_CONSUMER_SECRET'),
    authUrl: requireEnv('PESAPAL_AUTH_URL'),
    submitOrderUrl: Deno.env.get('PESAPAL_SUBMIT_ORDER_URL')?.trim()
      || (environment === 'production' ? defaultProductionSubmitOrderUrl : defaultSandboxSubmitOrderUrl),
    transactionStatusUrl: Deno.env.get('PESAPAL_TRANSACTION_STATUS_URL')?.trim()
      || (environment === 'production' ? defaultProductionTransactionStatusUrl : defaultSandboxTransactionStatusUrl),
    notificationId: requireEnv('PESAPAL_NOTIFICATION_ID'),
    ipnUrl: Deno.env.get('PESAPAL_IPN_URL')?.trim() || null,
  };
}

export async function fetchPesapalToken(config: PesapalConfig): Promise<PesapalTokenResponse> {
  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consumer_key: config.consumerKey,
      consumer_secret: config.consumerSecret,
    }),
  });

  const raw = await response.json().catch(() => null);
  const payload = asRecord(raw);
  const token =
    getString(payload, 'token', 'access_token', 'bearer_token')
    || getString(asRecord(payload?.data), 'token', 'access_token', 'bearer_token');

  if (!response.ok || !token) {
    throw new Error('Could not authenticate with Pesapal.');
  }

  return {
    token,
    expiresAt: getString(payload, 'expiryDate', 'expiry_date', 'expires_at'),
    raw,
  };
}

export async function submitPesapalOrder(
  config: PesapalConfig,
  token: string,
  payload: Record<string, unknown>,
): Promise<PesapalSubmitOrderResponse> {
  const response = await fetch(config.submitOrderUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.json().catch(() => null);
  const data = asRecord(raw);
  const orderTrackingId = getString(data, 'order_tracking_id', 'orderTrackingId');
  const redirectUrl = getString(data, 'redirect_url', 'redirectUrl');

  if (!response.ok || !orderTrackingId || !redirectUrl) {
    throw new Error('Pesapal order creation failed.');
  }

  return {
    orderTrackingId,
    merchantReference: getString(data, 'merchant_reference', 'merchantReference'),
    redirectUrl,
    status: data?.status ?? null,
    error: data?.error ?? null,
    message: getString(data, 'message'),
    raw,
  };
}

export async function getPesapalTransactionStatus(
  config: PesapalConfig,
  token: string,
  orderTrackingId: string,
): Promise<PesapalTransactionStatus> {
  const url = new URL(config.transactionStatusUrl);
  url.searchParams.set('orderTrackingId', orderTrackingId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const raw = await response.json().catch(() => null);
  const data = asRecord(raw);

  if (!response.ok) {
    throw new Error('Could not fetch Pesapal transaction status.');
  }

  return {
    paymentMethod: getString(data, 'payment_method', 'paymentMethod'),
    amount: getNumber(data, 'amount'),
    createdDate: getString(data, 'created_date', 'createdDate'),
    confirmationCode: getString(data, 'confirmation_code', 'confirmationCode'),
    paymentStatusDescription: getString(data, 'payment_status_description', 'paymentStatusDescription'),
    description: getString(data, 'description'),
    message: getString(data, 'message'),
    paymentAccount: getString(data, 'payment_account', 'paymentAccount'),
    callBackUrl: getString(data, 'call_back_url', 'callBackUrl'),
    statusCode: data?.status_code ?? data?.statusCode ?? null,
    merchantReference: getString(data, 'merchant_reference', 'merchantReference'),
    currency: getString(data, 'currency'),
    error: data?.error ?? null,
    raw,
  };
}

export function mapPesapalStatus(value: string | number | null) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (normalized === 1 || normalized === '1' || normalized === 'completed') return 'completed';
  if (normalized === 2 || normalized === '2' || normalized === 'failed') return 'failed';
  if (normalized === 3 || normalized === '3' || normalized === 'reversed') return 'reversed';
  if (normalized === 0 || normalized === '0' || normalized === 'invalid') return 'invalid';
  return 'processing';
}

export function buildPesapalMerchantReference(prefix = 'zania') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}-${timestamp}-${random}`.slice(0, 50);
}

export function stripCheckoutSessionPlaceholder(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.delete('checkout_session_id');
  return parsed.toString();
}
