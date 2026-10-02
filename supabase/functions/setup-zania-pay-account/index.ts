import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { AbuseProtectionError, assertRecentFunctionEventLimit } from '../_shared/abuseProtection.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';
import { loadPaystackConfig, loadPaystackTestConfig, type PaystackConfig } from '../_shared/paystack.ts';
import { assertLivePaystackKey } from '../_shared/zaniaPayPilot.ts';
import { DEMO_EXTERNAL_ACTION_MESSAGE, isTemporaryDemoUser } from '../_shared/demoGuard.ts';

const termsVersion = 'zania-pay-professional-2026-09-02';

type JsonRecord = Record<string, unknown>;

class SetupError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function json(req: Request, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...createCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function enabledMode(): 'sandbox' | 'live' {
  if (Deno.env.get('ZANIA_PAY_ONBOARDING_ENABLED') !== 'true') {
    throw new SetupError('Payout setup is not open yet.', 503);
  }
  const mode = Deno.env.get('ZANIA_PAY_ONBOARDING_MODE') || Deno.env.get('ZANIA_PAY_MODE');
  return mode === 'live' ? 'live' : 'sandbox';
}

function paystackConfig(mode: 'sandbox' | 'live') {
  return mode === 'live' ? loadPaystackConfig() : loadPaystackTestConfig();
}

function assertSandboxQualifier(mode: 'sandbox' | 'live', userId: string) {
  if (mode !== 'sandbox') return;
  const qualifierUserId = text(Deno.env.get('ZANIA_PAY_SANDBOX_QUALIFIER_USER_ID'));
  if (!qualifierUserId || qualifierUserId !== userId) {
    throw new SetupError('Payout setup is still being tested.', 403);
  }
}

async function paystackRequest(config: PaystackConfig, path: string, init?: RequestInit) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const raw = await response.json().catch(() => null);
  const body = asRecord(raw);
  if (!response.ok || body?.status !== true) {
    throw new SetupError(text(body?.message) || 'Paystack could not complete payout setup.', 502);
  }
  return asRecord(body.data) ?? body.data;
}

type BankOption = { code: string; name: string; type: string };

async function listKenyanDestinations(config: PaystackConfig): Promise<BankOption[]> {
  const data = await paystackRequest(config, '/bank?country=kenya&currency=KES&perPage=100');
  if (!Array.isArray(data)) throw new SetupError('Paystack did not return payout destinations.', 502);
  return data.flatMap((item) => {
    const row = asRecord(item);
    const code = text(row?.code);
    const name = text(row?.name);
    const type = text(row?.type) || 'bank';
    if (!code || !name || row?.active === false) return [];
    return [{ code, name, type }];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

function accountResponse(row: JsonRecord | null) {
  if (!row) return { status: 'not_started' };
  return {
    id: row.id,
    audience: row.audience,
    status: row.status,
    provider: row.provider,
    mode: row.mode,
    providerVerificationStatus: row.provider_verification_status,
    settlementCurrency: row.settlement_currency,
    settlementDestinationHint: row.settlement_destination_hint,
    destinationType: asRecord(row.metadata)?.destination_type,
    destinationName: asRecord(row.metadata)?.destination_name,
    isDefault: row.is_default === true,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    lastProviderSyncAt: row.last_provider_sync_at,
  };
}

function adminAccountResponse(row: JsonRecord, professionalName: string) {
  return {
    ...accountResponse(row),
    professionalName,
    professionalUserId: row.professional_user_id,
    updatedAt: row.updated_at,
  };
}

async function assertAdminAccess(
  serviceClient: ReturnType<typeof createClient>,
  authHeader: string,
  userId: string,
) {
  await assertActiveAuthSession(serviceClient, authHeader, userId);
  const { data, error } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new SetupError('Only Zania admins can review payout accounts.', 403);
}

async function loadProfessionalNames(
  serviceClient: ReturnType<typeof createClient>,
  accounts: JsonRecord[],
) {
  const userIds = [...new Set(accounts.map((row) => text(row.professional_user_id)).filter(Boolean))];
  const listingIds = [...new Set(accounts.map((row) => text(row.vendor_listing_id)).filter(Boolean))];
  const [profilesResult, listingsResult] = await Promise.all([
    userIds.length
      ? serviceClient.from('profiles').select('user_id, full_name, company_name').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    listingIds.length
      ? serviceClient.from('vendor_listings').select('id, business_name').in('id', listingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (listingsResult.error) throw listingsResult.error;

  const profiles = new Map((profilesResult.data ?? []).map((row) => [
    text(row.user_id),
    text(row.company_name) || text(row.full_name),
  ]));
  const listings = new Map((listingsResult.data ?? []).map((row) => [text(row.id), text(row.business_name)]));
  return new Map(accounts.map((row) => {
    const userId = text(row.professional_user_id);
    const listingName = listings.get(text(row.vendor_listing_id));
    return [userId, listingName || profiles.get(userId) || 'Professional'];
  }));
}

async function listAdminAccounts(serviceClient: ReturnType<typeof createClient>) {
  const { data, error } = await serviceClient
    .from('zania_pay_accounts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const accounts = (data ?? []) as JsonRecord[];
  const names = await loadProfessionalNames(serviceClient, accounts);
  return accounts.map((row) => adminAccountResponse(row, names.get(text(row.professional_user_id)) || 'Professional'));
}

async function loadOwnedAccounts(serviceClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await serviceClient
    .from('zania_pay_accounts')
    .select('*')
    .eq('professional_user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as JsonRecord[];
}

async function assertProfessionalAccess(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  audience: string,
  vendorListingId: string | null,
) {
  if (audience !== 'vendor' && audience !== 'planner') {
    throw new SetupError('Choose a vendor or planner account.');
  }
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role, full_name, company_name, company_phone')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== audience) throw new SetupError('This payout account does not match your Zania account.', 403);

  const now = new Date();
  const { data: entitlement, error: entitlementError } = await serviceClient
    .from('professional_entitlements')
    .select('effective_from, effective_to')
    .eq('user_id', userId)
    .eq('audience', audience)
    .eq('feature_key', 'payments_accept')
    .eq('status', 'active')
    .maybeSingle();
  if (entitlementError) throw entitlementError;
  const startsAt = entitlement?.effective_from ? new Date(entitlement.effective_from) : null;
  const endsAt = entitlement?.effective_to ? new Date(entitlement.effective_to) : null;
  if (!entitlement || (startsAt && startsAt > now) || (endsAt && endsAt <= now)) {
    throw new SetupError('Upgrade your professional plan before connecting a payout account.', 403);
  }

  if (audience === 'vendor') {
    const { data: listing, error: listingError } = await serviceClient
      .from('vendor_listings')
      .select('id, business_name, phone')
      .eq('id', vendorListingId || '')
      .eq('user_id', userId)
      .maybeSingle();
    if (listingError) throw listingError;
    if (!listing) throw new SetupError('Finish your vendor listing before connecting payouts.');
    return { businessName: text(listing.business_name), contactPhone: text(listing.phone) };
  }

  return {
    businessName: text(profile.company_name) || text(profile.full_name),
    contactPhone: text(profile.company_phone),
  };
}

async function syncAccount(
  serviceClient: ReturnType<typeof createClient>,
  config: PaystackConfig,
  account: JsonRecord,
  mode: 'sandbox' | 'live',
) {
  const reference = text(account.provider_account_reference);
  if (!reference || account.mode !== mode) return account;
  const provider = asRecord(await paystackRequest(config, `/subaccount/${encodeURIComponent(reference)}`));
  const providerVerified = provider?.is_verified === true && provider.active !== false;
  const status = providerVerified ? 'verified' : 'pending';
  const now = new Date().toISOString();
  const { data, error } = await serviceClient.from('zania_pay_accounts').update({
    status,
    provider_verification_status: providerVerified ? 'verified' : 'pending',
    verified_at: providerVerified ? (account.verified_at || now) : null,
    rejection_reason: null,
    last_provider_sync_at: now,
  }).eq('id', String(account.id)).select('*').single();
  if (error) throw error;
  return data as JsonRecord;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);

  const requestId = crypto.randomUUID();
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new SetupError('Sign in before setting up payouts.', 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new SetupError('Payout services are not configured.', 500);

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) throw new SetupError('Sign in before setting up payouts.', 401);
    if (isTemporaryDemoUser(user)) throw new SetupError(DEMO_EXTERNAL_ACTION_MESSAGE, 403);

    const body = asRecord(await req.json().catch(() => null));
    const action = text(body?.action) || 'status';

    if (action === 'admin-list' || action === 'admin-refresh') {
      await assertAdminAccess(serviceClient, authHeader, user.id);
      if (action === 'admin-list') {
        return json(req, { accounts: await listAdminAccounts(serviceClient) });
      }

      const accountId = text(body?.accountId);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) {
        throw new SetupError('Choose a valid payout account.');
      }
      const { data: account, error: accountError } = await serviceClient
        .from('zania_pay_accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) throw new SetupError('Payout account not found.', 404);
      const accountMode = account.mode === 'live' ? 'live' : 'sandbox';
      const synced = await syncAccount(serviceClient, paystackConfig(accountMode), account as JsonRecord, accountMode);
      const names = await loadProfessionalNames(serviceClient, [synced]);
      await logFunctionEvent({
        functionName: 'setup-zania-pay-account',
        severity: 'info',
        status: 'success',
        eventType: 'admin_payout_account_sync',
        message: 'Admin refreshed a professional payout account from Paystack.',
        userId: user.id,
        audience: text(synced.audience),
        entityId: accountId,
        requestId,
        details: { mode: accountMode, provider: 'paystack', resultingStatus: synced.status },
      });
      return json(req, {
        account: adminAccountResponse(
          synced,
          names.get(text(synced.professional_user_id)) || 'Professional',
        ),
      });
    }

    const mode = enabledMode();
    assertSandboxQualifier(mode, user.id);
    const config = paystackConfig(mode);
    if (mode === 'live') assertLivePaystackKey(config.secretKey);
    const audience = text(body?.audience);
    const vendorListingId = text(body?.vendorListingId) || null;
    const professional = await assertProfessionalAccess(serviceClient, user.id, audience, vendorListingId);

    if (action === 'banks') {
      return json(req, { mode, destinations: await listKenyanDestinations(config) });
    }

    if (action === 'status') {
      const accountId = text(body?.accountId);
      const accounts = await loadOwnedAccounts(serviceClient, user.id);
      const candidates = accountId ? accounts.filter((account) => account.id === accountId) : accounts;
      if (accountId && candidates.length === 0) throw new SetupError('Payout account not found.', 404);
      const synced = await Promise.all(candidates.map((account) => (
        account.mode === mode ? syncAccount(serviceClient, config, account, mode) : account
      )));
      const untouched = accountId ? accounts.filter((account) => account.id !== accountId) : [];
      const allAccounts = [...synced, ...untouched].sort((left, right) => Number(right.is_default) - Number(left.is_default));
      return json(req, { accounts: allAccounts.map((account) => accountResponse(account)) });
    }

    if (action !== 'connect') throw new SetupError('Choose a valid payout setup action.');
    await assertActiveAuthSession(serviceClient, authHeader, user.id);
    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'setup-zania-pay-account',
      userId: user.id,
      eventType: 'payout_account_attempt',
      lookbackMs: 60 * 60 * 1000,
      maxAttempts: 3,
      message: 'Too many payout setup attempts. Wait an hour and try again.',
      retryAfterSeconds: 60 * 60,
    });

    const bankCode = text(body?.bankCode);
    const accountNumber = text(body?.accountNumber).replace(/\D/g, '');
    if (body?.termsAccepted !== true) throw new SetupError('Accept the payout terms to continue.');
    if (!/^\d{6,20}$/.test(accountNumber)) throw new SetupError('Enter a valid account or M-Pesa number.');
    const destination = (await listKenyanDestinations(config)).find((item) => item.code === bankCode);
    if (!destination) throw new SetupError('Choose a supported payout destination.');
    if (!professional.businessName) throw new SetupError('Add your business name before connecting payouts.');

    const lockToken = crypto.randomUUID();
    await logFunctionEvent({
      functionName: 'setup-zania-pay-account',
      severity: 'info',
      status: 'success',
      eventType: 'payout_account_attempt',
      message: 'Professional payout account setup requested.',
      userId: user.id,
      requestId,
      details: { audience, mode, provider: 'paystack', destinationType: destination.type },
    });
    const { data: account, error: accountError } = await serviceClient.rpc('claim_zania_pay_account_setup', {
      p_professional_user_id: user.id,
      p_audience: audience,
      p_vendor_listing_id: audience === 'vendor' ? vendorListingId : null,
      p_mode: mode,
      p_destination_hint: `${destination.name} ••••${accountNumber.slice(-4)}`,
      p_terms_version: termsVersion,
      p_lock_token: lockToken,
    });
    if (accountError?.code === '55P03') {
      throw new SetupError('Payout setup is already in progress. Wait a moment and check the status.', 409);
    }
    if (accountError) throw accountError;

    const providerPayload = {
      business_name: professional.businessName,
      settlement_bank: destination.code,
      account_number: accountNumber,
      percentage_charge: 0,
      description: 'Zania Pay professional settlement account',
      primary_contact_email: user.email,
      primary_contact_name: professional.businessName,
      primary_contact_phone: professional.contactPhone || undefined,
      metadata: JSON.stringify({ zania_pay_account_id: account.id, audience, mode }),
    };
    let saved: JsonRecord;
    let providerVerified = false;
    try {
      const providerData = asRecord(await paystackRequest(
        config,
        '/subaccount',
        { method: 'POST', body: JSON.stringify(providerPayload) },
      ));
      const providerReference = text(providerData?.subaccount_code);
      if (!providerReference) throw new SetupError('Paystack did not return a payout account reference.', 502);
      providerVerified = providerData?.is_verified === true && providerData.active !== false;

      const { data, error: saveError } = await serviceClient.rpc('finish_zania_pay_account_setup', {
        p_account_id: account.id,
        p_professional_user_id: user.id,
        p_lock_token: lockToken,
        p_provider_reference: providerReference,
        p_provider_verified: providerVerified,
        p_destination_type: destination.type,
        p_destination_name: destination.name,
      });
      if (saveError) throw saveError;
      saved = data as JsonRecord;
    } catch (providerError) {
      await serviceClient.rpc('fail_zania_pay_account_setup', {
        p_account_id: account.id,
        p_professional_user_id: user.id,
        p_lock_token: lockToken,
        p_reason: providerError instanceof Error ? providerError.message : 'Could not verify this payout account.',
      });
      throw providerError;
    }

    await logFunctionEvent({
      functionName: 'setup-zania-pay-account',
      severity: 'info',
      status: 'success',
      eventType: 'payout_account_submitted',
      message: 'Professional payout account submitted to Paystack.',
      userId: user.id,
      entityId: String(account.id),
      requestId,
      details: { audience, mode, provider: 'paystack', providerVerified, destinationType: destination.type },
    });

    return json(req, {
      mode,
      message: providerVerified ? 'Your payout account is ready.' : 'Your payout account is being verified.',
      account: accountResponse(saved),
    });
  } catch (error) {
    console.error('setup-zania-pay-account failed:', error instanceof Error ? error.message : error);
    const status = error instanceof SetupError
      ? error.status
      : error instanceof AbuseProtectionError
        ? 429
        : isAuthSessionError(error)
          ? 401
          : 500;
    return json(req, { error: error instanceof Error ? error.message : 'Could not set up payouts.' }, status);
  }
});
