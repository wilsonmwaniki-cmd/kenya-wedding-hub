import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type WorkspaceVendorInvite = Tables<'workspace_vendor_invites'>;
export type WorkspaceVendorInviteInsert = TablesInsert<'workspace_vendor_invites'>;
export type WorkspaceVendorInviteUpdate = TablesUpdate<'workspace_vendor_invites'>;

export type WorkspaceVendorInviteStatus =
  | 'draft'
  | 'pending'
  | 'sent'
  | 'opened'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revoked';

export interface CreateWorkspaceVendorInviteInput {
  weddingId: string;
  vendorId: string;
  inviteContactEmail?: string | null;
  inviteContactPhone?: string | null;
  inviteMessage?: string | null;
  inviteExpiresAt?: string | null;
}

function normalizeEmail(value?: string | null) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizePhone(value?: string | null) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function listWorkspaceVendorInvitesForVendor(vendorId: string): Promise<WorkspaceVendorInvite[]> {
  const { data, error } = await supabase
    .from('workspace_vendor_invites')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkspaceVendorInvite[];
}

export async function listAcceptedWorkspaceVendorInvitesForUser(
  vendorUserId: string,
): Promise<WorkspaceVendorInvite[]> {
  const { data, error } = await supabase
    .from('workspace_vendor_invites')
    .select('*')
    .eq('invited_vendor_user_id', vendorUserId)
    .eq('invite_status', 'accepted')
    .order('accepted_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkspaceVendorInvite[];
}

export async function createWorkspaceVendorInviteDraft(
  input: CreateWorkspaceVendorInviteInput,
): Promise<WorkspaceVendorInvite> {
  const payload: WorkspaceVendorInviteInsert = {
    wedding_id: input.weddingId,
    vendor_id: input.vendorId,
    invite_contact_email: normalizeEmail(input.inviteContactEmail),
    invite_contact_phone: normalizePhone(input.inviteContactPhone),
    invite_message: input.inviteMessage?.trim() || null,
    invite_expires_at: input.inviteExpiresAt ?? null,
    invite_status: 'draft',
  };

  const { data, error } = await supabase
    .from('workspace_vendor_invites')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as WorkspaceVendorInvite;
}

export async function updateWorkspaceVendorInvite(
  id: string,
  updates: WorkspaceVendorInviteUpdate,
): Promise<WorkspaceVendorInvite> {
  const payload: WorkspaceVendorInviteUpdate = {
    ...updates,
    invite_contact_email: normalizeEmail(updates.invite_contact_email),
    invite_contact_phone: normalizePhone(updates.invite_contact_phone),
    invite_message: typeof updates.invite_message === 'string' ? updates.invite_message.trim() || null : updates.invite_message,
  };

  const { data, error } = await supabase
    .from('workspace_vendor_invites')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as WorkspaceVendorInvite;
}
