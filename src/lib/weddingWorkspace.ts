import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getHomeRouteForRole, type AppRole, type PlannerType } from '@/lib/roles';

const PENDING_WEDDING_SETUP_STORAGE_KEY = 'zania-pending-wedding-setup';

export type WeddingSignupIntent = 'create_wedding' | 'join_wedding' | 'professional';
export type WeddingOwnerRole = 'bride' | 'groom';

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
};

type CreateWeddingWorkspaceRow = {
  wedding_id: string;
  wedding_code: string;
  owner_membership_id: string;
  partner_invite_id: string | null;
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

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

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
      };
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
      partnerInviteQueued: Boolean(pendingSetup.partnerEmail),
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
