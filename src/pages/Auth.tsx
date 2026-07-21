import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Copy, Eye, EyeOff, Loader2, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getHomeRouteForRole, isProfessionalSetupPending, type SignupRole } from '@/lib/roles';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import {
  getEstimatorPlanDraft,
  hasPendingEstimatorPlanDraft,
  seedPendingEstimatorPlanForUser,
} from '@/lib/estimatorPlanSeed';
import {
  clearPendingOAuthSignupState,
  persistPendingOAuthSignupState,
} from '@/lib/oauthSignupState';
import {
  clearPendingProfessionalSetup,
} from '@/lib/professionalSetupState';
import { persistPendingVendorClaim, readPendingVendorClaim } from '@/lib/vendorClaimState';
import {
  clearPendingWeddingSetup,
  getPendingWeddingSetup,
  persistPendingWeddingSetup,
  reconcilePendingWeddingSetupForExistingWorkspace,
  type PendingWeddingSetup,
  type WeddingSignupIntent,
} from '@/lib/weddingWorkspace';
import { copyTextWithFallback, createSecurePassword, validatePasswordRequirements } from '@/lib/passwords';
import BrandWordmark from '@/components/BrandWordmark';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import AppleAuthButton from '@/components/AppleAuthButton';
import { normalizeHumanName, normalizeHumanNameInput } from '@/lib/names';
import { isAppleAuthEnabled } from '@/lib/featureFlags';
import { isEstimatorCoupleSignupEntry } from '@/lib/authEntryFlows';
import { PublicPageSkeleton } from '@/components/AppLoadingSkeletons';
import PublicSiteFooter from '@/components/PublicSiteFooter';

type AuthEntryState = {
  mode?: 'signup' | 'signin';
  role?: SignupRole;
  signupPath?: WeddingSignupIntent;
  professionalRole?: ProfessionalSignupRole;
  from?: string;
} | null;
type ProfessionalSignupRole = 'planner' | 'vendor';
type AuthAudience = 'couple' | 'professional' | 'admin';
type SignupMethod = 'email' | 'google' | 'apple';
type SignupWizardStep = 'method' | 'account' | 'role' | 'success';
type SignupSuccessState = {
  title: string;
  description: string;
  accent: string;
};
type OAuthProvider = 'google' | 'apple';
type AccountPurpose = 'planning_my_own_wedding' | 'helping_family_or_friend' | 'professional_planner' | 'vendor' | 'other';

type SignupResultState = {
  requiresEmailConfirmation: boolean;
  confirmationEmailResent: boolean;
};

function mapEntryRoleToSignupPath(role?: SignupRole): {
  signupPath: WeddingSignupIntent;
  professionalRole: ProfessionalSignupRole;
} {
  if (role === 'planner') {
    return { signupPath: 'professional', professionalRole: 'planner' };
  }

  if (role === 'vendor') {
    return { signupPath: 'professional', professionalRole: 'vendor' };
  }

  if (role === 'committee') {
    return { signupPath: 'join_wedding', professionalRole: 'planner' };
  }

  return { signupPath: 'create_wedding', professionalRole: 'planner' };
}

function normalizeJoinCode(value: string) {
  return value.trim().toUpperCase();
}

function buildSignupSuccessDescription(
  signupResult: SignupResultState,
  confirmedMessage: string,
  instantAccessMessage: string,
) {
  if (signupResult.confirmationEmailResent) {
    return 'This email already had a pending signup, so we sent a fresh confirmation link. Check your inbox and spam, then come back to continue.';
  }

  return signupResult.requiresEmailConfirmation ? confirmedMessage : instantAccessMessage;
}

const accountPurposeOptions: Array<{ value: AccountPurpose; label: string }> = [
  { value: 'planning_my_own_wedding', label: 'I am planning my own wedding' },
  { value: 'helping_family_or_friend', label: 'I am helping a family member or friend' },
  { value: 'professional_planner', label: 'I am a professional wedding planner' },
  { value: 'vendor', label: 'I am a wedding vendor' },
  { value: 'other', label: 'Other' },
];

function getFallbackRouteFromUserMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
  userEmail?: string | null,
) {
  if (isProfessionalSetupPending(userMetadata, null, userEmail ?? null)) {
    return '/settings';
  }

  const role = userMetadata?.role;
  const plannerType = userMetadata?.planner_type;

  if (role === 'committee') {
    return getHomeRouteForRole('planner', 'committee');
  }

  if (role === 'planner') {
    return getHomeRouteForRole('planner', plannerType === 'committee' ? 'committee' : 'professional');
  }

  if (role === 'vendor' || role === 'admin' || role === 'couple') {
    return getHomeRouteForRole(role, null);
  }

  return getHomeRouteForRole('couple', null);
}

function SignupTermsNotice({
  acceptedTerms,
  onAcceptedTermsChange,
  error,
  compact = false,
}: {
  acceptedTerms: boolean;
  onAcceptedTermsChange: (checked: boolean) => void;
  error?: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-muted/20 px-4 ${compact ? 'py-2.5' : 'py-3'}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          id="signup-terms"
          checked={acceptedTerms}
          onCheckedChange={(checked) => onAcceptedTermsChange(Boolean(checked))}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label htmlFor="signup-terms" className="text-sm font-medium leading-6">
            I agree to the{' '}
            <Link to="/terms" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              Zania Terms of Service
            </Link>
            {" "}and{" "}
            <Link to="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </Label>
          {!compact ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Please review both documents before creating your Zania account.
            </p>
          ) : null}
          <FormFieldError message={error} />
        </div>
      </div>
    </div>
  );
}

export default function Auth() {
  const location = useLocation();
  const entryState = location.state as AuthEntryState;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedPath = typeof (location.state as { from?: string } | null)?.from === 'string'
    ? (location.state as { from?: string }).from
    : null;
  const adminEntry = location.pathname === '/admin/login' || requestedPath === '/admin';
  const vendorClaimEntry = searchParams.get('flow') === 'vendor_claim';
  const requestedMode = searchParams.get('mode');
  const requestedFlow = searchParams.get('flow');
  const requestedAudience = searchParams.get('audience');
  const requestedRole = searchParams.get('role');
  const isEstimatorCoupleEntry = isEstimatorCoupleSignupEntry({
    mode: requestedMode,
    flow: requestedFlow,
    audience: requestedAudience,
    role: requestedRole,
  });
  const hasExplicitUrlAuthState = (
    location.pathname === '/sign-in'
    || searchParams.has('mode')
    || searchParams.has('flow')
    || searchParams.has('audience')
    || searchParams.has('role')
    || searchParams.has('code')
    || searchParams.has('email')
  );
  const defaultToSignup = !adminEntry && requestedMode !== 'signin' && location.pathname !== '/sign-in';

  const [isSignUp, setIsSignUp] = useState(defaultToSignup);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [accountPurpose, setAccountPurpose] = useState<AccountPurpose>('planning_my_own_wedding');
  const [signupMethod, setSignupMethod] = useState<SignupMethod | null>(defaultToSignup ? null : 'email');
  const [selectedAudience, setSelectedAudience] = useState<AuthAudience | null>(null);
  const [signupPath, setSignupPath] = useState<WeddingSignupIntent | null>(null);
  const [professionalSignupRole, setProfessionalSignupRole] = useState<ProfessionalSignupRole | null>(null);
  const [signupStep, setSignupStep] = useState<SignupWizardStep>(defaultToSignup ? 'method' : 'account');
  const [signupSuccess, setSignupSuccess] = useState<SignupSuccessState | null>(null);
  const [weddingCode, setWeddingCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmittingProvider, setOauthSubmittingProvider] = useState<OAuthProvider | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [postSignupMessage, setPostSignupMessage] = useState<string | null>(null);
  const [forgotErrors, setForgotErrors] = useState<{ email?: string }>({});
  const [forgotSubmitError, setForgotSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    weddingCode?: string;
    acceptedTerms?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { signIn, signUp, signInWithGoogle, signInWithApple, user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const appleAuthEnabled = isAppleAuthEnabled();

  const hasHomepageCarryover = Boolean(entryState?.role);
  const audience: AuthAudience | null = selectedAudience;
  const isGeneralSignIn = !isSignUp && !adminEntry;
  const oauthSubmitting = oauthSubmittingProvider !== null;
  const showJoinDetails = isSignUp && selectedAudience === 'couple' && signupPath === 'join_wedding';
  const hasProfessionalSelection = !isSignUp || signupStep !== 'role'
    ? true
    : (
      (selectedAudience === 'couple' && !!signupPath)
      || (selectedAudience === 'professional' && !!professionalSignupRole)
    );
  const hasChosenAudiencePath = isGeneralSignIn ? true : !!audience && (!isSignUp || !!signupPath);
  const hasChosenPath = hasChosenAudiencePath && hasProfessionalSelection;
  const isSignupMethodStep = isSignUp && signupStep === 'method';
  const isSignupAccountStep = isSignUp && signupStep === 'account';
  const isSignupRoleStep = isSignUp && signupStep === 'role';
  const isSignupSuccessStep = isSignUp && signupStep === 'success' && !!signupSuccess;
  const hasLockedSignupTrack = isSignUp && (
    (requestedFlow === 'join_wedding')
    || (requestedAudience === 'professional' && (requestedRole === 'planner' || requestedRole === 'vendor'))
    || isEstimatorCoupleEntry
  );
  const showGenericModeChooser = false;
  const showGenericAudienceChooser = false;
  const signupProgressStep = isSignupSuccessStep ? 4 : isSignupRoleStep ? 3 : isSignupAccountStep ? 2 : 1;
  const authErrorMessage = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auth_error') !== 'missing_role') return null;

    const role = params.get('role');
    if (role === 'planner') return 'This email does not have a planner account yet. Choose planner sign up first.';
    if (role === 'vendor') return 'This email does not have a vendor account yet. Choose vendor sign up first.';
    return 'This email does not have a wedding account yet. Choose the matching sign up path first.';
  }, [location.search]);

  useEffect(() => {
    if (!isSignUp) return;

    if (signupPath === 'professional') {
      setAccountPurpose(professionalSignupRole === 'vendor' ? 'vendor' : 'professional_planner');
      return;
    }

    if (signupPath === 'join_wedding') {
      setAccountPurpose('helping_family_or_friend');
      return;
    }

    setAccountPurpose('planning_my_own_wedding');
  }, [isSignUp, professionalSignupRole, signupPath]);

  useEffect(() => {
    if (hasExplicitUrlAuthState || location.pathname === '/sign-in') return;

    const state = location.state as AuthEntryState;
    if (!state) return;

    if (state.mode) {
      setIsSignUp(state.mode === 'signup');
      setIsForgot(false);
      setPostSignupMessage(null);
      setSignupSuccess(null);
      setSignupMethod(state.mode === 'signup' ? null : 'email');
      setSignupStep(state.mode === 'signup' ? 'method' : 'account');
      if (state.mode === 'signin' && !adminEntry) {
        setSelectedAudience(null);
        setSignupPath(null);
        setProfessionalSignupRole(null);
      }
    }

    if (state.signupPath) {
      setSelectedAudience(state.signupPath === 'professional' ? 'professional' : 'couple');
      setSignupPath(state.signupPath);
      if (state.professionalRole) {
        setProfessionalSignupRole(state.professionalRole);
      }
      setSignupMethod(state.mode === 'signup' ? 'email' : 'email');
      setSignupStep(state.mode === 'signup' ? 'role' : 'account');
      return;
    }

    if (state.role) {
      const mapped = mapEntryRoleToSignupPath(state.role);
      setSelectedAudience(mapped.signupPath === 'professional' ? 'professional' : 'couple');
      setSignupPath(mapped.signupPath);
      setProfessionalSignupRole(mapped.signupPath === 'professional' ? mapped.professionalRole : null);
      setSignupMethod(state.mode === 'signup' ? 'email' : 'email');
      setSignupStep(state.mode === 'signup' ? 'role' : 'account');
    }
  }, [hasExplicitUrlAuthState, location.pathname, location.state, adminEntry]);

  useEffect(() => {
    if (!adminEntry) return;
    setIsSignUp(false);
    setIsForgot(false);
    setPostSignupMessage(null);
    setSignupSuccess(null);
    setSelectedAudience('admin');
    setSignupPath(null);
    setSignupMethod('email');
    setSignupStep('account');
  }, [adminEntry]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const flow = params.get('flow');
    const code = params.get('code');
    const invitedEmail = params.get('email');
    const mode = params.get('mode');
    const audienceParam = params.get('audience');
    const roleParam = params.get('role');
    const isExplicitSignInRoute = location.pathname === '/sign-in' || mode === 'signin';
    const isExplicitSignupRoute = mode === 'signup';

    if (adminEntry) {
      setIsSignUp(false);
      setIsForgot(false);
      setPostSignupMessage(null);
      setSignupSuccess(null);
      setSelectedAudience('admin');
      setSignupPath(null);
      setProfessionalSignupRole(null);
      setSignupMethod('email');
      setSignupStep('account');
      return;
    }

    if (isExplicitSignInRoute) {
      setIsSignUp(false);
      setIsForgot(false);
      setPostSignupMessage(null);
      setSignupSuccess(null);
      setSelectedAudience(null);
      setSignupPath(null);
      setProfessionalSignupRole(null);
      setSignupMethod('email');
      setSignupStep('account');

      if (invitedEmail) {
        setEmail(invitedEmail.trim().toLowerCase());
      }

      return;
    }

    if (isExplicitSignupRoute && !flow && !audienceParam) {
      setIsSignUp(true);
      setIsForgot(false);
      setPostSignupMessage(null);
      setSignupSuccess(null);
      setSelectedAudience(null);
      setSignupPath(null);
      setProfessionalSignupRole(null);
      setSignupMethod(null);
      setSignupStep('method');
    }

    if (flow === 'join_wedding') {
      setSelectedAudience('couple');
      setSignupPath('join_wedding');
      setIsSignUp(true);
      setIsForgot(false);
      setPostSignupMessage(null);
      setSignupSuccess(null);
      setSignupMethod('email');
      setSignupStep('account');
    }

    if (flow === 'vendor_claim') {
      setSelectedAudience('professional');
      setSignupPath('professional');
      setProfessionalSignupRole('vendor');
      setIsForgot(false);
      setPostSignupMessage(null);
      setSignupSuccess(null);
      setSignupMethod(mode === 'signup' ? 'email' : 'email');
      setSignupStep('account');
    }

    if (code) {
      setWeddingCode(normalizeJoinCode(code));
    }

    if (invitedEmail) {
      setEmail(invitedEmail.trim().toLowerCase());
    }

    if (mode === 'signup' || mode === 'signin') {
      setIsSignUp(mode === 'signup');
      setIsForgot(false);
      setSignupSuccess(null);
      if (mode === 'signin') {
        setSelectedAudience(adminEntry ? 'admin' : null);
        setSignupPath(null);
        setProfessionalSignupRole(null);
        setSignupMethod('email');
        setSignupStep('account');
      } else if (!flow && !audienceParam) {
        setSignupMethod(null);
        setSignupStep('method');
      }
    }

    if (audienceParam === 'couple' || audienceParam === 'professional') {
      setSelectedAudience(audienceParam);
      setSignupPath(audienceParam === 'couple' ? (flow === 'join_wedding' ? 'join_wedding' : 'create_wedding') : 'professional');
      if (mode === 'signup') {
        setSignupMethod('email');
        setSignupStep((flow === 'join_wedding'
          || (flow === 'estimator' && audienceParam === 'couple' && roleParam === 'couple')
          || (audienceParam === 'professional' && (roleParam === 'planner' || roleParam === 'vendor')))
          ? 'account'
          : 'role');
      }
    }

    if (roleParam === 'planner' || roleParam === 'vendor') {
      setProfessionalSignupRole(roleParam);
    }

  }, [location.pathname, location.search, adminEntry]);

  useEffect(() => {
    if (signupPath === 'professional') return;
    if (!isSignUp && !hasHomepageCarryover) return;

    const timer = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 160);

    return () => window.clearTimeout(timer);
  }, [hasHomepageCarryover, isSignUp, signupPath]);

  useEffect(() => {
    if (loading || !user || redirecting) return;

    const pendingSetup = getPendingWeddingSetup(user.user_metadata, user.email ?? null);
    let active = true;

    const finalizeEntry = async () => {
      try {
        if (isProfessionalSetupPending(user.user_metadata, profile?.role, user.email ?? null)) {
          if (active) {
            setRedirecting(true);
            navigate(readPendingVendorClaim() ? '/settings?claim_vendor=1' : '/settings', { replace: true });
          }
          return;
        }

        if (pendingSetup) {
          const reconciled = await reconcilePendingWeddingSetupForExistingWorkspace(user);
          if (!active) return;

          if (reconciled.handled) {
            setRedirecting(true);
            navigate(reconciled.route, { replace: true });
            return;
          }

          if (!active) return;
          navigate('/wedding-setup', { replace: true });
          return;
        }

        if (!profile?.role) {
          if (active) {
            navigate(getFallbackRouteFromUserMetadata(user.user_metadata, user.email ?? null), { replace: true });
          }
          return;
        }

        if (readPendingVendorClaim()) {
          if (active) {
            setRedirecting(true);
            navigate('/vendor-claim', { replace: true });
          }
          return;
        }

        if (hasPendingEstimatorPlanDraft(user.user_metadata)) {
          const seeded = await seedPendingEstimatorPlanForUser({
            userId: user.id,
            role: profile.role,
            plannerType: profile.planner_type,
            userMetadata: user.user_metadata,
          });

          if (seeded && active) {
            setRedirecting(true);
            toast({
              title: 'Wedding plan ready',
              description: 'Your estimate was turned into a starter budget, vendor list, and tasks.',
            });
            navigate('/budget', { replace: true });
            return;
          }
        }

        if (active) {
          setRedirecting(true);
          navigate(getHomeRouteForRole(profile.role, profile.planner_type), { replace: true });
        }
      } catch (err: any) {
        if (!active) return;
        toast({
          title: 'We could not finish that wedding setup',
          description: err.message,
          variant: 'destructive',
        });
        setRedirecting(false);
      }
    };

    void finalizeEntry();

    return () => {
      active = false;
    };
  }, [loading, navigate, profile?.planner_type, profile?.role, redirecting, toast, user]);

  const createGeneratedPassword = () => {
    const nextPassword = createSecurePassword();

    setPassword(nextPassword);
    setGeneratedPassword(nextPassword);
    setShowPassword(true);
    toast({
      title: 'Secure password generated',
      description: 'You can use this as-is or replace it with your own password.',
    });
  };

  const copyGeneratedPassword = async () => {
    if (!password) return;

    const copied = await copyTextWithFallback(password);

    if (copied) {
      toast({
        title: 'Password copied',
        description: 'Paste it somewhere safe if you want to keep a copy.',
      });
      return;
    }

    toast({
      title: 'Could not copy password',
      description: 'You can still reveal it and copy it manually.',
      variant: 'destructive',
    });
  };

  const normalizeFullNameField = () => {
    if (!fullName.trim()) return;
    setFullName(normalizeHumanName(fullName));
  };

  const resetSignupWizard = () => {
    setSignupMethod(null);
    setSignupStep('method');
    setSignupSuccess(null);
    setSelectedAudience(null);
    setSignupPath(null);
    setProfessionalSignupRole(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setAccountPurpose('planning_my_own_wedding');
    setGeneratedPassword(null);
    setShowPassword(false);
    setAcceptedTerms(false);
    setFormErrors({});
    setSubmitError(null);
    setWeddingCode('');
    clearPendingOAuthSignupState();
  };

  const chooseSignupMethod = (method: SignupMethod) => {
    setSignupMethod(method);
    setSubmitError(null);
    setFormErrors({});
    setSignupSuccess(null);
    setSignupStep(method === 'email' ? 'account' : 'role');
  };

  const chooseSignupRole = (role: 'couple' | 'planner' | 'vendor') => {
    setSubmitError(null);
    setSignupSuccess(null);

    if (role === 'couple') {
      setSelectedAudience('couple');
      setSignupPath((current) => current === 'join_wedding' ? 'join_wedding' : 'create_wedding');
      setProfessionalSignupRole(null);
      return;
    }

    setSelectedAudience('professional');
    setSignupPath('professional');
    setProfessionalSignupRole(role);
  };

  const continueToRoleStep = () => {
    const nextErrors: {
      fullName?: string;
      email?: string;
      password?: string;
      acceptedTerms?: string;
    } = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Enter your full name.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Enter your email address.';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter your password.';
    } else {
      const passwordValidationError = validatePasswordRequirements(password);
      if (passwordValidationError) nextErrors.password = passwordValidationError;
    }

    if (!acceptedTerms) {
      nextErrors.acceptedTerms = 'Please accept the Terms of Service and Privacy Policy to continue.';
    }

    setFormErrors((current) => ({ ...current, ...nextErrors }));
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) return;
    setSignupStep('role');
  };

  if (loading || redirecting) {
    return <PublicPageSkeleton />;
  }

  const persistWeddingIntentIfNeeded = () => {
    if (!signupPath) {
      clearPendingWeddingSetup();
      return;
    }

    if (signupPath === 'professional') {
      clearPendingWeddingSetup();
      return;
    }

    const payload: PendingWeddingSetup = {
      intent: signupPath,
      email,
      weddingCode: signupPath === 'join_wedding' ? normalizeJoinCode(weddingCode) : null,
    };

    persistPendingWeddingSetup(payload);
  };

  const validateOAuthIntent = () => {
    if (!isSignUp) {
      if (adminEntry) return;
      return;
    }

    if (!audience) {
      throw new Error(`Choose whether you are continuing as a couple or wedding professional first.`);
    }

    if (!selectedAudience || !signupPath) {
      throw new Error('Choose how you are signing up before continuing.');
    }

    if (signupPath === 'join_wedding' && !normalizeJoinCode(weddingCode)) {
      throw new Error('Enter the wedding code from the invitation before continuing with Google.');
    }

    if (signupPath === 'professional' && !professionalSignupRole) {
      throw new Error('Choose whether this professional account is for a planner or a vendor first.');
    }

    if (!acceptedTerms) {
      throw new Error('Please accept the Terms of Service and Privacy Policy before continuing.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { email?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) nextErrors.email = 'Enter the email tied to this account.';
    else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) nextErrors.email = 'Enter a valid email address.';

    setForgotErrors(nextErrors);
    setForgotSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password?type=recovery`,
      });
      if (error) throw error;
      toast({ title: 'Reset link sent!', description: 'Check your email for the password reset link.' });
      setIsForgot(false);
      setForgotErrors({});
    } catch (err: any) {
      setForgotSubmitError(err.message || 'We could not send the reset link right now.');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: {
      fullName?: string;
      email?: string;
      password?: string;
      weddingCode?: string;
      acceptedTerms?: string;
    } = {};

    if (isSignUp && !fullName.trim()) {
      nextErrors.fullName = 'Enter your full name.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Enter your email address.';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter your password.';
    } else if (isSignUp) {
      const passwordValidationError = validatePasswordRequirements(password);
      if (passwordValidationError) nextErrors.password = passwordValidationError;
    }

    if (isSignUp && signupPath === 'join_wedding' && !normalizeJoinCode(weddingCode)) {
      nextErrors.weddingCode = 'Enter the wedding code from your invitation email.';
    }

    if (isSignUp && !acceptedTerms) {
      nextErrors.acceptedTerms = 'Please accept the Terms of Service and Privacy Policy to continue.';
    }

    setFormErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      const pendingVendorClaim = readPendingVendorClaim();
      if (vendorClaimEntry && pendingVendorClaim?.token) {
        persistPendingVendorClaim(pendingVendorClaim.token, email || pendingVendorClaim.email);
      }

      if (isSignUp) {
        if (!selectedAudience || !signupPath) {
          throw new Error('Choose whether you are signing up as a couple or a wedding professional first.');
        }

        if (signupPath === 'create_wedding') {
          persistWeddingIntentIfNeeded();
          const signupResult = await signUp(email, password, fullName, 'couple', {
            signupIntent: 'create_wedding',
            accountPurpose,
            estimatorPlanDraft: requestedFlow === 'estimator' ? getEstimatorPlanDraft() : null,
          });
          setSignupSuccess({
            title: 'Welcome to Zania',
            accent: 'Couple account created',
            description: buildSignupSuccessDescription(
              signupResult,
              'Check your email to confirm your account, then come back to finish setting up your wedding workspace.',
              'Your account is ready right away. You can continue straight into your wedding workspace.',
            ),
          });
          setSignupStep('success');
        } else if (signupPath === 'join_wedding') {
          if (!normalizeJoinCode(weddingCode)) {
            throw new Error('Enter the wedding code from your invitation email.');
          }

          persistWeddingIntentIfNeeded();
          const signupResult = await signUp(email, password, fullName, 'couple', {
            signupIntent: 'join_wedding',
            accountPurpose,
            weddingCode: normalizeJoinCode(weddingCode),
          });
          setSignupSuccess({
            title: 'You are in',
            accent: 'Invitation account ready',
            description: buildSignupSuccessDescription(
              signupResult,
              'Check your email to confirm your account, then sign in with the same email to join the wedding that invited you.',
              'Your account is ready. Sign in with the same email to join the wedding that invited you.',
            ),
          });
          setSignupStep('success');
        } else {
          if (!professionalSignupRole) {
            throw new Error('Choose whether you are creating a planner or vendor account first.');
          }

          clearPendingWeddingSetup();
          clearPendingProfessionalSetup();
          const signupResult = await signUp(email, password, fullName, professionalSignupRole, {
            signupIntent: 'professional',
            accountPurpose,
            professionalRoleLocked: true,
          });
          setSignupSuccess({
            title: 'You joined the atelier',
            accent: professionalSignupRole === 'planner' ? 'Planner account created' : 'Vendor account created',
            description: buildSignupSuccessDescription(
              signupResult,
              `Check your email to confirm your account, then sign in to open your ${professionalSignupRole} workspace.`,
              `Your account is ready. Sign in now to open your ${professionalSignupRole} workspace.`,
            ),
          });
          setSignupStep('success');
        }
      } else {
        persistWeddingIntentIfNeeded();
        await signIn(email, password, adminEntry ? { audience: 'admin' } : undefined);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'We could not complete that request right now.');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setOauthSubmittingProvider(provider);
    try {
      validateOAuthIntent();
      persistWeddingIntentIfNeeded();
      const pendingVendorClaim = readPendingVendorClaim();
      if (vendorClaimEntry && pendingVendorClaim?.token) {
        persistPendingVendorClaim(pendingVendorClaim.token, email || pendingVendorClaim.email);
      }

      if (adminEntry) {
        clearPendingProfessionalSetup();
        clearPendingWeddingSetup();
        persistPendingOAuthSignupState({
          mode: 'signin',
          audience: 'admin',
          role: null,
          plannerType: null,
          fullName: null,
        });
      } else if (audience === 'professional') {
        clearPendingProfessionalSetup();
        persistPendingOAuthSignupState({
          mode: isSignUp ? 'signup' : 'signin',
          audience: 'professional',
          role: isSignUp ? professionalSignupRole : null,
          plannerType: null,
          fullName: fullName.trim() || null,
        });
      } else if (audience === 'couple') {
        clearPendingProfessionalSetup();
        persistPendingOAuthSignupState({
          mode: isSignUp ? 'signup' : 'signin',
          audience: 'couple',
          role: 'couple',
          plannerType: null,
          fullName: isSignUp ? fullName.trim() || null : null,
        });
      } else {
        clearPendingOAuthSignupState();
      }

      const oauthOptions = adminEntry
        ? {
            audience: 'admin' as const,
            mode: 'signin' as const,
          }
        : audience
          ? {
              audience,
              mode: isSignUp ? 'signup' : 'signin',
              targetRole: audience === 'professional' ? (isSignUp ? professionalSignupRole : null) : 'couple',
              plannerType: null,
            }
          : {
              mode: 'signin' as const,
            };

      if (provider === 'google') {
        await signInWithGoogle(oauthOptions);
      } else {
        await signInWithApple(oauthOptions);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setOauthSubmittingProvider(null);
    }
  };

  const handleGoogleSignIn = async () => {
    await handleOAuthSignIn('google');
  };

  const handleAppleSignIn = async () => {
    await handleOAuthSignIn('apple');
  };

  return (
    <div className={`min-h-screen bg-gradient-warm ${isEstimatorCoupleEntry ? 'p-3' : 'p-4'}`}>
      <div className={`mx-auto flex max-w-2xl items-center justify-center ${isEstimatorCoupleEntry ? 'min-h-[calc(100vh-1.5rem)]' : 'min-h-[calc(100vh-2rem)]'}`}>
        <Card className="w-full shadow-warm border-border/50">
        <CardHeader className={isEstimatorCoupleEntry ? 'space-y-2 pb-3 text-center' : 'space-y-3 text-center'}>
          <div className="mx-auto">
            <BrandWordmark size="md" />
          </div>
          <CardTitle className="font-display text-xl">
            {isForgot
              ? 'Forgot Password'
              : isSignupSuccessStep
                ? signupSuccess.title
              : isSignUp && isSignupMethodStep
                ? 'Create your Zania account'
              : isSignUp && isSignupAccountStep
                ? isEstimatorCoupleEntry
                  ? 'Save your wedding plan'
                  : 'Tell us about you'
              : isSignUp && isSignupRoleStep
                ? 'Choose your path'
              : adminEntry
                ? 'Admin Sign In'
                : !isSignUp
                  ? 'Enter Zania'
                : vendorClaimEntry
                ? 'Create Your Vendor Account'
                : audience === 'professional'
                ? isSignUp
                  ? 'Create Your Professional Account'
                  : 'Welcome Back'
                : isSignUp
                  ? 'Start Your Wedding'
                  : 'Welcome Back'}
          </CardTitle>
          {!isEstimatorCoupleEntry ? <CardDescription>
            {isForgot
              ? 'Enter your email to receive a reset link.'
              : isSignupSuccessStep
                ? signupSuccess.description
              : isSignUp && isSignupMethodStep
                ? 'Start with one clear choice, then we will guide you the rest of the way.'
              : isSignUp && isSignupAccountStep
                ? isEstimatorCoupleEntry
                  ? 'Your couple workspace is selected. Continue with Google or create it with email.'
                  : 'Secure your account details first, then we will lock in the workspace that fits you.'
              : isSignUp && isSignupRoleStep
                ? 'Pick the account you want Zania to open for you so the setup stays tailored from the start.'
              : adminEntry
                ? 'Open the private Zania operations backend.'
                : !isSignUp
                  ? 'Use your Zania details and we will take you straight back into the right workspace.'
                : vendorClaimEntry
                ? 'Sign in with the invited email to claim this vendor listing, or create a vendor account first.'
                : audience === 'professional'
                ? isSignUp
                  ? signupStep === 'account'
                    ? 'Start with your details, then lock this account as planner or vendor.'
                    : 'Choose the professional workspace this account should open.'
                  : 'Use the email and password already tied to your Zania account.'
                : signupPath === 'join_wedding'
                    ? 'Use the wedding code from the couple and the same email that was invited.'
                    : isSignUp
                    ? signupStep === 'account'
                      ? 'Create your account now. You will choose the right path in the next step.'
                      : 'Choose whether this account starts a new wedding or joins one that already invited you.'
                    : 'Use the email and password already tied to your Zania account.'}
          </CardDescription> : null}
        </CardHeader>
        <CardContent className={isEstimatorCoupleEntry ? 'pb-4' : undefined}>
          {isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <FormSubmitError message={forgotSubmitError} />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setForgotErrors((current) => ({ ...current, email: undefined }));
                    setForgotSubmitError(null);
                  }}
                  placeholder="you@example.com"
                  required
                />
                <FormFieldError message={forgotErrors.email} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              {isSignupSuccessStep && signupSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-6"
                >
                  <div className="relative overflow-hidden rounded-[32px] border border-[#e3cfbb] bg-[linear-gradient(180deg,#fff9f2,#f4eadc)] p-6 text-left shadow-warm">
                    <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(212,187,125,0.28),transparent_70%)]" />
                    <div className="relative flex flex-col gap-5">
                      <div className="flex items-center gap-4">
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#d4bb7d]/40 bg-[#fffdf8] shadow-[0_10px_25px_rgba(194,114,79,0.12)]">
                          <motion.div
                            animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute inset-2 rounded-full border border-[#d4bb7d]/40"
                          />
                          <span className="font-display text-2xl text-[#a85c3c]">Z</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c2724f]">
                            {signupSuccess.accent}
                          </p>
                          <h3 className="marketing-h3 mt-2 text-[#201814]">
                            Welcome to a calmer way to plan.
                          </h3>
                        </div>
                      </div>
                      <p className="max-w-2xl text-sm leading-7 text-[#6f5747]">
                        Your Zania account is ready. Confirm your email first, then come back and we’ll open the right workspace with your planning, vendors, guests, and next steps waiting for you.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          className="h-11"
                          onClick={() => {
                            setPostSignupMessage(signupSuccess.description);
                            setSignupSuccess(null);
                            setSignupMethod('email');
                            setSignupStep('account');
                            setIsSignUp(false);
                            navigate('/sign-in', { replace: true });
                          }}
                        >
                          Open sign-in page
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          onClick={() => {
                            resetSignupWizard();
                            setIsSignUp(true);
                          }}
                        >
                          Create another account
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {postSignupMessage && !isSignUp && (
                <div className="semantic-surface-success mb-5 rounded-2xl border px-4 py-3 text-left">
                  <p className="text-sm font-medium text-success">Check your email, then sign in</p>
                  <p className="mt-1 text-sm text-foreground/75">{postSignupMessage}</p>
                </div>
              )}

              {!isSignupSuccessStep && authErrorMessage && (
                <div className="semantic-surface-danger mb-5 rounded-2xl border px-4 py-3 text-left">
                  <p className="text-sm font-medium text-destructive">That account does not exist yet</p>
                  <p className="mt-1 text-sm text-foreground/75">{authErrorMessage}</p>
                </div>
              )}

              {!isSignupSuccessStep && (
                <>
              {!isSignUp && (
                <div className="semantic-surface-info mb-5 rounded-2xl border px-4 py-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full border border-[hsl(var(--info-soft-border))] bg-[hsl(var(--info-soft))] p-2 text-info">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {adminEntry ? 'Admin backend' : 'Welcome back'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {adminEntry
                          ? 'Sign in with your admin account to open the backend portal.'
                          : 'Sign in once and Zania will open the right workspace automatically.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isSignUp && (
                <>
                  {!isEstimatorCoupleEntry ? <div className="mb-5 rounded-[28px] border border-[#ead9c8] bg-[linear-gradient(180deg,#fffaf4,#f8efe6)] px-5 py-4 text-left shadow-[0_16px_45px_rgba(194,114,79,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c2724f]">
                          Guided signup
                        </p>
                        <p className="mt-1 text-sm font-medium text-[#2c211c]">
                          Step {signupProgressStep} of 4
                        </p>
                      </div>
                      <p className="text-xs text-[#7c6353]">
                        {isEstimatorCoupleEntry
                          ? 'Create your couple account'
                          : isSignupMethodStep
                          ? 'How do you want to start?'
                          : isSignupAccountStep
                            ? 'Secure your account'
                            : isSignupRoleStep
                              ? 'Choose your workspace'
                              : 'Almost done'}
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-2 rounded-full ${
                            step <= signupProgressStep ? 'bg-[#c2724f]' : 'bg-[#ead9c8]'
                          }`}
                        />
                      ))}
                    </div>
                  </div> : null}

                  {!isEstimatorCoupleEntry && !isSignupMethodStep && (
                    <motion.div
                      initial={hasHomepageCarryover ? { opacity: 0, y: 18, scale: 0.985 } : false}
                      animate={hasHomepageCarryover ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {signupMethod === 'email'
                            ? 'Email signup selected'
                            : signupMethod === 'google'
                              ? 'Google signup selected'
                              : signupMethod === 'apple'
                                ? 'Apple signup selected'
                                : 'Choose your account type'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {audience === 'couple' && signupPath === 'join_wedding'
                            ? 'Use the wedding code the couple shared with you.'
                            : audience === 'couple'
                              ? 'This will open a shared couple workspace.'
                              : audience === 'professional'
                                ? professionalSignupRole === 'vendor'
                                  ? 'This will open your vendor portfolio and bookings workspace.'
                                  : professionalSignupRole === 'planner'
                                    ? 'This will open your planner operations workspace.'
                                    : 'Choose whether you are joining as planner or vendor.'
                                : signupMethod === 'email'
                                  ? 'You can finish this with your email details.'
                                  : 'You will continue securely with your selected provider in the final step.'}
                        </p>
                      </div>
                      {audience === 'couple' && isSignupRoleStep && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPostSignupMessage(null);
                            setSignupPath(signupPath === 'join_wedding' ? 'create_wedding' : 'join_wedding');
                          }}
                        >
                          {signupPath === 'join_wedding' ? 'Start a wedding instead' : 'I have a wedding code'}
                        </Button>
                      )}
                    </motion.div>
                  )}
                </>
              )}

              {isSignUp && hasChosenAudiencePath && !isEstimatorCoupleEntry && (
                <div className="semantic-surface-success mb-5 rounded-2xl border px-4 py-3">
                  <p className="text-sm font-medium text-foreground">14-day full-access beta trial</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    New accounts start with two weeks of premium access, so you can test the full experience before any upgrade is required.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className={isEstimatorCoupleEntry ? 'space-y-3' : 'space-y-4'}>
                {isSignUp ? (
                  isSignupMethodStep ? (
                    <>
                      <div className="semantic-surface-info rounded-2xl border px-4 py-3">
                        <p className="text-sm font-medium text-foreground">Step 1 of 4</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Choose how you want to begin. We will only show the next choice after this one.
                        </p>
                      </div>
                      <div className="grid gap-3">
                        <GoogleAuthButton
                          loading={oauthSubmittingProvider === 'google'}
                          disabled={submitting || oauthSubmitting}
                          onClick={() => chooseSignupMethod('google')}
                          text="Start with Google"
                        />
                        {appleAuthEnabled ? (
                          <AppleAuthButton
                            loading={oauthSubmittingProvider === 'apple'}
                            disabled={submitting || oauthSubmitting}
                            onClick={() => chooseSignupMethod('apple')}
                            text="Start with Apple"
                          />
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => chooseSignupMethod('email')}
                        >
                          Start with email
                        </Button>
                      </div>
                    </>
                  ) : isSignupAccountStep ? (
                    <>
                      {isEstimatorCoupleEntry ? (
                        <div className="semantic-surface-success flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border px-4 py-2.5 text-left">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Couple account selected</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Your estimate will be saved after signup.</p>
                          </div>
                          <span className="text-xs font-semibold text-success">14-day full access</span>
                        </div>
                      ) : <div className="semantic-surface-info rounded-2xl border px-4 py-3">
                        <p className="text-sm font-medium text-foreground">Step 2 of 4</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {hasLockedSignupTrack
                            ? selectedAudience === 'professional'
                              ? 'Add your details and we will finish creating your vendor account.'
                              : isEstimatorCoupleEntry
                                ? 'Your estimate is ready. Create your private couple account to keep it.'
                                : 'Add your details and wedding code so we can join you to the right wedding.'
                            : 'Add your details here, then we will move to the workspace choice.'}
                        </p>
                      </div>}
                      <FormSubmitError message={submitError} />
                      {isEstimatorCoupleEntry ? (
                        <div className="space-y-3">
                          <SignupTermsNotice
                            acceptedTerms={acceptedTerms}
                            onAcceptedTermsChange={(checked) => {
                              setAcceptedTerms(checked);
                              setFormErrors((current) => ({ ...current, acceptedTerms: undefined }));
                            }}
                            error={formErrors.acceptedTerms}
                            compact
                          />
                          <GoogleAuthButton
                            loading={oauthSubmittingProvider === 'google'}
                            disabled={submitting || oauthSubmitting || !acceptedTerms}
                            onClick={handleGoogleSignIn}
                            text="Continue with Google"
                          />
                          <div className="relative py-1">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-border/60" />
                            </div>
                            <div className="relative flex justify-center">
                              <span className="bg-card px-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                Or use email
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {hasLockedSignupTrack && !isEstimatorCoupleEntry ? (
                        <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-left">
                          <p className="text-sm font-medium text-foreground">
                            {selectedAudience === 'professional'
                              ? professionalSignupRole === 'planner'
                                ? 'Planner workspace selected'
                                : 'Vendor workspace selected'
                              : isEstimatorCoupleEntry
                                ? 'Couple workspace selected'
                                : 'Wedding join path selected'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedAudience === 'professional'
                              ? professionalSignupRole === 'planner'
                                ? 'This account will open your planner operations workspace right after setup.'
                                : 'This account will open your vendor portfolio, bookings, and listing workspace.'
                              : isEstimatorCoupleEntry
                                ? 'Your estimate will be saved into this private wedding workspace after signup.'
                                : 'Use the same invited email and the wedding code the couple shared with you.'}
                          </p>
                        </div>
                      ) : null}
                      <div className={isEstimatorCoupleEntry ? 'grid gap-3 sm:grid-cols-2' : 'contents'}>
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={fullName}
                          onChange={(event) => {
                            setFullName(normalizeHumanNameInput(event.target.value));
                            setFormErrors((current) => ({ ...current, fullName: undefined }));
                            setSubmitError(null);
                          }}
                          onBlur={normalizeFullNameField}
                          placeholder="Your full name"
                          required
                        />
                        <FormFieldError message={formErrors.fullName} />
                      </div>

                      {!isEstimatorCoupleEntry ? <div className="space-y-2">
                        <Label htmlFor="account-purpose">What best describes how you will use Zania?</Label>
                        <Select value={accountPurpose} onValueChange={(value: AccountPurpose) => setAccountPurpose(value)}>
                          <SelectTrigger id="account-purpose">
                            <SelectValue placeholder="Choose how you will use Zania" />
                          </SelectTrigger>
                          <SelectContent>
                            {accountPurposeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          We use this to guide you into the right workspace and upgrade path. You can change it later in Settings.
                        </p>
                      </div> : null}

                      <div className="space-y-2">
                        <Label htmlFor="email">Your email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setFormErrors((current) => ({ ...current, email: undefined }));
                            setSubmitError(null);
                          }}
                          placeholder="you@example.com"
                          required
                        />
                        <FormFieldError message={formErrors.email} />
                      </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          key={showPassword ? 'signup-password-visible' : 'signup-password-hidden'}
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setFormErrors((current) => ({ ...current, password: undefined }));
                            setSubmitError(null);
                            if (generatedPassword && event.target.value !== generatedPassword) {
                              setGeneratedPassword(null);
                            }
                          }}
                          placeholder="••••••••"
                          required
                          minLength={6}
                        />
                        <FormFieldError message={formErrors.password} />
                        {isEstimatorCoupleEntry ? (
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">Use at least 6 characters.</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setShowPassword((current) => !current)}
                              aria-controls="password"
                              aria-pressed={showPassword}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {showPassword ? 'Hide' : 'Show'}
                            </Button>
                          </div>
                        ) : <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={createGeneratedPassword}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Generate secure password
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setShowPassword((current) => !current)}
                              aria-controls="password"
                              aria-pressed={showPassword}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {showPassword ? 'Hide' : 'Show'}
                            </Button>
                            {password && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => void copyGeneratedPassword()}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {generatedPassword
                              ? 'Generated for you. Save it somewhere safe before continuing.'
                              : 'Use at least 6 characters, or generate one instantly.'}
                          </p>
                        </div>}
                      </div>

                      {selectedAudience === 'couple' && signupPath === 'join_wedding' ? (
                        <div className="space-y-2">
                          <Label htmlFor="wedding-code">Wedding Code</Label>
                          <Input
                            id="wedding-code"
                            value={weddingCode}
                            onChange={(event) => {
                              setWeddingCode(normalizeJoinCode(event.target.value));
                              setFormErrors((current) => ({ ...current, weddingCode: undefined }));
                              setSubmitError(null);
                            }}
                            placeholder="e.g. ZN-3RM94X"
                            required
                          />
                          <FormFieldError message={formErrors.weddingCode} />
                        </div>
                      ) : null}

                      {!isEstimatorCoupleEntry ? (
                        <SignupTermsNotice
                          acceptedTerms={acceptedTerms}
                          onAcceptedTermsChange={(checked) => {
                            setAcceptedTerms(checked);
                            setFormErrors((current) => ({ ...current, acceptedTerms: undefined }));
                          }}
                          error={formErrors.acceptedTerms}
                        />
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => isEstimatorCoupleEntry ? navigate('/') : resetSignupWizard()}
                        >
                          Back
                        </Button>
                        {hasLockedSignupTrack ? (
                          <Button type="submit" className="w-full" disabled={submitting || oauthSubmitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {signupPath === 'join_wedding'
                              ? 'Create account and join'
                              : selectedAudience === 'couple'
                                ? 'Create couple account'
                              : professionalSignupRole === 'planner'
                                ? 'Create planner account'
                                : 'Create vendor account'}
                          </Button>
                        ) : (
                          <Button type="button" className="w-full" onClick={continueToRoleStep}>
                            Continue
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                        <p className="text-sm font-medium text-foreground">Step 3 of 4</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Lock the workspace you want so Zania sets up the right journey from day one.
                        </p>
                      </div>
                      <FormSubmitError message={submitError} />
                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => chooseSignupRole('couple')}
                          className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                            selectedAudience === 'couple'
                              ? 'border-primary bg-primary/6 shadow-card'
                              : 'border-border/60 bg-muted/20 hover:border-primary/40'
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground">Couple account</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Shared wedding planning, budgets, guests, registry, approvals, and timeline coordination.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => chooseSignupRole('planner')}
                          className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                            professionalSignupRole === 'planner'
                              ? 'border-primary bg-primary/6 shadow-card'
                              : 'border-border/60 bg-muted/20 hover:border-primary/40'
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground">Planner account</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Client workspaces, approvals, planning operations, and professional coordination tools.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => chooseSignupRole('vendor')}
                          className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                            professionalSignupRole === 'vendor'
                              ? 'border-primary bg-primary/6 shadow-card'
                              : 'border-border/60 bg-muted/20 hover:border-primary/40'
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground">Vendor account</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Portfolio, listing, leads, pricing, and booking management for your wedding business.
                          </p>
                        </button>
                      </div>

                      {selectedAudience === 'couple' && (
                        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={signupPath === 'create_wedding' ? 'default' : 'outline'}
                              onClick={() => setSignupPath('create_wedding')}
                            >
                              Start a new wedding
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={signupPath === 'join_wedding' ? 'default' : 'outline'}
                              onClick={() => setSignupPath('join_wedding')}
                            >
                              I have a wedding code
                            </Button>
                          </div>
                          {showJoinDetails && (
                            <div className="space-y-2">
                              <Label htmlFor="wedding-code">Wedding Code</Label>
                              <Input
                                id="wedding-code"
                                value={weddingCode}
                                onChange={(event) => {
                                  setWeddingCode(normalizeJoinCode(event.target.value));
                                  setFormErrors((current) => ({ ...current, weddingCode: undefined }));
                                  setSubmitError(null);
                                }}
                                placeholder="e.g. ZN-3RM94X"
                                required
                              />
                              <FormFieldError message={formErrors.weddingCode} />
                            </div>
                          )}
                        </div>
                      )}

                      <SignupTermsNotice
                        acceptedTerms={acceptedTerms}
                        onAcceptedTermsChange={(checked) => {
                          setAcceptedTerms(checked);
                          setFormErrors((current) => ({ ...current, acceptedTerms: undefined }));
                          setSubmitError(null);
                        }}
                        error={formErrors.acceptedTerms}
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => setSignupStep(signupMethod === 'email' ? 'account' : 'method')}
                        >
                          Back
                        </Button>
                        {signupMethod === 'email' ? (
                          <Button type="submit" className="w-full" disabled={submitting || oauthSubmitting || !hasChosenPath}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {signupPath === 'create_wedding'
                              ? 'Create couple account'
                              : signupPath === 'join_wedding'
                                ? 'Create account and join'
                                : professionalSignupRole === 'planner'
                                  ? 'Create planner account'
                                  : 'Create vendor account'}
                          </Button>
                        ) : signupMethod === 'google' ? (
                          <GoogleAuthButton
                            loading={oauthSubmittingProvider === 'google'}
                            disabled={submitting || oauthSubmitting || !hasChosenPath}
                            onClick={handleGoogleSignIn}
                            text="Continue with Google"
                          />
                        ) : appleAuthEnabled ? (
                          <AppleAuthButton
                            loading={oauthSubmittingProvider === 'apple'}
                            disabled={submitting || oauthSubmitting || !hasChosenPath}
                            onClick={handleAppleSignIn}
                            text="Continue with Apple"
                          />
                        ) : null}
                        
                      </div>
                    </>
                  )
                ) : (
                  <>
                    {!adminEntry ? (
                      <div className="space-y-3">
                        <GoogleAuthButton
                          loading={oauthSubmittingProvider === 'google' && !submitting}
                          disabled={submitting || oauthSubmitting}
                          onClick={handleGoogleSignIn}
                          text="Continue with Google"
                        />
                        {appleAuthEnabled ? (
                          <AppleAuthButton
                            loading={oauthSubmittingProvider === 'apple' && !submitting}
                            disabled={submitting || oauthSubmitting}
                            onClick={handleAppleSignIn}
                            text="Continue with Apple"
                          />
                        ) : null}
                        <div className="relative py-1">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/60" />
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-card px-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              Or use email
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <FormSubmitError message={submitError} />
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setFormErrors((current) => ({ ...current, email: undefined }));
                          setSubmitError(null);
                        }}
                        placeholder="you@example.com"
                        required
                      />
                      <FormFieldError message={formErrors.email} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button
                          type="button"
                          onClick={() => setIsForgot(true)}
                          className="text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        key={showPassword ? 'signin-password-visible' : 'signin-password-hidden'}
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setFormErrors((current) => ({ ...current, password: undefined }));
                          setSubmitError(null);
                        }}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <FormFieldError message={formErrors.password} />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword((current) => !current)}
                          aria-controls="password"
                          aria-pressed={showPassword}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showPassword ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting || oauthSubmitting || !hasChosenPath}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {adminEntry ? 'Sign in to admin' : 'Sign in'}
                    </Button>
                  </>
                )}
              </form>

              {!isSignUp && !adminEntry ? (
                <div className="mt-5 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-left">
                  <p className="text-sm font-medium text-foreground">One sign-in. The right workspace.</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    Couple, planner, and vendor accounts now open automatically from the email already attached to them.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 text-center">
                {!isSignUp ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPostSignupMessage(null);
                      resetSignupWizard();
                      setIsForgot(false);
                      setIsSignUp(true);
                      navigate('/auth?mode=signup', { replace: true });
                    }}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    Need an account? Start signup
                  </button>
                ) : null}
              </div>
                </>
              )}
            </>
          )}
        </CardContent>
        </Card>
      </div>
      <div className="mx-auto mt-6 max-w-2xl">
        <PublicSiteFooter className="rounded-[2rem] border-border/60 bg-white/45 backdrop-blur-sm" />
      </div>
    </div>
  );
}
