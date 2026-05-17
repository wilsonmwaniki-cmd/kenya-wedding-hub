import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getHomeRouteForRole, type AppRole, type PlannerType } from '@/lib/roles';

const PENDING_WEDDING_SETUP_STORAGE_KEY = 'zania-pending-wedding-setup';

export type WeddingSignupIntent = 'create_wedding' | 'join_wedding' | 'professional';
export type WeddingOwnerRole = 'bride' | 'groom';
export type WeddingPlanningMode = 'local' | 'diaspora';
export type WeddingReferenceCurrency = 'GBP' | 'USD' | 'EUR' | 'CAD' | 'AUD';

export const weddingReferenceCurrencies: WeddingReferenceCurrency[] = ['GBP', 'USD', 'EUR', 'CAD', 'AUD'];

export const planningCountryOptions = [
  'Australia', 'Austria', 'Belgium', 'Botswana', 'Canada', 'Denmark', 'Finland', 'France', 'Germany', 'Ghana',
  'India', 'Ireland', 'Italy', 'Japan', 'Kenya', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Qatar',
  'Rwanda', 'Saudi Arabia', 'South Africa', 'Spain', 'Sweden', 'Switzerland', 'Tanzania', 'Uganda',
  'United Arab Emirates', 'United Kingdom', 'United States',
];

export const weddingReferenceCurrencyLabels: Record<WeddingReferenceCurrency, string> = {
  GBP: 'GBP · British Pound',
  USD: 'USD · US Dollar',
  EUR: 'EUR · Euro',
  CAD: 'CAD · Canadian Dollar',
  AUD: 'AUD · Australian Dollar',
};

export function getTimezoneOptions() {
  if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
    return ((Intl as any).supportedValuesOf('timeZone') as string[]).filter((value) =>
      /Africa|Europe|America|Asia|Australia|Pacific/.test(value),
    );
  }

  return [
    'Africa/Nairobi',
    'Europe/London',
    'Europe/Paris',
    'America/New_York',
    'America/Toronto',
    'America/Los_Angeles',
    'Asia/Dubai',
    'Australia/Sydney',
  ];
}

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

export type MyWeddingOwnershipSummary = {
  weddingId: string;
  weddingName: string;
  weddingCode: string;
  weddingDate: string | null;
  locationCounty: string | null;
  locationTown: string | null;
  ownerRole: 'bride' | 'groom';
  partnerEmail: string | null;
  partnerRole: 'bride' | 'groom' | null;
  partnerStatus: 'active' | 'pending' | 'not_invited';
  partnerInviteExpiresAt: string | null;
};

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

export async function sendWeddingInviteEmail(inviteId: string) {
  const { data, error } = await supabase.functions.invoke<SendInviteResult>('send-wedding-invite', {
    body: { inviteId },
  });

  if (error) {
    throw new Error(error.message || 'Could not send invite email right now.');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Could not send invite email right now.');
  }

  return data;
}

export async function getMyWeddingOwnershipSummary(): Promise<MyWeddingOwnershipSummary | null> {
  const { data, error } = await (supabase as any).rpc('get_my_wedding_ownership');
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) return null;

  return {
    weddingId: String(row.wedding_id),
    weddingName: String(row.wedding_name ?? 'Your wedding'),
    weddingCode: String(row.wedding_code ?? ''),
    weddingDate: typeof row.wedding_date === 'string' ? row.wedding_date : null,
    locationCounty: typeof row.location_county === 'string' ? row.location_county : null,
    locationTown: typeof row.location_town === 'string' ? row.location_town : null,
    ownerRole: row.owner_role === 'groom' ? 'groom' : 'bride',
    partnerEmail: typeof row.partner_email === 'string' ? row.partner_email : null,
    partnerRole: row.partner_role === 'bride' || row.partner_role === 'groom' ? row.partner_role : null,
    partnerStatus: row.partner_status === 'active' || row.partner_status === 'pending' ? row.partner_status : 'not_invited',
    partnerInviteExpiresAt: typeof row.partner_invite_expires_at === 'string' ? row.partner_invite_expires_at : null,
  };
}

export async function getMyWeddingOwnershipSummaryFromTables(
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

  if (ownerMembershipError) {
    throw ownerMembershipError;
  }

  const ownerMembership = ownerMemberships?.[0];
  if (!ownerMembership) return null;

  const { data: weddings, error: weddingError } = await db
    .from('weddings')
    .select('id, name, wedding_code, wedding_date, location_county, location_town')
    .eq('id', ownerMembership.wedding_id)
    .limit(1);

  if (weddingError) {
    throw weddingError;
  }

  const wedding = weddings?.[0];
  if (!wedding) return null;

  const { data: partnerMemberships, error: partnerMembershipError } = await db
    .from('wedding_memberships')
    .select('id, email, role, membership_status, user_id')
    .eq('wedding_id', ownerMembership.wedding_id)
    .eq('is_owner', true)
    .neq('id', ownerMembership.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (partnerMembershipError) {
    throw partnerMembershipError;
  }

  const { data: partnerInvites, error: inviteError } = await db
    .from('wedding_invites')
    .select('id, email, proposed_role, expires_at, status')
    .eq('wedding_id', ownerMembership.wedding_id)
    .eq('invite_type', 'partner')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (inviteError) {
    throw inviteError;
  }

  const partnerMembership = partnerMemberships?.[0] ?? null;
  const pendingInvite = partnerInvites?.[0] ?? null;
  const partnerStatus: MyWeddingOwnershipSummary['partnerStatus'] =
    partnerMembership?.membership_status === 'active'
      ? 'active'
      : pendingInvite || partnerMembership?.membership_status === 'invited'
        ? 'pending'
        : 'not_invited';

  return {
    weddingId: String(wedding.id),
    weddingName: String(wedding.name ?? 'Your wedding'),
    weddingCode: String(wedding.wedding_code ?? ''),
    weddingDate: typeof wedding.wedding_date === 'string' ? wedding.wedding_date : null,
    locationCounty: typeof wedding.location_county === 'string' ? wedding.location_county : null,
    locationTown: typeof wedding.location_town === 'string' ? wedding.location_town : null,
    ownerRole: ownerMembership.role === 'groom' ? 'groom' : 'bride',
    partnerEmail: partnerMembership?.email ?? pendingInvite?.email ?? null,
    partnerRole:
      partnerMembership?.role === 'bride' || partnerMembership?.role === 'groom'
        ? partnerMembership.role
        : pendingInvite?.proposed_role === 'bride' || pendingInvite?.proposed_role === 'groom'
          ? pendingInvite.proposed_role
          : null,
    partnerStatus,
    partnerInviteExpiresAt: pendingInvite?.expires_at ?? null,
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
    if (payloadEmail && activeEmail && payloadEmail !== activeEmail) {
      return null;
    }

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

function resolveLegacyRoleForWeddingRole(weddingRole: string | null | undefined): { role: AppRole; plannerType: PlannerType | null } {
  switch (weddingRole) {
    case 'committee_chair':
    case 'committee_member':
      return { role: 'planner', plannerType: 'committee' };
    case 'planner':
      return { role: 'planner', plannerType: 'professional' };
    case 'bride':
    case 'groom':
    case 'family_contributor':
    case 'viewer':
    default:
      return { role: 'couple', plannerType: null };
  }
}

async function markWeddingSetupComplete(
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
