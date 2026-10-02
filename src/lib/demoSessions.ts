import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type DemoRole = 'couple' | 'vendor' | 'planner';

export type DemoSession = {
  demoRole: DemoRole;
  destinationPath: string;
  status: 'active' | 'ended' | 'expired';
  expiresAt: string;
  resetCount: number;
};

type DemoSessionRow = {
  demo_role: DemoRole;
  destination_path: string;
  status?: DemoSession['status'];
  expires_at: string;
  reset_count?: number;
};

type DemoRpcResult = {
  data: DemoSessionRow[] | null;
  error: { message: string } | null;
};

type DemoRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<DemoRpcResult>;
};

const demoRpcClient = supabase as unknown as DemoRpcClient;

const roleIdentity: Record<DemoRole, { fullName: string; plannerType: string | null }> = {
  couple: { fullName: 'Amina & Kamau', plannerType: null },
  vendor: { fullName: 'Nia Wanjiku', plannerType: null },
  planner: { fullName: 'Grace Njeri', plannerType: 'professional' },
};

export const isAnonymousDemoUser = (user: User | null | undefined) =>
  Boolean(
    user?.is_anonymous
    || user?.app_metadata?.provider === 'anonymous'
    || user?.app_metadata?.providers?.includes?.('anonymous'),
  );

const normalizeDemoSession = (row: DemoSessionRow): DemoSession => ({
  demoRole: row.demo_role,
  destinationPath: row.destination_path,
  status: row.status ?? 'active',
  expiresAt: row.expires_at,
  resetCount: row.reset_count ?? 0,
});

export async function getCurrentDemoSession(): Promise<DemoSession | null> {
  const { data, error } = await demoRpcClient.rpc('get_current_demo_session');
  if (error) throw error;
  const row = (data?.[0] ?? null) as DemoSessionRow | null;
  return row ? normalizeDemoSession(row) : null;
}

export async function startDemoSession(role: DemoRole, captchaToken?: string): Promise<DemoSession> {
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user ?? null;
  let createdTemporaryUser = false;

  if (user && !isAnonymousDemoUser(user)) {
    throw new Error('You are already signed in. Open your workspace, or sign out before starting a temporary demo.');
  }

  if (!user) {
    const identity = roleIdentity[role];
    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        captchaToken,
        data: {
          role,
          full_name: identity.fullName,
          planner_type: identity.plannerType,
          wedding_setup_completed: true,
          zania_demo: true,
        },
      },
    });
    if (error) throw error;
    user = data.user;
    createdTemporaryUser = true;
  }

  try {
    const { data, error } = await demoRpcClient.rpc('start_demo_session', {
      target_role: role,
    });
    if (error) throw error;
    const row = data?.[0] as DemoSessionRow | undefined;
    if (!row) throw new Error('The demo workspace could not be prepared. Please try again.');
    return normalizeDemoSession(row);
  } catch (error) {
    if (createdTemporaryUser) await supabase.auth.signOut({ scope: 'local' });
    throw error;
  }
}

export async function resetDemoSession(): Promise<DemoSession> {
  const { data, error } = await demoRpcClient.rpc('reset_demo_session');
  if (error) throw error;
  const row = data?.[0] as DemoSessionRow | undefined;
  if (!row) throw new Error('The demo workspace could not be reset.');
  return normalizeDemoSession(row);
}

export async function exitDemoSession() {
  const { error: endError } = await demoRpcClient.rpc('end_demo_session');
  if (endError) throw endError;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export function demoRoleLabel(role: DemoRole) {
  if (role === 'vendor') return 'Professional';
  return role.charAt(0).toUpperCase() + role.slice(1);
}
