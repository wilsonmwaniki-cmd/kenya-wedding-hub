import { supabase } from '@/integrations/supabase/client';
import { normalizeInvokeError } from '@/lib/invokeErrors';

export type ZaniaPayEligibilityState =
  | 'available'
  | 'couple_upgrade'
  | 'professional_subscription_required'
  | 'professional_not_ready'
  | 'not_connected'
  | 'invoice_unavailable';

export type ZaniaPayInvoiceEligibility = {
  allowed: boolean;
  state: ZaniaPayEligibilityState;
  invoiceId?: string;
  invoiceNumber?: string;
  weddingId?: string;
  professionalUserId?: string;
  professionalAccountId?: string;
  balanceDue?: number;
  currency?: string;
  coupleCanSend?: boolean;
  professionalCanAccept?: boolean;
  professionalAccountStatus?: 'not_started' | 'pending' | 'verified' | 'paused' | 'rejected';
  reason: string;
};

export type ZaniaPayOrder = {
  id: string;
  invoiceId: string;
  amount: number;
  processingFee: number;
  serviceFee: number;
  totalCharged: number;
  currency: string;
  paymentMethod: 'mpesa' | 'card';
  status: string;
  expiresAt: string;
};

export const ZANIA_PAY_PROCESSING_RATES = {
  mpesa: 0.015,
  card: 0.029,
} as const;

export const ZANIA_PAY_SERVICE_FEE_KES = 50;
export const ZANIA_PAY_MINIMUM_PAYMENT_KES = 1_000;

export function calculatePayerProcessingFee(
  amount: number,
  paymentMethod: 'mpesa' | 'card',
  serviceFee = ZANIA_PAY_SERVICE_FEE_KES,
) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const rate = ZANIA_PAY_PROCESSING_RATES[paymentMethod];
  return Math.ceil(((amount + serviceFee) * rate) / (1 - rate));
}

export function calculateZaniaPayCharge(
  amount: number,
  paymentMethod: 'mpesa' | 'card',
) {
  const serviceFee = ZANIA_PAY_SERVICE_FEE_KES;
  const processingFee = calculatePayerProcessingFee(amount, paymentMethod, serviceFee);
  return {
    invoicePayment: amount,
    processingFee,
    serviceFee,
    totalCharged: amount + processingFee + serviceFee,
  };
}

export type ZaniaPayInitiation = {
  order: ZaniaPayOrder;
  mode: 'sandbox' | 'live';
  message: string;
  authorizationUrl?: string | null;
};

export class ZaniaPaySessionExpiredError extends Error {
  constructor() {
    super('Your secure payment session has expired. Please sign in again.');
    this.name = 'ZaniaPaySessionExpiredError';
  }
}

export function isZaniaPaySessionExpired(error: unknown) {
  if (error instanceof ZaniaPaySessionExpiredError) return true;
  return error instanceof Error && /session has expired|sign in again/i.test(error.message);
}

export type ZaniaPayAccountStatus = {
  id?: string;
  audience?: 'vendor' | 'planner';
  status: 'not_started' | 'pending' | 'verified' | 'paused' | 'rejected';
  provider?: string;
  mode?: 'sandbox' | 'live';
  providerVerificationStatus?: 'not_started' | 'pending' | 'verified' | 'failed';
  settlementCurrency?: string;
  settlementDestinationHint?: string;
  destinationType?: string;
  destinationName?: string;
  isDefault?: boolean;
  rejectionReason?: string;
  submittedAt?: string;
  verifiedAt?: string;
  lastProviderSyncAt?: string;
};

export type ZaniaPayDestination = {
  code: string;
  name: string;
  type: string;
};

export type AdminZaniaPayAccount = ZaniaPayAccountStatus & {
  id: string;
  professionalName: string;
  professionalUserId: string;
  updatedAt?: string;
};

export type AdminZaniaPayLedgerRow = {
  id: string;
  createdAt: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTitle: string;
  payerName: string;
  professionalName: string;
  mode: 'sandbox' | 'live';
  method: 'mpesa' | 'card';
  status: string;
  invoiceAmount: number;
  providerFee: number;
  zaniaFee: number;
  totalCharged: number;
  professionalSettlement: number;
  settlementStatus?: string;
  providerReference?: string;
  reconciliationStatus: string;
  reconciliationAttempts: number;
  lastReconciliationError?: string;
  refundAmount: number;
  refundInvoiceAmount: number;
  refundStatus?: string;
  disputeStatus?: string;
  exception?: string;
};

type ZaniaPayRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function normalizeEligibility(value: unknown): ZaniaPayInvoiceEligibility {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    allowed: row.allowed === true,
    state: typeof row.state === 'string'
      ? row.state as ZaniaPayEligibilityState
      : 'invoice_unavailable',
    invoiceId: typeof row.invoiceId === 'string' ? row.invoiceId : undefined,
    invoiceNumber: typeof row.invoiceNumber === 'string' ? row.invoiceNumber : undefined,
    weddingId: typeof row.weddingId === 'string' ? row.weddingId : undefined,
    professionalUserId: typeof row.professionalUserId === 'string' ? row.professionalUserId : undefined,
    professionalAccountId: typeof row.professionalAccountId === 'string' ? row.professionalAccountId : undefined,
    balanceDue: typeof row.balanceDue === 'number' ? row.balanceDue : Number(row.balanceDue ?? 0),
    currency: typeof row.currency === 'string' ? row.currency : undefined,
    coupleCanSend: row.coupleCanSend === true,
    professionalCanAccept: row.professionalCanAccept === true,
    professionalAccountStatus: typeof row.professionalAccountStatus === 'string'
      ? row.professionalAccountStatus as ZaniaPayInvoiceEligibility['professionalAccountStatus']
      : undefined,
    reason: typeof row.reason === 'string' ? row.reason : 'This invoice is not available for payment.',
  };
}

function normalizeAccountStatus(value: unknown): ZaniaPayAccountStatus {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    audience: row.audience === 'vendor' || row.audience === 'planner' ? row.audience : undefined,
    status: typeof row.status === 'string'
      ? row.status as ZaniaPayAccountStatus['status']
      : 'not_started',
    provider: typeof row.provider === 'string' ? row.provider : undefined,
    mode: row.mode === 'sandbox' || row.mode === 'live' ? row.mode : undefined,
    providerVerificationStatus: typeof row.providerVerificationStatus === 'string'
      ? row.providerVerificationStatus as ZaniaPayAccountStatus['providerVerificationStatus']
      : undefined,
    settlementCurrency: typeof row.settlementCurrency === 'string' ? row.settlementCurrency : undefined,
    settlementDestinationHint: typeof row.settlementDestinationHint === 'string' ? row.settlementDestinationHint : undefined,
    destinationType: typeof row.destinationType === 'string' ? row.destinationType : undefined,
    destinationName: typeof row.destinationName === 'string' ? row.destinationName : undefined,
    isDefault: row.isDefault === true,
    rejectionReason: typeof row.rejectionReason === 'string' ? row.rejectionReason : undefined,
    submittedAt: typeof row.submittedAt === 'string' ? row.submittedAt : undefined,
    verifiedAt: typeof row.verifiedAt === 'string' ? row.verifiedAt : undefined,
    lastProviderSyncAt: typeof row.lastProviderSyncAt === 'string' ? row.lastProviderSyncAt : undefined,
  };
}

export function normalizeAdminZaniaPayAccount(value: unknown): AdminZaniaPayAccount | null {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.professionalUserId !== 'string') return null;
  return {
    ...normalizeAccountStatus(row),
    id: row.id,
    professionalName: typeof row.professionalName === 'string' && row.professionalName.trim()
      ? row.professionalName.trim()
      : 'Professional',
    professionalUserId: row.professionalUserId,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

export async function getZaniaPayAccountStatus() {
  const { data, error } = await (supabase as unknown as ZaniaPayRpcClient).rpc(
    'get_zania_pay_account_status',
    {},
  );
  if (error) throw error;
  return normalizeAccountStatus(data);
}

export async function listZaniaPayAccounts() {
  const { data, error } = await (supabase as unknown as ZaniaPayRpcClient).rpc(
    'list_zania_pay_accounts',
    {},
  );
  if (error) throw error;
  return Array.isArray(data) ? data.map(normalizeAccountStatus) : [];
}

export async function setDefaultZaniaPayAccount(accountId: string) {
  const { error } = await (supabase as unknown as ZaniaPayRpcClient).rpc(
    'set_default_zania_pay_account',
    { _account_id: accountId },
  );
  if (error) throw error;
}

export async function setCommercialDocumentPayoutAccount(documentId: string, accountId: string | null) {
  const { error } = await (supabase as unknown as ZaniaPayRpcClient).rpc(
    'set_commercial_document_payout_account',
    { _document_id: documentId, _account_id: accountId },
  );
  if (error) throw error;
}

async function invokePayoutSetup(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('setup-zania-pay-account', { body });
  if (error) {
    const normalized = await normalizeInvokeError(error, 'Could not set up payouts.');
    throw new Error(normalized.message);
  }
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
}

export async function loadZaniaPayDestinations(input: {
  audience: 'vendor' | 'planner';
  vendorListingId?: string | null;
}) {
  const result = await invokePayoutSetup({
    action: 'banks',
    audience: input.audience,
    vendorListingId: input.vendorListingId ?? null,
  });
  return Array.isArray(result.destinations)
    ? result.destinations.flatMap((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : null;
      return typeof row?.code === 'string' && typeof row.name === 'string'
        ? [{ code: row.code, name: row.name, type: typeof row.type === 'string' ? row.type : 'bank' }]
        : [];
    })
    : [];
}

export async function connectZaniaPayAccount(input: {
  audience: 'vendor' | 'planner';
  vendorListingId?: string | null;
  bankCode: string;
  accountNumber: string;
  termsAccepted: boolean;
}) {
  const result = await invokePayoutSetup({ action: 'connect', ...input });
  return normalizeAccountStatus(result.account);
}

export async function refreshZaniaPayAccountStatus(input: {
  audience: 'vendor' | 'planner';
  vendorListingId?: string | null;
  accountId?: string;
}) {
  const result = await invokePayoutSetup({
    action: 'status',
    audience: input.audience,
    vendorListingId: input.vendorListingId ?? null,
    accountId: input.accountId,
  });
  return Array.isArray(result.accounts) ? result.accounts.map(normalizeAccountStatus) : [];
}

export async function listAdminZaniaPayAccounts() {
  const result = await invokePayoutSetup({ action: 'admin-list' });
  return Array.isArray(result.accounts)
    ? result.accounts.flatMap((value) => {
      const account = normalizeAdminZaniaPayAccount(value);
      return account ? [account] : [];
    })
    : [];
}

export async function refreshAdminZaniaPayAccount(accountId: string) {
  const result = await invokePayoutSetup({ action: 'admin-refresh', accountId });
  const account = normalizeAdminZaniaPayAccount(result.account);
  if (!account) throw new Error('Paystack returned an invalid payout account status.');
  return account;
}

export async function listAdminZaniaPayLedger() {
  const { data, error } = await (supabase as unknown as ZaniaPayRpcClient).rpc('admin_list_zania_pay_ledger', { _limit: 150 });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).flatMap((value) => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : null;
    if (!row || typeof row.id !== 'string') return [];
    return [{
      id: row.id,
      createdAt: String(row.createdAt ?? ''),
      invoiceId: String(row.invoiceId ?? ''),
      invoiceNumber: String(row.invoiceNumber ?? ''),
      invoiceTitle: String(row.invoiceTitle ?? ''),
      payerName: String(row.payerName ?? 'Couple'),
      professionalName: String(row.professionalName ?? 'Professional'),
      mode: row.mode === 'live' ? 'live' : 'sandbox',
      method: row.method === 'card' ? 'card' : 'mpesa',
      status: String(row.status ?? 'created'),
      invoiceAmount: Number(row.invoiceAmount ?? 0),
      providerFee: Number(row.providerFee ?? 0),
      zaniaFee: Number(row.zaniaFee ?? 0),
      totalCharged: Number(row.totalCharged ?? 0),
      professionalSettlement: Number(row.professionalSettlement ?? 0),
      settlementStatus: typeof row.settlementStatus === 'string' ? row.settlementStatus : undefined,
      providerReference: typeof row.providerReference === 'string' ? row.providerReference : undefined,
      reconciliationStatus: String(row.reconciliationStatus ?? 'not_checked'),
      reconciliationAttempts: Number(row.reconciliationAttempts ?? 0),
      lastReconciliationError: typeof row.lastReconciliationError === 'string' ? row.lastReconciliationError : undefined,
      refundAmount: Number(row.refundAmount ?? 0),
      refundInvoiceAmount: Number(row.refundInvoiceAmount ?? 0),
      refundStatus: typeof row.refundStatus === 'string' ? row.refundStatus : undefined,
      disputeStatus: typeof row.disputeStatus === 'string' ? row.disputeStatus : undefined,
      exception: typeof row.exception === 'string' ? row.exception : undefined,
    } satisfies AdminZaniaPayLedgerRow];
  });
}

export async function reconcileAdminZaniaPayLedger() {
  const { data, error } = await supabase.functions.invoke('zania-pay-operations', { body: { action: 'reconcile' } });
  if (error) {
    const normalized = await normalizeInvokeError(error, 'Could not reconcile Zania Pay.');
    throw new Error(normalized.message);
  }
  return data as { checked: number; paymentChecked?: number; refundChecked?: number; settlementChecked?: number };
}

export async function requestAdminZaniaPayRefund(input: {
  orderId: string;
  invoiceAmount: number;
  reason: string;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.functions.invoke('zania-pay-operations', {
    body: { action: 'refund', ...input },
  });
  if (error) {
    const normalized = await normalizeInvokeError(error, 'Could not request this refund.');
    throw new Error(normalized.message);
  }
  return data as { refundId: string; status: string };
}

export async function getZaniaPayInvoiceEligibility(invoiceId: string) {
  // A shared invoice can be opened from Mail or Safari while Supabase is still
  // restoring its stored session. Refresh here so the first view does not
  // incorrectly hide the M-Pesa form until the payer refreshes the page.
  const { data: refreshedAuth, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshedAuth.session) {
    throw new ZaniaPaySessionExpiredError();
  }

  const { data, error } = await (supabase as unknown as ZaniaPayRpcClient).rpc('get_zania_pay_invoice_eligibility', {
    _invoice_id: invoiceId,
  } as never);

  if (error) throw error;
  return normalizeEligibility(data);
}

export async function initiateZaniaPayPayment(input: {
  invoiceId: string;
  amount: number;
  paymentMethod: 'mpesa' | 'card';
  phone?: string;
  idempotencyKey: string;
}) {
  // A payment can be opened from an email client after the browser has been
  // backgrounded. Refresh immediately before creating an order so the Edge
  // Function receives a current bearer token.
  const { data: refreshedAuth, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshedAuth.session) {
    throw new ZaniaPaySessionExpiredError();
  }

  const { data, error } = await supabase.functions.invoke('create-zania-pay-order', {
    body: input,
  });

  if (error) {
    const normalized = await normalizeInvokeError(error, 'Could not start payment.');
    if (/session has expired|sign in again/i.test(normalized.message)) {
      throw new ZaniaPaySessionExpiredError();
    }
    throw new Error(normalized.message);
  }
  return data as ZaniaPayInitiation;
}

export function buildZaniaPayIdempotencyKey(invoiceId: string) {
  return `${invoiceId}:${crypto.randomUUID()}`;
}
