import type { CommercialDocumentRole, CommercialDocumentType } from '@/lib/commercialDocuments';

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'zania:document-setup-draft';

function storageKey(userId: string, role: CommercialDocumentRole, documentType: CommercialDocumentType) {
  return `${STORAGE_PREFIX}:v${STORAGE_VERSION}:${userId}:${role}:${documentType}`;
}

export function readDocumentSetupDraft<T extends object>(
  userId: string,
  role: CommercialDocumentRole,
  documentType: CommercialDocumentType,
): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(storageKey(userId, role, documentType));
    if (!value) return null;
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
}

export function writeDocumentSetupDraft<T extends object>(
  userId: string,
  role: CommercialDocumentRole,
  documentType: CommercialDocumentType,
  draft: T,
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId, role, documentType), JSON.stringify(draft));
  } catch {
    // Draft recovery is a convenience. Storage being unavailable must not block creation.
  }
}

export function clearDocumentSetupDraft(
  userId: string,
  role: CommercialDocumentRole,
  documentType: CommercialDocumentType,
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(userId, role, documentType));
  } catch {
    // Ignore browsers that disallow local storage.
  }
}
