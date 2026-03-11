import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, SignupRole } from '@/lib/roles';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  partner_name: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
  role: AppRole;
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  bio: string | null;
  specialties: string[] | null;
  avatar_url: string | null;
  planner_verified: boolean;
  planner_verification_requested: boolean;
  planner_verification_requested_at: string | null;
  planner_subscription_status: 'inactive' | 'active' | 'past_due' | 'cancelled';
  planner_subscription_started_at: string | null;
  planner_subscription_expires_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role?: SignupRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const getFallbackFullName = (authUser: User) => {
    const fullName = authUser.user_metadata?.full_name;
    const name = authUser.user_metadata?.name;
    const givenName = authUser.user_metadata?.given_name;
    const familyName = authUser.user_metadata?.family_name;
    const combinedName = [givenName, familyName].filter(Boolean).join(' ').trim();

    return fullName || name || combinedName || authUser.email?.split('@')[0] || '';
  };

  const getFallbackRole = async (authUser: User): Promise<AppRole> => {
    const requestedRole = authUser.user_metadata?.role;
    if (requestedRole === 'admin' || requestedRole === 'vendor' || requestedRole === 'planner' || requestedRole === 'couple') {
      return requestedRole;
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id);

    if (error || !data?.length) return 'couple';

    const rolePriority: Record<AppRole, number> = {
      admin: 4,
      vendor: 3,
      planner: 2,
      couple: 1,
    };

    return [...data]
      .sort((a, b) => rolePriority[b.role as AppRole] - rolePriority[a.role as AppRole])[0]
      .role as AppRole;
  };

  const buildFallbackProfile = (authUser: User, role: AppRole): Profile => ({
    id: authUser.id,
    user_id: authUser.id,
    full_name: getFallbackFullName(authUser) || null,
    partner_name: null,
    wedding_date: null,
    wedding_location: null,
    role,
    company_name: null,
    company_email: authUser.email ?? null,
    company_phone: null,
    company_website: null,
    bio: null,
    specialties: null,
    avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
    planner_verified: false,
    planner_verification_requested: false,
    planner_verification_requested_at: null,
    planner_subscription_status: 'inactive',
    planner_subscription_started_at: null,
    planner_subscription_expires_at: null,
  });

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error.message);
      setProfile(null);
      return null;
    }

    if (!data) {
      setProfile(null);
      return null;
    }

    setProfile(data as Profile);
    return data as Profile;
  };

  const ensureProfile = async (authUser: User) => {
    const existingProfile = await fetchProfile(authUser.id);
    if (existingProfile) return existingProfile;

    const role = await getFallbackRole(authUser);
    const fullName = getFallbackFullName(authUser);

    const { error } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        full_name: fullName,
        role,
      });

    if (error && error.code !== '23505') {
      console.error('Failed to recover missing profile:', error.message);
      const fallbackProfile = buildFallbackProfile(authUser, role);
      setProfile(fallbackProfile);
      return fallbackProfile;
    }

    const recoveredProfile = await fetchProfile(authUser.id);
    if (recoveredProfile) return recoveredProfile;

    const fallbackProfile = buildFallbackProfile(authUser, role);
    setProfile(fallbackProfile);
    return fallbackProfile;
  };

  const syncAuthState = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      void ensureProfile(nextSession.user);
      return;
    }

    setProfile(null);
  };

  const hydrateSessionFromHash = async () => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('access_token=')) return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken || !refreshToken) return;

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Failed to hydrate auth session from callback hash:', error.message);
      return;
    }

    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${window.location.search}`,
    );
  };

  const getSessionWithTimeout = async (timeoutMs = 2500): Promise<Session | null> => {
    return await Promise.race([
      supabase.auth.getSession().then(({ data: { session } }) => session),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn(`Auth session lookup timed out after ${timeoutMs}ms; continuing without blocking app startup.`);
          resolve(null);
        }, timeoutMs);
      }),
    ]);
  };

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (!active) return;
          syncAuthState(session);
        } finally {
          if (active) setLoading(false);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        await hydrateSessionFromHash();
        const session = await getSessionWithTimeout();
        if (!active) return;
        syncAuthState(session);
      } finally {
        if (active) setLoading(false);
      }
    };

    void initializeAuth();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: SignupRole = 'couple') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signInWithGoogle, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
