export type VendorCollection = {
  slug: string;
  title: string;
  description: string;
  category?: string | null;
  county?: string | null;
  town?: string | null;
  searchTerms?: string[];
};

export type VendorCollectionListing = {
  category?: string | null;
  business_name?: string | null;
  description?: string | null;
  location?: string | null;
  location_county?: string | null;
  location_town?: string | null;
  services?: string[] | null;
};

export const vendorCollections: VendorCollection[] = [
  {
    slug: 'top-wedding-photographers-kenya',
    title: 'Top Wedding Photographers in Kenya',
    description: 'Studios and independent photographers trusted for full-day coverage, storytelling, and polished delivery.',
    category: 'Photography',
  },
  {
    slug: 'wedding-venues-naivasha',
    title: 'Wedding Venues in Naivasha',
    description: 'Lake, garden, and destination-ready venues couples can browse in one place.',
    category: 'Venue',
    county: 'Nakuru',
    town: 'Naivasha',
  },
  {
    slug: 'luxury-decor-vendors-nairobi',
    title: 'Luxury Decor Vendors in Nairobi',
    description: 'Higher-touch design and styling teams for elegant, immersive wedding spaces in Nairobi.',
    category: 'Décor',
    county: 'Nairobi City',
    searchTerms: ['luxury', 'high-end', 'premium', 'styling', 'floral design'],
  },
  {
    slug: 'indian-wedding-makeup-artists-kenya',
    title: 'Indian Wedding Makeup Artists in Kenya',
    description: 'Makeup artists and beauty teams suited to multiday celebrations, bridal glam, and cultural ceremony styling.',
    searchTerms: ['makeup', 'bridal glam', 'henna', 'indian wedding', 'beauty'],
  },
  {
    slug: 'multiday-wedding-vendors-kenya',
    title: 'Wedding Vendors for Multiday Weddings in Kenya',
    description: 'Teams that can support ceremonies, guest logistics, and execution across several days.',
    searchTerms: ['multiday', 'destination', 'diaspora', 'guest management', 'full weekend'],
  },
];

export function findVendorCollection(slug?: string | null) {
  if (!slug) return null;
  return vendorCollections.find((collection) => collection.slug === slug) ?? null;
}

export function matchesVendorCollection(
  listing: VendorCollectionListing,
  collection: VendorCollection,
) {
  if (collection.category && listing.category !== collection.category) return false;
  if (collection.county) {
    const servesCounty =
      listing.location_county?.toLowerCase() === collection.county.toLowerCase()
      || listing.location?.toLowerCase().includes(collection.county.toLowerCase());
    if (!servesCounty) return false;
  }
  if (collection.town) {
    const townMatch =
      listing.location_town?.toLowerCase() === collection.town.toLowerCase()
      || listing.location?.toLowerCase().includes(collection.town.toLowerCase());
    if (!townMatch) return false;
  }
  if (!collection.searchTerms?.length) return true;

  const searchableText = [
    listing.business_name ?? '',
    listing.description ?? '',
    listing.location ?? '',
    ...(listing.services ?? []),
  ]
    .join(' ')
    .toLowerCase();

  return collection.searchTerms.some((term) => searchableText.includes(term.toLowerCase()));
}
