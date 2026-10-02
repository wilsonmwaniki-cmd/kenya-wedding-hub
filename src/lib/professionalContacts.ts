import { supabase } from '@/integrations/supabase/client';
import { retryTransientRequest } from '@/lib/requestRetry';

export const professionalContactTypes = ['client', 'couple', 'vendor', 'other'] as const;
export type ProfessionalContactType = (typeof professionalContactTypes)[number];

export type ProfessionalContact = {
  id: string;
  ownerUserId: string;
  contactType: ProfessionalContactType;
  displayName: string;
  organisationName: string | null;
  primaryEmail: string | null;
  phone: string | null;
  additionalEmails: string[];
  notes: string | null;
  lastDocumentSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfessionalContactInput = {
  contactType?: ProfessionalContactType;
  displayName: string;
  organisationName?: string | null;
  primaryEmail?: string | null;
  phone?: string | null;
  additionalEmails?: string[];
  notes?: string | null;
  lastDocumentSentAt?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseContactEmail(value: string | null | undefined) {
  const email = String(value ?? '').trim().toLowerCase();
  return emailPattern.test(email) ? email : null;
}

export function normaliseContactEmails(values: unknown, primaryEmail?: string | null) {
  const primary = normaliseContactEmail(primaryEmail);
  const candidates = Array.isArray(values) ? values : [];
  return [...new Set(candidates
    .filter((value): value is string => typeof value === 'string')
    .map(normaliseContactEmail)
    .filter((email): email is string => Boolean(email) && email !== primary))].slice(0, 10);
}

function mapContact(row: Record<string, unknown>): ProfessionalContact {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    contactType: professionalContactTypes.includes(row.contact_type as ProfessionalContactType)
      ? row.contact_type as ProfessionalContactType
      : 'other',
    displayName: String(row.display_name ?? ''),
    organisationName: typeof row.organisation_name === 'string' ? row.organisation_name : null,
    primaryEmail: typeof row.primary_email === 'string' ? row.primary_email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    additionalEmails: normaliseContactEmails(row.additional_emails, row.primary_email as string | null | undefined),
    notes: typeof row.notes === 'string' ? row.notes : null,
    lastDocumentSentAt: typeof row.last_document_sent_at === 'string' ? row.last_document_sent_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function cleanInput(input: ProfessionalContactInput) {
  const primaryEmail = normaliseContactEmail(input.primaryEmail);
  const displayName = input.displayName.trim().slice(0, 160);
  if (!displayName) throw new Error('Add a contact name.');
  return {
    contact_type: input.contactType ?? 'client',
    display_name: displayName,
    organisation_name: input.organisationName?.trim() || null,
    primary_email: primaryEmail,
    phone: input.phone?.trim() || null,
    additional_emails: normaliseContactEmails(input.additionalEmails, primaryEmail),
    notes: input.notes?.trim() || null,
    last_document_sent_at: input.lastDocumentSentAt ?? null,
  };
}

export async function listProfessionalContacts(ownerUserId: string, search = '') {
  const { data, error } = await retryTransientRequest(() => (supabase as any)
    .from('professional_contacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('last_document_sent_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(100));
  if (error) throw error;
  const contacts = ((data ?? []) as Record<string, unknown>[]).map(mapContact);
  const term = search.trim().toLowerCase();
  return term
    ? contacts.filter((contact) => [contact.displayName, contact.primaryEmail, contact.organisationName]
      .some((value) => value?.toLowerCase().includes(term)))
    : contacts;
}

export async function createProfessionalContact(ownerUserId: string, input: ProfessionalContactInput) {
  const { data, error } = await (supabase as any)
    .from('professional_contacts')
    .insert({ owner_user_id: ownerUserId, ...cleanInput(input) })
    .select('*')
    .single();
  if (error) throw error;
  return mapContact(data as Record<string, unknown>);
}

export async function updateProfessionalContact(id: string, input: ProfessionalContactInput) {
  const { data, error } = await (supabase as any)
    .from('professional_contacts')
    .update(cleanInput(input))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapContact(data as Record<string, unknown>);
}

export async function deleteProfessionalContact(id: string) {
  const { error } = await (supabase as any).from('professional_contacts').delete().eq('id', id);
  if (error) throw error;
}

/** Keeps the target contact and folds the source contact's reachable details into it. */
export async function mergeProfessionalContacts(target: ProfessionalContact, source: ProfessionalContact) {
  if (target.id === source.id) throw new Error('Choose two different contacts to merge.');
  const additionalEmails = normaliseContactEmails([
    ...target.additionalEmails,
    ...source.additionalEmails,
    source.primaryEmail ?? '',
  ], target.primaryEmail);
  const latestSent = [target.lastDocumentSentAt, source.lastDocumentSentAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const merged = await updateProfessionalContact(target.id, {
    contactType: target.contactType,
    displayName: target.displayName,
    organisationName: target.organisationName || source.organisationName,
    primaryEmail: target.primaryEmail,
    phone: target.phone || source.phone,
    additionalEmails,
    notes: [target.notes, source.notes].filter(Boolean).join('\n\n') || null,
    lastDocumentSentAt: latestSent,
  });
  await deleteProfessionalContact(source.id);
  return merged;
}

/** Stores a sent document recipient, returning the saved contact and whether it was new. */
export async function saveDocumentRecipientAsContact(ownerUserId: string, input: ProfessionalContactInput) {
  const primaryEmail = normaliseContactEmail(input.primaryEmail);
  if (!input.displayName.trim() || !primaryEmail) return null;
  const { data: existing, error: findError } = await (supabase as any)
    .from('professional_contacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('primary_email_normalized', primaryEmail)
    .maybeSingle();
  if (findError) throw findError;

  const lastDocumentSentAt = new Date().toISOString();
  if (existing) {
    const saved = await updateProfessionalContact(String(existing.id), {
      ...input,
      contactType: input.contactType ?? existing.contact_type,
      displayName: input.displayName || existing.display_name,
      primaryEmail,
      phone: input.phone || existing.phone,
      additionalEmails: [...normaliseContactEmails(existing.additional_emails, primaryEmail), ...normaliseContactEmails(input.additionalEmails, primaryEmail)],
      lastDocumentSentAt,
    });
    return { contact: saved, created: false };
  }
  const saved = await createProfessionalContact(ownerUserId, { ...input, primaryEmail, lastDocumentSentAt });
  return { contact: saved, created: true };
}
