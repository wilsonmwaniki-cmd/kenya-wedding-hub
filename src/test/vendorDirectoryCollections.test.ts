import { describe, expect, it } from 'vitest';

import {
  findVendorCollection,
  matchesVendorCollection,
} from '@/lib/vendorDirectoryCollections';

describe('vendor directory collections', () => {
  it('finds the configured collection by slug', () => {
    expect(findVendorCollection('wedding-venues-naivasha')?.title).toBe('Wedding Venues in Naivasha');
    expect(findVendorCollection('missing-collection')).toBeNull();
  });

  it('matches category and location-based collections', () => {
    const collection = findVendorCollection('wedding-venues-naivasha');
    expect(collection).not.toBeNull();

    expect(
      matchesVendorCollection(
        {
          category: 'Venue',
          location_county: 'Nakuru',
          location_town: 'Naivasha',
          location: 'Naivasha, Nakuru',
        },
        collection!,
      ),
    ).toBe(true);

    expect(
      matchesVendorCollection(
        {
          category: 'Venue',
          location_county: 'Nairobi City',
          location_town: 'Karen',
          location: 'Karen, Nairobi City',
        },
        collection!,
      ),
    ).toBe(false);
  });

  it('matches search-term led collections using business text and services', () => {
    const collection = findVendorCollection('indian-wedding-makeup-artists-kenya');
    expect(collection).not.toBeNull();

    expect(
      matchesVendorCollection(
        {
          category: 'Other',
          business_name: 'Sanya Bridal Beauty',
          description: 'Luxury bridal glam team for multiday ceremonies.',
          services: ['Makeup', 'Henna'],
        },
        collection!,
      ),
    ).toBe(true);

    expect(
      matchesVendorCollection(
        {
          category: 'Photography',
          business_name: 'Lakeview Photo',
          description: 'Editorial wedding photography.',
          services: ['Photography'],
        },
        collection!,
      ),
    ).toBe(false);
  });
});
