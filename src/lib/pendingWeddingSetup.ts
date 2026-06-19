import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getHomeRouteForRole, type AppRole, type PlannerType } from '@/lib/roles';

const PENDING_WEDDING_SETUP_STORAGE_KEY = 'zania-pending-wedding-setup';

export type WeddingSignupIntent = 'create_wedding' | 'join_wedding' | 'professional';
export type WeddingOwnerRole = 'bride' | 'groom';
export type WeddingPlanningMode = 'local' | 'diaspora';
export type WeddingReferenceCurrency = 'GBP' | 'USD' | 'EUR' | 'CAD' | 'AUD';

export type PendingWeddingSetup = {
  intent: Exclude<WeddingSignupIntent, 'professional'>;
  email: string | null;
  weddingOwnerRole?: WeddingOwnerRole | null;
  partnerEmail?: string | null;
  weddingName?: string | null;
  weddingCode?: string | null;
  weddingCounty?: string | null;
  weddingTown?: string | null;
  weddingDate?: string | null;
  planningMode?: WeddingPlanningMode | null;
  planningCountry?: string | null;
  referenceCurrency?: WeddingReferenceCurrency | null;
  ownerTimezone?: string | null;
};

type PendingWeddingSetupMetadata = Record<string, unknown> & {
  signup_intent?: WeddingSignupIntent | null;
  wedding_setup_completed?: boolean | null;
  wedding_owner_role?: string | null;
  partner_email?: string | null;
  wedding_name?: string | null;
  wedding_code?: string | null;
  wedding_county?: string | null;
  wedding_town?: string | null;
  wedding_date?: string | null;
  planning_mode?: WeddingPlanningMode | null;
  planning_country?: string | null;
  reference_currency?: WeddingReferenceCurrency | null;
  owner_timezone?: string | null;
  role?: AppRole | null;
  planner_type?: PlannerType | 'committee' | null;
};

type CreateWeddingWorkspaceRow = {
  wedding_id: string;
  wedding_code: string;
  owner_membership_id: string;
  partner_invite_id: string | null;
};

type SendInviteResult = {
  success?: boolean;
  error?: string;
};

type PreviewJoinWeddingRow = {
  wedding_id: string;
  wedding_name: string;
  wedding_code: string;
  wedding_date: string | null;
  location_county: string | null;
  location_town: string | null;
  invite_id: string;
  invite_type: string;
  proposed_role: string;
  membership_status: string;
  expires_at: string | null;
  invited_by_name: string | null;
};

type MyWeddingOwnershipSummary = {
  weddingId: string;
  partnerEmail: string | null;
};

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

const formatInviteWaitTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'a few minutes';
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);

  if (hours <= 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  if (minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`;
};

async function sendWeddingInviteEmail(inviteId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to send invite email right now.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-wedding-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ inviteId }),
  });

  const payload = (await response.json().catch(() => null)) as SendInviteResult | { error?: string; message?: string } | null;
  const responseMessage =
    typeof payload?.error === 'string'
      ? payload.error
      : typeof payload?.message === 'string'
        ? payload.message
        : null;

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const waitSuffix =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      && !(responseMessage ?? '').toLowerCase().includes('please wait')
        ? ` Please wait ${formatInviteWaitTime(retryAfterSeconds)} before trying again.`
        : '';

    throw new Error((responseMessage || 'Could not send invite email right now.') + waitSuffix);
  }

  if (!payload || !('success' in payload) || !payload.success) {
    throw new Error(responseMessage || 'Could not send invite email right now.');
  }
}

async function getMyWeddingOwnershipSummaryFromTables(
  userId: string,
  userEmail?: string | null,
): Promise<MyWeddingOwnershipSummary | null> {
  const db = supabase as any;
  const normalizedEmail = normalizeEmail(userEmail);
  const ownerMatch = normalizedEmail
    ? `user_id.eq.${userId},email.eq.${normalizedEmail}`
    : `user_id.eq.${userId}`;

  const { data: ownerMemberships, error: ownerMembershipError } = await db
    .from('wedding_memberships')
    .select('id, wedding_id, role, email')
    .eq('is_owner', true)
    .eq('membership_status', 'active')
    .in('role', ['bride', 'groom'])
    .or(ownerMatch)
    .order('created_at', { ascending: true })
    .limit(1);

  if (ownerMembershipError) throw ownerMembershipError;
  const ownerMembership = ownerMemberships?.[0];
  if (!ownerMembership) return null;

  const { data: partnerMemberships, error: partnerMembershipError } = await db
    .from('wedding_memberships')
    .select('id, email, role, membership_status, user_id')
    .eq('wedding_id', ownerMembership.wedding_id)
    .eq('is_owner', true)
    .neq('id', ownerMembership.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (partnerMembershipError) throw partnerMembershipError;

  const { data: partnerInvites, error: inviteError } = await db
    .from('wedding_invites')
    .select('id, email, proposed_role, expires_at, status')
    .eq('wedding_id', ownerMembership.wedding_id)
    .eq('invite_type', 'partner')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (inviteError) throw inviteError;

  const partnerMembership = partnerMemberships?.[0] ?? null;
  const pendingInvite = partnerInvites?.[0] ?? null;

  return {
    weddingId: String(ownerMembership.wedding_id),
    partnerEmail: partnerMembership?.email ?? pendingInvite?.email ?? null,
  };
}

export function persistPendingWeddingSetup(payload: PendingWeddingSetup) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_WEDDING_SETUP_STORAGE_KEY, JSON.stringify(payload));
}

export function clearPendingWeddingSetup() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_WEDDING_SETUP_STORAGE_KEY);
}

function readPendingWeddingSetupFromSession(currentEmail?: string | null): PendingWeddingSetup | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.sessionStorage.getItem(PENDING_WEDDING_SETUP_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as PendingWeddingSetup;
    if (!parsed || (parsed.intent !== 'create_wedding' && parsed.intent !== 'join_wedding')) {
      return null;
    }

    const payloadEmail = normalizeEmail(parsed.email);
    const activeEmail = normalizeEmail(currentEmail);
    if (payloadEmail && activeEmail && payloadEmail !== activeEmail) return null;

    return parsed;
  } catch {
    return null;
  }
}

function readPendingWeddingSetupFromMetadata(
  userMetadata: PendingWeddingSetupMetadata | null | undefined,
): PendingWeddingSetup | null {
  if (!userMetadata) return null;
  if (userMetadata.wedding_setup_completed === true) return null;

  const intent = userMetadata.signup_intent;
  if (intent !== 'create_wedding' && intent !== 'join_wedding') return null;

  return {
    intent,
    email: null,
    weddingOwnerRole:
      userMetadata.wedding_owner_role === 'bride' || userMetadata.wedding_owner_role === 'groom'
        ? userMetadata.wedding_owner_role
        : null,
    partnerEmail: normalizeEmail(userMetadata.partner_email),
    weddingName: typeof userMetadata.wedding_name === 'string' ? userMetadata.wedding_name : null,
    weddingCode: typeof userMetadata.wedding_code === 'string' ? userMetadata.wedding_code : null,
    weddingCounty: typeof userMetadata.wedding_county === 'string' ? userMetadata.wedding_county : null,
    weddingTown: typeof userMetadata.wedding_town === 'string' ? userMetadata.wedding_town : null,
    weddingDate: typeof userMetadata.wedding_date === 'string' ? userMetadata.wedding_date : null,
    planningMode: userMetadata.planning_mode === 'diaspora' ? 'diaspora' : 'local',
    planningCountry: typeof userMetadata.planning_country === 'string' ? userMetadata.planning_country : null,
    referenceCurrency:
      userMetadata.reference_currency === 'GBP'
      || userMetadata.reference_currency === 'USD'
      || userMetadata.reference_currency === 'EUR'
      || userMetadata.reference_currency === 'CAD'
      || userMetadata.reference_currency === 'AUD'
        ? userMetadata.reference_currency
        : null,
    ownerTimezone: typeof userMetadata.owner_timezone === 'string' ? userMetadata.owner_timezone : null,
  };
}

export function getPendingWeddingSetup(
  userMetadata: Record<string, unknown> | null | undefined,
  currentEmail?: string | null,
): PendingWeddingSetup | null {
  const fromSession = readPendingWeddingSetupFromSession(currentEmail);
  if (fromSession) return fromSession;
  return readPendingWeddingSetupFromMetadata(userMetadata as PendingWeddingSetupMetadata | null | undefined);
}

export function hasPendingWeddingSetup(
  userMetadata: Record<string, unknown> | null | undefined,
  currentEmail?: string | null,
) {
  return Boolean(getPendingWeddingSetup(userMetadata, currentEmail));
}

export function isPendingWeddingSetupReadyForCompletion(pendingSetup: PendingWeddingSetup | null): boolean {
  if (!pendingSetup) return false;
  if (pendingSetup.intent === 'create_wedding') {
    return Boolean(pendingSetup.weddingOwnerRole && pendingSetup.weddingName?.trim());
  }
  return Boolean(pendingSetup.weddingCode?.trim());
}

function resolveLegacyRoleForWeddingRole(weddingRole: string | null | undefined): { role: AppRole; plannerType: PlannerType | null } {
  switch (weddingRole) {
    case 'committee_chair':
    case 'committee_member':
      return { role: 'planner', plannerType: 'committee' };
    case 'planner':
      return { role: 'planner', plannerType: 'professional' };
    default:
      return { role: 'couple', plannerType: null };
  }
}

export async function markWeddingSetupComplete(
  user: User,
  overrides?: Partial<PendingWeddingSetupMetadata>,
) {
  const currentMetadata = (user.user_metadata ?? {}) as PendingWeddingSetupMetadata;
  const nextMetadata: PendingWeddingSetupMetadata = {
    ...currentMetadata,
    signup_intent: null,
    wedding_setup_completed: true,
    wedding_owner_role: null,
    partner_email: null,
    wedding_name: null,
    wedding_code: null,
    wedding_county: null,
    wedding_town: null,
    wedding_date: null,
    planning_mode: null,
    planning_country: null,
    reference_currency: null,
    owner_timezone: null,
    ...overrides,
  };

  const { error } = await supabase.auth.updateUser({
    data: nextMetadata,
  });

  if (error) throw error;
}

async function ensureNoDuplicateOwnedWedding(userId: string): Promise<string | null> {
  const db = supabase as any;
  const { data, error } = await db
    .from('wedding_memberships')
    .select('wedding_id')
    .eq('user_id', userId)
    .eq('is_owner', true)
    .in('membership_status', ['invited', 'active'])
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.wedding_id ?? null;
}

export async function reconcilePendingWeddingSetupForExistingWorkspace(user: User): Promise<{
  handled: boolean;
  route: string;
}> {
  const pendingSetup = getPendingWeddingSetup(user.user_metadata, user.email ?? null);
  if (!pendingSetup) return { handled: false, route: '' };

  const ownership = await getMyWeddingOwnershipSummaryFromTables(user.id, user.email ?? null);
  if (!ownership?.weddingId) return { handled: false, route: '' };

  await markWeddingSetupComplete(user, {
    role: 'couple',
    planner_type: null,
    partner_email: pendingSetup.partnerEmail ?? null,
  });
  clearPendingWeddingSetup();

  return {
    handled: true,
    route: '/dashboard',
  };
}

export async function completePendingWeddingSetup(user: User): Promise<{
  handled: boolean;
  route: string;
  action: 'created' | 'joined' | null;
  weddingName?: string | null;
  proposedRole?: string | null;
  partnerInviteQueued?: boolean;
  partnerInviteSent?: boolean;
}> {
  const pendingSetup = getPendingWeddingSetup(user.user_metadata, user.email ?? null);
  if (!pendingSetup) {
    const metadata = user.user_metadata as PendingWeddingSetupMetadata | undefined;
    const role = metadata?.role === 'planner' || metadata?.role === 'vendor' || metadata?.role === 'admin' || metadata?.role === 'couple'
      ? metadata.role
      : 'couple';
    const plannerType = metadata?.planner_type === 'committee' ? 'committee' : role === 'planner' ? 'professional' : null;
    return {
      handled: false,
      route: getHomeRouteForRole(role, plannerType),
      action: null,
    };
  }

  if (pendingSetup.intent === 'create_wedding') {
    if (!pendingSetup.weddingOwnerRole) {
      throw new Error('Choose whether you are the bride or groom before creating the wedding.');
    }
    if (!pendingSetup.weddingName?.trim()) {
      throw new Error('Add a wedding name before creating the wedding.');
    }

    const existingWeddingId = await ensureNoDuplicateOwnedWedding(user.id);
    if (!existingWeddingId) {
      const { data, error } = await supabase.rpc('create_wedding_workspace', {
        wedding_name: pendingSetup.weddingName,
        creator_role: pendingSetup.weddingOwnerRole,
        partner_email_input: pendingSetup.partnerEmail ?? null,
        wedding_date_input: pendingSetup.weddingDate ?? null,
        location_county_input: pendingSetup.weddingCounty ?? null,
        location_town_input: pendingSetup.weddingTown ?? null,
      });

      if (error) throw error;

      const row = (Array.isArray(data) ? data[0] : data) as CreateWeddingWorkspaceRow | null;
      let partnerInviteSent = false;
      if (row?.partner_invite_id) {
        try {
          await sendWeddingInviteEmail(row.partner_invite_id);
          partnerInviteSent = true;
        } catch (inviteError) {
          console.error('Partner invite email could not be sent after wedding creation:', inviteError);
        }
      }

      const resolvedWeddingLocation = [pendingSetup.weddingTown, pendingSetup.weddingCounty]
        .filter(Boolean)
        .join(', ') || null;

      await supabase
        .from('profiles')
        .update({
          collaboration_code: row?.wedding_code ?? null,
          wedding_date: pendingSetup.weddingDate ?? null,
          wedding_county: pendingSetup.weddingCounty ?? null,
          wedding_town: pendingSetup.weddingTown ?? null,
          wedding_location: resolvedWeddingLocation,
        })
        .eq('user_id', user.id);

      if (row?.wedding_id) {
        await (supabase as any)
          .from('weddings')
          .update({
            planning_mode: pendingSetup.planningMode ?? 'local',
            planning_country: pendingSetup.planningMode === 'diaspora' ? pendingSetup.planningCountry ?? null : null,
            reference_currency: pendingSetup.planningMode === 'diaspora' ? pendingSetup.referenceCurrency ?? null : null,
            owner_timezone: pendingSetup.planningMode === 'diaspora' ? pendingSetup.ownerTimezone ?? null : null,
          })
          .eq('id', row.wedding_id);
      }

      await markWeddingSetupComplete(user, {
        role: 'couple',
        planner_type: null,
        partner_email: pendingSetup.partnerEmail ?? null,
      });

      clearPendingWeddingSetup();
      return {
        handled: true,
        route: '/dashboard',
        action: 'created',
        weddingName: pendingSetup.weddingName ?? null,
        partnerInviteQueued: Boolean(row?.partner_invite_id),
        partnerInviteSent,
      };
    }

    await (supabase as any)
      .from('weddings')
      .update({
        planning_mode: pendingSetup.planningMode ?? 'local',
        planning_country: pendingSetup.planningMode === 'diaspora' ? pendingSetup.planningCountry ?? null : null,
        reference_currency: pendingSetup.planningMode === 'diaspora' ? pendingSetup.referenceCurrency ?? null : null,
        owner_timezone: pendingSetup.planningMode === 'diaspora' ? pendingSetup.ownerTimezone ?? null : null,
      })
      .eq('id', existingWeddingId);

    await markWeddingSetupComplete(user, {
      role: 'couple',
      planner_type: null,
      partner_email: pendingSetup.partnerEmail ?? null,
    });
    clearPendingWeddingSetup();
    return {
      handled: true,
      route: '/dashboard',
      action: 'created',
      weddingName: pendingSetup.weddingName ?? null,
      partnerInviteQueued: Boolean(pendingSetup.partnerEmail),
      partnerInviteSent: false,
    };
  }

  if (!pendingSetup.weddingCode?.trim()) {
    throw new Error('Enter the wedding code from your invitation email to join this wedding.');
  }

  const { data: previewData, error: previewError } = await supabase.rpc('preview_join_wedding_by_code', {
    wedding_code_input: pendingSetup.weddingCode,
  });

  if (previewError) throw previewError;

  const previewRow = (Array.isArray(previewData) ? previewData[0] : previewData) as PreviewJoinWeddingRow | null;
  if (!previewRow) {
    throw new Error('No matching wedding invite was found for this code.');
  }

  const { error: joinError } = await supabase.rpc('join_wedding_by_code', {
    wedding_code_input: pendingSetup.weddingCode,
  });

  if (joinError) throw joinError;

  const legacyRole = resolveLegacyRoleForWeddingRole(previewRow.proposed_role);
  await markWeddingSetupComplete(user, {
    role: legacyRole.role,
    planner_type: legacyRole.plannerType,
  });

  if (legacyRole.role === 'planner') {
    const { error: syncRoleError } = await supabase.rpc('sync_current_user_signup_role');
    if (syncRoleError) {
      console.error('Could not sync planner-style join role after invite acceptance:', syncRoleError);
    }
  }

  clearPendingWeddingSetup();
  return {
    handled: true,
    route: getHomeRouteForRole(legacyRole.role, legacyRole.plannerType),
    action: 'joined',
    weddingName: previewRow.wedding_name,
    proposedRole: previewRow.proposed_role,
  };
}
