export type VendorCategoryScope = 'wedding' | 'personal';

export interface VendorCategoryDefinition {
  name: string;
  scope: VendorCategoryScope;
}

export const vendorCategoryCatalog: readonly VendorCategoryDefinition[] = [
  { name: 'Wedding Licenses', scope: 'wedding' },
  { name: 'Church & Officiating Minister', scope: 'wedding' },
  { name: 'Marriage Preparation', scope: 'personal' },
  { name: 'Wedding Venue', scope: 'wedding' },
  { name: 'Wedding Planner / Planning Team', scope: 'wedding' },
  { name: 'Caterer', scope: 'wedding' },
  { name: 'Cake Artist & Baker', scope: 'wedding' },
  { name: 'Décor, Tents, Chairs, Tables', scope: 'wedding' },
  { name: 'Rings', scope: 'personal' },
  { name: 'Bridal Gown, Accessories, Preparation', scope: 'personal' },
  { name: "Groom's Attire & Accessories, Preparation", scope: 'personal' },
  { name: 'Master of Ceremonies', scope: 'wedding' },
  { name: 'DJ (or Band) and Sound', scope: 'wedding' },
  { name: 'Photographer', scope: 'wedding' },
  { name: 'Cinematographer', scope: 'wedding' },
  { name: 'Photo Shoot Venue', scope: 'wedding' },
  { name: 'Transport', scope: 'wedding' },
  { name: 'Invitations', scope: 'wedding' },
  { name: "Bride's Make-up Artist", scope: 'personal' },
  { name: "Bride's Hair Stylist", scope: 'personal' },
  { name: 'Honeymoon', scope: 'personal' },
] as const;

export const vendorCategoryNames = vendorCategoryCatalog.map((category) => category.name);
export const weddingVendorCategoryNames = vendorCategoryCatalog
  .filter((category) => category.scope === 'wedding')
  .map((category) => category.name);

const legacyCategoryScopes: Record<string, VendorCategoryScope> = {
  Accommodation: 'wedding',
  Flowers: 'wedding',
  Other: 'wedding',
};

function normalizeCategoryKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const categoryAliases: Record<string, string> = {
  venue: 'Wedding Venue',
  'wedding venue': 'Wedding Venue',
  catering: 'Caterer',
  caterer: 'Caterer',
  cake: 'Cake Artist & Baker',
  'cake artist baker': 'Cake Artist & Baker',
  decor: 'Décor, Tents, Chairs, Tables',
  'decor tents chairs tables': 'Décor, Tents, Chairs, Tables',
  mc: 'Master of Ceremonies',
  'master of ceremonies': 'Master of Ceremonies',
  'music dj': 'DJ (or Band) and Sound',
  'music dj band': 'DJ (or Band) and Sound',
  'dj or band and sound': 'DJ (or Band) and Sound',
  photography: 'Photographer',
  photographer: 'Photographer',
  videography: 'Cinematographer',
  cinematographer: 'Cinematographer',
  'photo shoot venue': 'Photo Shoot Venue',
  'marriage license legal fees': 'Wedding Licenses',
  'wedding licenses': 'Wedding Licenses',
  'officiant church fees': 'Church & Officiating Minister',
  'church officiating minister': 'Church & Officiating Minister',
  stationery: 'Invitations',
  invitations: 'Invitations',
  'wedding bands': 'Rings',
  rings: 'Rings',
  'pre marital classes': 'Marriage Preparation',
  'marriage preparation': 'Marriage Preparation',
  'bride attire body prep': 'Bridal Gown, Accessories, Preparation',
  'bridal gown accessories preparation': 'Bridal Gown, Accessories, Preparation',
  'groom attire grooming': "Groom's Attire & Accessories, Preparation",
  'grooms attire accessories preparation': "Groom's Attire & Accessories, Preparation",
  'make up artist': "Bride's Make-up Artist",
  'brides make up artist': "Bride's Make-up Artist",
  'hair stylist': "Bride's Hair Stylist",
  'brides hair stylist': "Bride's Hair Stylist",
  honeymoon: 'Honeymoon',
  transport: 'Transport',
  'wedding planner': 'Wedding Planner / Planning Team',
  'wedding planner planning team': 'Wedding Planner / Planning Team',
};

const catalogByKey = new Map(
  vendorCategoryCatalog.map((category) => [normalizeCategoryKey(category.name), category]),
);

export function canonicalizeVendorCategory(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const key = normalizeCategoryKey(trimmed);
  return categoryAliases[key] ?? catalogByKey.get(key)?.name ?? trimmed;
}

export function getVendorCategoryScope(value: string): VendorCategoryScope {
  const canonical = canonicalizeVendorCategory(value);
  return catalogByKey.get(normalizeCategoryKey(canonical))?.scope
    ?? legacyCategoryScopes[canonical]
    ?? 'wedding';
}

export function vendorCategoriesMatch(left: string, right: string) {
  return normalizeCategoryKey(canonicalizeVendorCategory(left))
    === normalizeCategoryKey(canonicalizeVendorCategory(right));
}

export function getVendorCategoryOptions(currentCategory?: string | null) {
  const current = currentCategory?.trim();
  if (!current) return vendorCategoryCatalog;

  const canonical = canonicalizeVendorCategory(current);
  if (catalogByKey.has(normalizeCategoryKey(canonical))) return vendorCategoryCatalog;

  return [
    ...vendorCategoryCatalog,
    { name: current, scope: getVendorCategoryScope(current) },
  ];
}
