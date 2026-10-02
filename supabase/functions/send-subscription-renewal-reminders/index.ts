import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RECONCILIATION_TOKEN = Deno.env.get('ZANIA_PAY_RECONCILIATION_TOKEN')?.trim() ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Zania <hello@planwithzania.com>';
const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://www.planwithzania.com').replace(/\/$/, '');
const DAY_MS = 24 * 60 * 60 * 1000;

type Audience = 'vendor' | 'planner';
type ReminderStage = '14_days' | '7_days' | '3_days' | '1_day' | 'expired';
type Candidate = {
  userId: string;
  audience: Audience;
  displayName: string;
  preferredEmail: string | null;
  expiresAt: string;
};

type Delivery = {
  id: string;
  status: 'sending' | 'sent' | 'failed';
  attempts: number;
  updated_at: string;
};

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function reminderStage(expiresAt: string, now: Date): ReminderStage | null {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  if (expiry.getTime() <= now.getTime()) return 'expired';
  const days = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
  if (days === 14) return '14_days';
  if (days === 7) return '7_days';
  if (days === 3) return '3_days';
  if (days === 1) return '1_day';
  return null;
}

async function claimDelivery(
  admin: ReturnType<typeof createClient>,
  candidate: Candidate,
  stage: ReminderStage,
  recipientEmail: string,
) {
  const row = {
    user_id: candidate.userId,
    audience: candidate.audience,
    reminder_stage: stage,
    subscription_expires_at: candidate.expiresAt,
    recipient_email: recipientEmail,
    status: 'sending',
    attempts: 1,
  };
  const { data: inserted, error: insertError } = await admin
    .from('subscription_renewal_deliveries')
    .insert(row)
    .select('id, status, attempts, updated_at')
    .maybeSingle();
  if (!insertError && inserted) return inserted as Delivery;
  if (insertError?.code !== '23505') throw insertError;

  const { data: existing, error: existingError } = await admin
    .from('subscription_renewal_deliveries')
    .select('id, status, attempts, updated_at')
    .eq('user_id', candidate.userId)
    .eq('audience', candidate.audience)
    .eq('subscription_expires_at', candidate.expiresAt)
    .eq('reminder_stage', stage)
    .maybeSingle();
  if (existingError || !existing) throw existingError ?? new Error('Renewal delivery record disappeared.');
  if (existing.status === 'sent' || Number(existing.attempts) >= 5) return null;

  const staleSending = existing.status === 'sending'
    && new Date(existing.updated_at).getTime() <= Date.now() - 6 * 60 * 60 * 1000;
  if (existing.status !== 'failed' && !staleSending) return null;

  const { data: claimed, error: claimError } = await admin
    .from('subscription_renewal_deliveries')
    .update({
      status: 'sending',
      attempts: Number(existing.attempts) + 1,
      recipient_email: recipientEmail,
      last_error: null,
    })
    .eq('id', existing.id)
    .eq('updated_at', existing.updated_at)
    .select('id, status, attempts, updated_at')
    .maybeSingle();
  if (claimError) throw claimError;
  return claimed as Delivery | null;
}

async function loadEmail(admin: ReturnType<typeof createClient>, candidate: Candidate) {
  if (candidate.preferredEmail?.trim()) return candidate.preferredEmail.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.getUserById(candidate.userId);
  if (error) throw error;
  return data.user?.email?.trim().toLowerCase() ?? null;
}

function buildEmail(candidate: Candidate, stage: ReminderStage) {
  const name = escapeHtml(candidate.displayName || 'there');
  const expiry = new Date(candidate.expiresAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi',
  });
  const audienceLabel = candidate.audience === 'vendor' ? 'Vendor' : 'Planner';
  const renewalUrl = `${SITE_URL}/pricing?audience=${candidate.audience}&plan=${candidate.audience}_premium&feature=booking_management`;
  const expired = stage === 'expired';
  const stageLabel = stage.replace('_days', '');
  const subject = expired
    ? `Your Zania ${audienceLabel} plan has expired`
    : `Your Zania ${audienceLabel} plan expires in ${stageLabel} day${stageLabel === '1' ? '' : 's'}`;
  const headline = expired ? 'Your Professional access has expired' : 'Your Professional plan is nearly due';
  const body = expired
    ? `Your Zania ${audienceLabel} subscription expired on ${expiry}. Renew to restore paid Professional features.`
    : `Your Zania ${audienceLabel} subscription is active until ${expiry}. Choose a monthly or annual plan to continue without interruption.`;

  return {
    subject,
    html: `
      <div style="background:#fbf7f2;padding:32px 16px;font-family:Arial,sans-serif;color:#2c211c">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5d8cc;padding:32px">
          <p style="margin:0 0 20px;color:#c96f48;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Zania subscription</p>
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25">${headline}</h1>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6">Hello ${name},</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6">${body}</p>
          <a href="${renewalUrl}" style="display:inline-block;background:#c96f48;color:#ffffff;text-decoration:none;padding:13px 20px;font-weight:700">Renew securely with Paystack</a>
          <p style="margin:24px 0 0;color:#7d7069;font-size:13px;line-height:1.5">You can review both billing options before paying. Zania will never charge you automatically from this reminder.</p>
        </div>
      </div>
    `,
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const suppliedKey = request.headers.get('apikey') ?? '';
  const suppliedToken = request.headers.get('x-zania-reconcile-token')?.trim() ?? '';
  if (!SUPABASE_ANON_KEY || suppliedKey !== SUPABASE_ANON_KEY || !RECONCILIATION_TOKEN || suppliedToken !== RECONCILIATION_TOKEN) {
    return json(401, { error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return json(500, { error: 'Subscription reminder delivery is not fully configured.' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const horizon = new Date(now.getTime() + 15 * DAY_MS).toISOString();
  const requestId = crypto.randomUUID();
  const requestBody = await request.json().catch(() => ({}));
  const dryRun = requestBody && typeof requestBody === 'object' && 'dryRun' in requestBody && requestBody.dryRun === true;

  try {
    const [
      { data: vendorRows, error: vendorError },
      { data: plannerRows, error: plannerError },
      { data: demoRows, error: demoError },
    ] = await Promise.all([
      admin.from('vendor_listings')
        .select('user_id, business_name, email, subscription_expires_at')
        .eq('subscription_status', 'active')
        .not('user_id', 'is', null)
        .not('subscription_expires_at', 'is', null)
        .lte('subscription_expires_at', horizon)
        .limit(500),
      admin.from('profiles')
        .select('user_id, full_name, company_name, company_email, planner_subscription_expires_at')
        .eq('role', 'planner')
        .or('planner_type.is.null,planner_type.neq.committee')
        .eq('planner_subscription_status', 'active')
        .not('planner_subscription_expires_at', 'is', null)
        .lte('planner_subscription_expires_at', horizon)
        .limit(500),
      admin.from('demo_sessions')
        .select('user_id')
        .in('status', ['active', 'ended']),
    ]);
    if (vendorError) throw vendorError;
    if (plannerError) throw plannerError;
    if (demoError) throw demoError;

    const demoUserIds = new Set((demoRows ?? []).map((row) => String(row.user_id)));

    const candidates: Candidate[] = [
      ...(vendorRows ?? []).filter((row) => !demoUserIds.has(String(row.user_id))).map((row) => ({
        userId: String(row.user_id), audience: 'vendor' as const,
        displayName: String(row.business_name || 'there'),
        preferredEmail: typeof row.email === 'string' ? row.email : null,
        expiresAt: String(row.subscription_expires_at),
      })),
      ...(plannerRows ?? []).filter((row) => !demoUserIds.has(String(row.user_id))).map((row) => ({
        userId: String(row.user_id), audience: 'planner' as const,
        displayName: String(row.company_name || row.full_name || 'there'),
        preferredEmail: typeof row.company_email === 'string' ? row.company_email : null,
        expiresAt: String(row.planner_subscription_expires_at),
      })),
    ];

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let expired = 0;
    let eligible = 0;

    for (const candidate of candidates) {
      const stage = reminderStage(candidate.expiresAt, now);
      if (!stage) { skipped += 1; continue; }
      eligible += 1;
      if (dryRun) continue;

      if (stage === 'expired') {
        const table = candidate.audience === 'vendor' ? 'vendor_listings' : 'profiles';
        const statusColumn = candidate.audience === 'vendor' ? 'subscription_status' : 'planner_subscription_status';
        await admin.from(table).update({ [statusColumn]: 'past_due' }).eq('user_id', candidate.userId);
        await admin.from('professional_entitlements')
          .update({ status: 'expired' })
          .eq('user_id', candidate.userId)
          .eq('audience', candidate.audience)
          .lte('effective_to', now.toISOString());
        expired += 1;
      }

      try {
        const recipientEmail = await loadEmail(admin, candidate);
        if (!recipientEmail) { skipped += 1; continue; }
        const delivery = await claimDelivery(admin, candidate, stage, recipientEmail);
        if (!delivery) { skipped += 1; continue; }
        const email = buildEmail(candidate, stage);
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Idempotency-Key': `subscription-renewal-${delivery.id}`,
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: [recipientEmail],
            subject: email.subject,
            html: email.html,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message ?? 'Email delivery failed.');
        await admin.from('subscription_renewal_deliveries').update({
          status: 'sent', provider_message_id: payload?.id ?? null, sent_at: new Date().toISOString(), last_error: null,
        }).eq('id', delivery.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown renewal email error';
        console.error('subscription renewal reminder failed', { userId: candidate.userId, audience: candidate.audience, stage, message });
        await admin.from('subscription_renewal_deliveries').update({ status: 'failed', last_error: message.slice(0, 1000) })
          .eq('user_id', candidate.userId)
          .eq('audience', candidate.audience)
          .eq('subscription_expires_at', candidate.expiresAt)
          .eq('reminder_stage', stage)
          .eq('status', 'sending');
      }
    }

    await logFunctionEvent({
      functionName: 'send-subscription-renewal-reminders', severity: failed ? 'warn' : 'info',
      status: failed ? 'failure' : 'success', eventType: 'renewal_reminder_batch_completed',
      message: `Processed ${candidates.length} subscription renewal candidates.`, requestId,
      details: { dryRun, candidates: candidates.length, eligible, sent, failed, skipped, expired },
    });
    return json(200, { dryRun, candidates: candidates.length, eligible, sent, failed, skipped, expired });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown subscription reminder error';
    await logFunctionEvent({
      functionName: 'send-subscription-renewal-reminders', severity: 'error', status: 'failure',
      eventType: 'renewal_reminder_batch_failed', message, requestId,
    });
    return json(500, { error: message });
  }
});
