import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

describe('Supabase browser client', () => {
  beforeEach(() => {
    createClient.mockClear();
  });

  it('keeps Supabase cross-tab refresh locking enabled', async () => {
    await import('@/integrations/supabase/client');

    const options = createClient.mock.calls[0]?.[2];

    expect(options?.auth).not.toHaveProperty('lock');
    expect(options?.auth).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    });
  });
});
