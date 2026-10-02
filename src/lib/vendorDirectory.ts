export type VendorDirectoryEntry = {
  id: string;
  business_name: string;
  user_id?: string | null;
  is_verified?: boolean | null;
  profile_kind?: string | null;
  updated_at?: string | null;
};

function normalizedBusinessName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
}

function listingPriority(entry: VendorDirectoryEntry) {
  return (entry.user_id ? 8 : 0)
    + (entry.is_verified ? 4 : 0)
    + (entry.profile_kind === 'claimed' ? 2 : 0);
}

export function deduplicateVendorDirectory<T extends VendorDirectoryEntry>(entries: T[]) {
  const preferredByBusiness = new Map<string, T>();

  for (const entry of entries) {
    const key = normalizedBusinessName(entry.business_name) || entry.id;
    const current = preferredByBusiness.get(key);

    if (!current || listingPriority(entry) > listingPriority(current)) {
      preferredByBusiness.set(key, entry);
      continue;
    }

    if (
      listingPriority(entry) === listingPriority(current)
      && (entry.updated_at ?? '') > (current.updated_at ?? '')
    ) {
      preferredByBusiness.set(key, entry);
    }
  }

  return Array.from(preferredByBusiness.values());
}
