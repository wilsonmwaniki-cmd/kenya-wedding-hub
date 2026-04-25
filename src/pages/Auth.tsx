import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Heart, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getHomeRouteForRole, type SignupRole } from '@/lib/roles';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { hasPendingEstimatorPlanDraft, seedPendingEstimatorPlanForUser } from '@/lib/estimatorPlanSeed';
import KenyaLocationFields from '@/components/KenyaLocationFields';
import {
  clearPendingOAuthSignupState,
  persistPendingOAuthSignupState,
} from '@/lib/oauthSignupState';
import {
  clearPendingWeddingSetup,
  completePendingWeddingSetup,
  getPendingWeddingSetup,
  persistPendingWeddingSetup,
  type PendingWeddingSetup,
  type WeddingOwnerRole,
  type WeddingSignupIntent,
} from '@/lib/weddingWorkspace';

type AuthEntryState = {
  mode?: 'signup' | 'signin';
  role?: SignupRole;
  signupPath?: WeddingSignupIntent;
  professionalRole?: ProfessionalSignupRole;
} | null;
type ProfessionalSignupRole = 'planner' | 'vendor';

const professionalRoleMeta: Record<
  ProfessionalSignupRole,
  { title: string; description: string }
> = {
  planner: {
    title: 'Planner',
    description: 'Manage clients, planning workspaces, payments, and delivery timelines.',
  },
  vendor: {
    title: 'Vendor',
    description: 'List your business, manage bookings, and stay close to couples in your market.',
  },
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

function getFallbackRouteFromUserMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
) {
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

export default function Auth() {
  const location = useLocation();
  const entryState = location.state as AuthEntryState;
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [signupPath, setSignupPath] = useState<WeddingSignupIntent>('create_wedding');
  const [professionalRole, setProfessionalRole] = useState<ProfessionalSignupRole>('planner');
  const [weddingOwnerRole, setWeddingOwnerRole] = useState<WeddingOwnerRole>('bride');
  const [weddingName, setWeddingName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [weddingCode, setWeddingCode] = useState('');
  const [weddingCounty, setWeddingCounty] = useState('');
  const [weddingTown, setWeddingTown] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [primaryCounty, setPrimaryCounty] = useState('');
  const [primaryTown, setPrimaryTown] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [postSignupMessage, setPostSignupMessage] = useState<string | null>(null);
  const { signIn, signUp, signInWithGoogle, user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const hasHomepageCarryover = Boolean(entryState?.role);
  const activePendingSetup = useMemo(
    () => (user ? getPendingWeddingSetup(user.user_metadata, user.email ?? null) : null),
    [user],
  );
  const audience = signupPath === 'professional' ? 'professional' : 'couple';
  const showWeddingDetails = isSignUp && signupPath === 'create_wedding';
  const showJoinDetails = isSignUp && signupPath === 'join_wedding';
  const showProfessionalDetails = isSignUp && signupPath === 'professional';
  const showGoogleAuth = !isForgot;
  const showTopGoogleAuth = showGoogleAuth && (!isSignUp || audience === 'professional');
  const showCoupleSignupGoogleAuth = showGoogleAuth && isSignUp && audience === 'couple';

  useEffect(() => {
    const state = location.state as AuthEntryState;
    if (!state) return;

    if (state.mode) {
      setIsSignUp(state.mode === 'signup');
      setIsForgot(false);
      setPostSignupMessage(null);
    }

    if (state.signupPath) {
      setSignupPath(state.signupPath);
      if (state.professionalRole) {
        setProfessionalRole(state.professionalRole);
      }
      return;
    }

    if (state.role) {
      const mapped = mapEntryRoleToSignupPath(state.role);
      setSignupPath(mapped.signupPath);
      setProfessionalRole(mapped.professionalRole);
    }
  }, [location.state]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const flow = params.get('flow');
    const code = params.get('code');
    const invitedEmail = params.get('email');

    if (flow === 'join_wedding') {
      setSignupPath('join_wedding');
      setIsSignUp(true);
      setIsForgot(false);
      setPostSignupMessage(null);
    }

    if (code) {
      setWeddingCode(normalizeJoinCode(code));
    }

    if (invitedEmail) {
      setEmail(invitedEmail.trim().toLowerCase());
    }
  }, [location.search]);

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
        if (pendingSetup) {
          if (!active) return;
          navigate('/dashboard', { replace: true });
          return;
        }

        if (!profile?.role) {
          if (active) {
            navigate(getFallbackRouteFromUserMetadata(user.user_metadata), { replace: true });
          }
          return;
        }

        if (hasPendingEstimatorPlanDraft()) {
          const seeded = await seedPendingEstimatorPlanForUser({
            userId: user.id,
            role: profile.role,
            plannerType: profile.planner_type,
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

  if (loading || redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getSuggestedWeddingName = () => {
    const firstName = fullName.trim().split(/\s+/)[0];
    return firstName ? `${firstName}'s Wedding` : 'Our Wedding';
  };

  const persistWeddingIntentIfNeeded = () => {
    const coupleWeddingName = weddingName.trim() || getSuggestedWeddingName();

    if (signupPath === 'professional') {
      clearPendingWeddingSetup();
      return;
    }

    const payload: PendingWeddingSetup = {
      intent: signupPath,
      email,
      weddingOwnerRole: signupPath === 'create_wedding' ? weddingOwnerRole : null,
      partnerEmail: signupPath === 'create_wedding' ? partnerEmail : null,
      weddingName: signupPath === 'create_wedding' ? coupleWeddingName : null,
      weddingCode: signupPath === 'join_wedding' ? normalizeJoinCode(weddingCode) : null,
      weddingCounty: signupPath === 'create_wedding' ? weddingCounty : null,
      weddingTown: signupPath === 'create_wedding' ? weddingTown : null,
      weddingDate: signupPath === 'create_wedding' ? weddingDate : null,
    };

    persistPendingWeddingSetup(payload);
  };

  const validateGoogleSignupIntent = () => {
    if (!isSignUp) return;

    if (signupPath === 'create_wedding') {
      if (!partnerEmail.trim()) {
        throw new Error('Add your partner’s email before continuing.');
      }

      if (!weddingOwnerRole) {
        throw new Error('Choose whether the bride or groom is creating this wedding first.');
      }

      if (!weddingDate.trim()) {
        throw new Error('Add the wedding date before continuing.');
      }
    }

    if (signupPath === 'join_wedding' && !normalizeJoinCode(weddingCode)) {
      throw new Error('Enter the wedding code from the invitation before continuing with Google.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Reset link sent!', description: 'Check your email for the password reset link.' });
      setIsForgot(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (signupPath === 'create_wedding') {
          if (!partnerEmail.trim()) {
            throw new Error('Add your partner’s email to create the wedding properly.');
          }

          if (!weddingDate.trim()) {
            throw new Error('Add your wedding date before you continue.');
          }

          const resolvedWeddingName = weddingName.trim() || getSuggestedWeddingName();
          persistWeddingIntentIfNeeded();
          await signUp(email, password, fullName, 'couple', {
            signupIntent: 'create_wedding',
            weddingOwnerRole,
            partnerEmail,
            weddingName: resolvedWeddingName,
            weddingCounty,
            weddingTown,
            weddingDate,
          });
          toast({
            title: 'Account created!',
            description: partnerEmail.trim()
              ? 'Check your email to confirm your account. Once you finish, we will create the wedding and queue your partner invite.'
              : 'Check your email to confirm your account, then we will create your wedding workspace.',
          });
          setIsSignUp(false);
          setIsForgot(false);
          setPassword('');
          setPostSignupMessage(
            'Account created. Check your email to confirm it, then sign in to continue setting up your wedding.',
          );
        } else if (signupPath === 'join_wedding') {
          if (!normalizeJoinCode(weddingCode)) {
            throw new Error('Enter the wedding code from your invitation email.');
          }

          persistWeddingIntentIfNeeded();
          await signUp(email, password, fullName, 'couple', {
            signupIntent: 'join_wedding',
            weddingCode: normalizeJoinCode(weddingCode),
          });
          toast({
            title: 'Account created!',
            description: 'Check your email to confirm your account. After confirmation, we will join you to the wedding that sent the code.',
          });
          setIsSignUp(false);
          setIsForgot(false);
          setPassword('');
          setPostSignupMessage(
            'Account created. Check your email to confirm it, then sign in with the same email to join the wedding.',
          );
        } else {
          clearPendingWeddingSetup();
          await signUp(email, password, fullName, professionalRole, {
            signupIntent: 'professional',
            primaryCounty: primaryCounty || null,
            primaryTown: primaryTown || null,
          });
          toast({ title: 'Account created!', description: 'Check your email to confirm your account.' });
          setIsSignUp(false);
          setIsForgot(false);
          setPassword('');
          setPostSignupMessage(
            `Account created. Check your email to confirm it, then sign in to open your ${professionalRole} workspace.`,
          );
        }
      } else {
        persistWeddingIntentIfNeeded();
        await signIn(email, password);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    try {
      validateGoogleSignupIntent();
      persistWeddingIntentIfNeeded();

      if (isSignUp && signupPath === 'professional') {
        persistPendingOAuthSignupState({
          role: professionalRole,
          plannerType: professionalRole === 'planner' ? 'professional' : null,
          fullName: fullName.trim() || null,
        });
      } else {
        clearPendingOAuthSignupState();
      }

      await signInWithGoogle(
        isSignUp && signupPath === 'professional'
          ? {
              signupRole: professionalRole,
              plannerType: professionalRole === 'planner' ? 'professional' : null,
            }
          : undefined,
      );
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setGoogleSubmitting(false);
    }
  };

  const switchAudience = (nextAudience: 'couple' | 'professional') => {
    setPostSignupMessage(null);
    if (nextAudience === 'couple') {
      setSignupPath('create_wedding');
      return;
    }

    setSignupPath('professional');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-2xl shadow-warm border-border/50">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex items-center gap-2">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-bold text-foreground">Zania</span>
          </div>
          <CardTitle className="font-display text-xl">
            {isForgot
              ? 'Forgot Password'
              : audience === 'professional'
                ? isSignUp
                  ? 'Professional Account'
                  : 'Professional Sign In'
                : isSignUp
                  ? 'Start Your Wedding'
                  : 'Couple Sign In'}
          </CardTitle>
          <CardDescription>
            {isForgot
              ? 'Enter your email to receive a reset link.'
              : audience === 'professional'
                ? isSignUp
                  ? 'Create your planner or vendor account.'
                  : 'Sign in to your planner or vendor workspace.'
                : signupPath === 'join_wedding'
                  ? 'Use the wedding code from the couple and the same email that was invited.'
                  : isSignUp
                    ? 'Add your spouse and wedding date. We’ll create the wedding for both of you.'
                    : 'Sign in to your wedding workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
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
              {postSignupMessage && !isSignUp && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
                  <p className="text-sm font-medium text-emerald-900">Check your email, then sign in</p>
                  <p className="mt-1 text-sm text-emerald-800">{postSignupMessage}</p>
                </div>
              )}

              <div className="mb-5 rounded-2xl border border-border/60 bg-muted/20 p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => switchAudience('couple')}
                    className={`rounded-xl px-4 py-3 text-left transition-all ${
                      audience === 'couple'
                        ? 'border border-primary bg-primary text-primary-foreground shadow-card'
                        : 'border border-transparent bg-background/70 text-muted-foreground hover:border-border hover:bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <p className="text-sm font-medium">Couples</p>
                    </div>
                    <p className={`mt-1 text-xs ${audience === 'couple' ? 'text-primary-foreground/90' : ''}`}>
                      {isSignUp ? 'Create or join your wedding' : 'Sign in to your wedding'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchAudience('professional')}
                    className={`rounded-xl px-4 py-3 text-left transition-all ${
                      audience === 'professional'
                        ? 'border border-primary bg-primary text-primary-foreground shadow-card'
                        : 'border border-transparent bg-background/70 text-muted-foreground hover:border-border hover:bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      <p className="text-sm font-medium">Wedding professionals</p>
                    </div>
                    <p className={`mt-1 text-xs ${audience === 'professional' ? 'text-primary-foreground/90' : ''}`}>
                      {isSignUp ? 'Create your planner or vendor account' : 'Sign in as planner or vendor'}
                    </p>
                  </button>
                </div>
              </div>

              {isSignUp && (
                <motion.div
                  initial={hasHomepageCarryover ? { opacity: 0, y: 18, scale: 0.985 } : false}
                  animate={hasHomepageCarryover ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {audience === 'couple' && signupPath === 'join_wedding'
                        ? 'Join a wedding'
                        : audience === 'couple'
                          ? 'Start your wedding'
                          : 'Professional account'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {audience === 'couple' && signupPath === 'join_wedding'
                        ? 'Use the code the couple sent you.'
                        : audience === 'couple'
                          ? 'We’ll guide you through this in one quick pass.'
                          : 'Choose planner or vendor, then create your login.'}
                    </p>
                  </div>
                  {audience === 'couple' && (
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

              {showTopGoogleAuth && (
                <div className="space-y-4">
                  <GoogleAuthButton
                    loading={googleSubmitting}
                    disabled={submitting || googleSubmitting}
                    onClick={handleGoogleSignIn}
                  />
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or use email</span>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                )}

                {showWeddingDetails && (
                  <>
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Step 1: Tell us who is starting the wedding</p>
                        <p className="text-xs text-muted-foreground">
                          Pick bride or groom and we’ll add your spouse as the second owner.
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(['bride', 'groom'] as WeddingOwnerRole[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setWeddingOwnerRole(value)}
                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                              weddingOwnerRole === value
                                ? 'border-primary bg-primary/5 text-foreground'
                                : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            <p className="font-medium capitalize">{value}</p>
                            <p className="mt-1 text-xs">
                              {value === 'bride'
                                ? 'We’ll invite the groom as the second owner.'
                                : 'We’ll invite the bride as the second owner.'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="partner-email">Step 2: Your spouse’s email</Label>
                        <Input
                          id="partner-email"
                          type="email"
                          value={partnerEmail}
                          onChange={(event) => setPartnerEmail(event.target.value)}
                          placeholder={weddingOwnerRole === 'bride' ? 'groom@example.com' : 'bride@example.com'}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Use the email they will sign in with. We’ll send the invite there automatically.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="wedding-date">Wedding date</Label>
                        <Input
                          id="wedding-date"
                          type="date"
                          value={weddingDate}
                          onChange={(event) => setWeddingDate(event.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {showJoinDetails && (
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Step 1: Enter your wedding code</p>
                      <p className="text-xs text-muted-foreground">
                        Use the same email address that received the invite.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wedding-code">Wedding Code</Label>
                      <Input
                        id="wedding-code"
                        value={weddingCode}
                        onChange={(event) => setWeddingCode(normalizeJoinCode(event.target.value))}
                        placeholder="e.g. ZN-3RM94X"
                        required
                      />
                    </div>
                  </div>
                )}

                {showCoupleSignupGoogleAuth && (
                  <div className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Step 3: Create your account</p>
                      <p className="text-xs text-muted-foreground">
                        Use Google if you want the fastest path, or continue with email below.
                      </p>
                    </div>
                    <GoogleAuthButton
                      loading={googleSubmitting}
                      disabled={submitting || googleSubmitting}
                      onClick={handleGoogleSignIn}
                    />
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">or use email below</span>
                      </div>
                    </div>
                  </div>
                )}

                {showProfessionalDetails && (
                  <>
                    {isSignUp && (
                      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">What kind of account are you creating?</p>
                          <p className="text-xs text-muted-foreground">
                            Planner and vendor accounts stay professional accounts. They can later be attached to wedding workspaces through invites and connections.
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(Object.entries(professionalRoleMeta) as Array<[ProfessionalSignupRole, (typeof professionalRoleMeta)[ProfessionalSignupRole]]>).map(([value, meta]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setProfessionalRole(value)}
                              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                                professionalRole === value
                                  ? 'border-primary bg-primary/5 text-foreground'
                                  : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                              }`}
                            >
                              <p className="font-medium">{meta.title}</p>
                              <p className="mt-1 text-xs">{meta.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isSignUp && (
                      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Where is your business based?</p>
                          <p className="text-xs text-muted-foreground">
                            Couples will use this to find professionals near their wedding location.
                          </p>
                        </div>
                        <KenyaLocationFields
                          county={primaryCounty}
                          town={primaryTown}
                          onCountyChange={setPrimaryCounty}
                          onTownChange={setPrimaryTown}
                          countyLabel="Business county"
                          townLabel="Town / area"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">
                    {isSignUp ? 'Step 3: Your email' : 'Email'}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => setIsForgot(true)}
                        className="text-xs text-muted-foreground transition-colors hover:text-primary"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting || googleSubmitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSignUp
                    ? signupPath === 'create_wedding'
                      ? 'Create wedding account'
                      : signupPath === 'join_wedding'
                        ? 'Create account and join'
                        : professionalRole === 'planner'
                          ? 'Create planner account'
                          : 'Create vendor account'
                    : audience === 'professional'
                      ? 'Sign in to professional account'
                      : 'Sign in to wedding'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setPostSignupMessage(null);
                    setIsSignUp((current) => !current);
                  }}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {isSignUp
                    ? audience === 'professional'
                      ? 'Already have a professional account? Sign in'
                      : 'Already have a wedding account? Sign in'
                    : audience === 'professional'
                      ? "Need a professional account? Sign up"
                      : "Need a wedding account? Sign up"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
