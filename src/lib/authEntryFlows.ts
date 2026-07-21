import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isAppleAuthEnabled } from '@/lib/featureFlags';
import { normalizeHumanName } from '@/lib/names';
import type { PlannerType, SignupRole } from '@/lib/roles';
import type { EstimatorPlanDraft } from '@/lib/estimatorPlanSeed';
import type {
  WeddingOwnerRole,
  WeddingPlanningMode,
  WeddingReferenceCurrency,
  WeddingSignupIntent,
} from '@/lib/pendingWeddingSetup';

export interface AuthEntrySignUpOptions {
  signupIntent?: WeddingSignupIntent | null;
  accountPurpose?: 'planning_my_own_wedding' | 'helping_family_or_friend' | 'professional_planner' | 'vendor' | 'other' | null;
  weddingOwnerRole?: WeddingOwnerRole | null;
  partnerEmail?: string | null;
  weddingName?: string | null;
  weddingCode?: string | null;
  weddingDate?: string | null;
  committeeName?: string | null;
  weddingCounty?: string | null;
  weddingTown?: string | null;
  primaryCounty?: string | null;
  primaryTown?: string | null;
  planningMode?: WeddingPlanningMode | null;
  planningCountry?: string | null;
  referenceCurrency?: WeddingReferenceCurrency | null;
  ownerTimezone?: string | null;
  professionalRoleLocked?: boolean | null;
  estimatorPlanDraft?: EstimatorPlanDraft | null;
}

export interface AuthEntrySignUpResult {
  session: Session | null;
  requiresEmailConfirmation: boolean;
  confirmationEmailResent: boolean;
}

export function isEstimatorCoupleSignupEntry(input: {
  mode?: string | null;
  flow?: string | null;
  audience?: string | null;
  role?: string | null;
}) {
  return input.mode === 'signup'
    && input.flow === 'estimator'
    && input.audience === 'couple'
    && input.role === 'couple';
}

export async function performAuthEntrySignUp(input: {
  email: string;
  password: string;
  fullName: string;
  role: SignupRole;
  options?: AuthEntrySignUpOptions;
  emailRedirectTo: string;
}): Promise<AuthEntrySignUpResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedFullName = normalizeHumanName(input.fullName);
  const isCommittee = input.role === 'committee';
  const weddingCounty = input.options?.weddingCounty?.trim() || null;
  const weddingTown = input.options?.weddingTown?.trim() || null;
  const primaryCounty = input.options?.primaryCounty?.trim() || null;
  const primaryTown = input.options?.primaryTown?.trim() || null;
  const professionalRoleLocked = input.options?.professionalRoleLocked ?? null;
  const accountPurpose = input.options?.accountPurpose ?? null;
  const partnerEmail = input.options?.partnerEmail?.trim().toLowerCase() || null;
  const weddingName = input.options?.weddingName?.trim() || null;
  const weddingCode = input.options?.weddingCode?.trim().toUpperCase() || null;
  const signupIntent = input.options?.signupIntent ?? 'professional';
  const weddingDate = input.options?.weddingDate?.trim() || null;
  const planningMode = input.options?.planningMode === 'diaspora' ? 'diaspora' : 'local';
  const planningCountry = planningMode === 'diaspora' ? input.options?.planningCountry?.trim() || null : null;
  const referenceCurrency = planningMode === 'diaspora' ? input.options?.referenceCurrency ?? null : null;
  const ownerTimezone = planningMode === 'diaspora' ? input.options?.ownerTimezone?.trim() || null : null;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        full_name: normalizedFullName,
        role: isCommittee ? 'planner' : input.role,
        account_purpose: accountPurpose,
        signup_target_role: isCommittee ? 'committee' : input.role,
        professional_signup_role: signupIntent === 'professional' ? (isCommittee ? 'planner' : input.role) : null,
        planner_type: isCommittee ? 'committee' : input.role === 'planner' ? 'professional' : null,
        committee_name: isCommittee ? input.options?.committeeName ?? null : null,
        signup_intent: signupIntent,
        professional_role_locked: signupIntent === 'professional' ? professionalRoleLocked ?? false : true,
        wedding_setup_completed: signupIntent === 'professional',
        wedding_owner_role: input.options?.weddingOwnerRole ?? null,
        partner_email: partnerEmail,
        wedding_name: weddingName,
        wedding_code: weddingCode,
        wedding_county: weddingCounty,
        wedding_town: weddingTown,
        wedding_date: weddingDate,
        wedding_location: weddingTown || weddingCounty ? [weddingTown, weddingCounty].filter(Boolean).join(', ') : null,
        planning_mode: signupIntent === 'create_wedding' ? planningMode : null,
        planning_country: signupIntent === 'create_wedding' ? planningCountry : null,
        reference_currency: signupIntent === 'create_wedding' ? referenceCurrency : null,
        owner_timezone: signupIntent === 'create_wedding' ? ownerTimezone : null,
        primary_county: primaryCounty,
        primary_town: primaryTown,
        estimator_plan_draft:
          signupIntent === 'create_wedding'
            ? input.options?.estimatorPlanDraft ?? null
            : null,
      },
      emailRedirectTo: input.emailRedirectTo,
    },
  });
  if (error) {
    if (error.message.toLowerCase().includes('confirmation email')) {
      throw new Error('We could not send your confirmation email. Your details are safe—please try again in a moment.');
    }
    throw error;
  }

  const isExistingAccountAttempt =
    Array.isArray(data.user?.identities)
    && data.user.identities.length === 0;

  if (isExistingAccountAttempt) {
    const emailAlreadyConfirmed = Boolean(data.user?.email_confirmed_at);

    if (emailAlreadyConfirmed) {
      throw new Error('An account with this email already exists. Sign in instead or reset your password.');
    }

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: input.emailRedirectTo,
      },
    });

    if (resendError) {
      throw new Error('This email is already registered but still waiting for confirmation. We could not resend the confirmation email just now. Please try again in a moment.');
    }

    return {
      session: data.session,
      requiresEmailConfirmation: true,
      confirmationEmailResent: true,
    };
  }

  return {
    session: data.session,
    requiresEmailConfirmation: !data.session,
    confirmationEmailResent: false,
  };
}

export async function performOAuthEntrySignIn(input: {
  provider: 'google' | 'apple';
  redirectBase: string;
  audience?: 'couple' | 'professional' | 'admin' | null;
  mode?: 'signup' | 'signin';
  targetRole?: Extract<SignupRole, 'couple' | 'planner' | 'vendor'> | null;
  plannerType?: PlannerType | null;
}) {
  if (input.provider === 'apple' && !isAppleAuthEnabled()) {
    throw new Error('Apple sign-in is not available yet. Please continue with Google or email for now.');
  }

  const redirectUrl = new URL(`${input.redirectBase}/auth/callback`);
  const mode = input.mode === 'signin' ? 'signin' : 'signup';
  const targetRole = input.targetRole ?? null;
  const audience = input.audience ?? (targetRole === 'couple' ? 'couple' : 'professional');

  redirectUrl.searchParams.set('auth_mode', mode);
  redirectUrl.searchParams.set('audience', audience);

  if (targetRole) {
    redirectUrl.searchParams.set('target_role', targetRole);
    if (mode === 'signup') {
      redirectUrl.searchParams.set('signup_role', targetRole);
    }
    if (targetRole === 'planner') {
      redirectUrl.searchParams.set(
        'planner_type',
        input.plannerType === 'committee' ? 'committee' : 'professional',
      );
    }
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: input.provider,
    options: {
      redirectTo: redirectUrl.toString(),
      queryParams: input.provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
  if (error) throw error;
}
