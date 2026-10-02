import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const order = vi.fn();
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { getUser, order, eq, select, from };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

import { listVendorListingOptions } from '@/lib/commercialDocuments';

describe('listVendorListingOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockReturnValue({ order: mocks.order });
  });

  it('loads only listings owned by the signed-in vendor', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'vendor-user-1' } },
      error: null,
    });
    mocks.order.mockResolvedValue({
      data: [{ id: 'listing-1', business_name: 'Mwaniki Weddings' }],
      error: null,
    });

    await expect(listVendorListingOptions()).resolves.toEqual([
      expect.objectContaining({ id: 'listing-1', label: 'Mwaniki Weddings' }),
    ]);
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'vendor-user-1');
  });

  it('does not query listings without an authenticated user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(listVendorListingOptions()).resolves.toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
