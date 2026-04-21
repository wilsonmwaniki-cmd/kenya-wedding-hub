import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Loader2, Mail, Users, UserRoundPlus } from 'lucide-react';
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
  clearPendingWeddingSetup,
  completePendingWeddingSetup,
  getPendingWeddingSetup,
  persistPendingWeddingSetup,
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

const signupTrackMeta: Record<
  WeddingSignupIntent,
  {
    title: string;
    description: string;
    icon: typeof UserRoundPlus;
  }
> = {
  create_wedding: {
    title: 'Create a wedding',
    description: 'Start a new wedding workspace as the bride or groom and invite your partner in.',
    icon: Heart,
  },
  join_wedding: {
    title: 'Join a wedding',
    description: 'Use the wedding code from an invite email to join an existing wedding workspace.',
    icon: Users,
  },
  professional: {
    title: 'Professional account',
    description: 'Create a planner or vendor account without creating a wedding workspace.',
    icon: Mail,
  },
};

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

export default function Auth() {
  const location = useLocation();
  const entryState = location.state as AuthEntryState;
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [signupPath, setSignupPath] = useState<WeddingSignupIntent>('professional');
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
  const { signIn, signUp, signInWithGoogle, user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const hasHomepageCarryover = Boolean(entryState?.role);
  const activePendingSetup = useMemo(
    () => (user ? getPendingWeddingSetup(user.user_metadata, user.email ?? null) : null),
    [user],
  );
  const showTrackChooser = isSignUp;
  const showWeddingDetails = isSignUp && signupPath === 'create_wedding';
  const showJoinDetails = isSignUp && signupPath === 'join_wedding';
  const showProfessionalDetails = isSignUp && signupPath === 'professional';
  const showGoogleAuth = !isForgot;

  const carryoverLabel = useMemo(() => {
    if (signupPath === 'create_wedding') return 'Create a wedding';
    if (signupPath === 'join_wedding') return 'Join a wedding';
    return professionalRoleMeta[professionalRole].title;
  }, [professionalRole, signupPath]);

  useEffect(() => {
    const state = location.state as AuthEntryState;
    if (!state) return;

    if (state.mode) {
      setIsSignUp(state.mode === 'signup');
      setIsForgot(false);
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
    if (!pendingSetup && !profile?.role) return;

    let active = true;

    const finalizeEntry = async () => {
      setRedirecting(true);

      try {
        if (pendingSetup) {
          const completion = await completePendingWeddingSetup(user);
          if (!active) return;

          if (completion.action === 'created') {
            toast({
              title: 'Wedding created',
              description: completion.partnerInviteSent
                ? 'Your wedding workspace is ready and the partner invite email has been sent.'
                : completion.partnerInviteQueued
                  ? 'Your wedding workspace is ready. The partner invite is stored and can be resent from the dashboard.'
                  : 'Your wedding workspace is ready. You can invite your partner from the dashboard anytime.',
            });
          }

          if (completion.action === 'joined') {
            toast({
              title: 'Wedding joined',
              description: completion.weddingName
                ? `You joined ${completion.weddingName} successfully.`
                : 'You joined the wedding successfully.',
            });
          }

          navigate(completion.route, { replace: true });
          return;
        }

        if (!profile?.role) return;

        if (hasPendingEstimatorPlanDraft()) {
          const seeded = await seedPendingEstimatorPlanForUser({
            userId: user.id,
            role: profile.role,
            plannerType: profile.planner_type,
          });

          if (seeded && active) {
            toast({
              title: 'Wedding plan ready',
              description: 'Your estimate was turned into a starter budget, vendor list, and tasks.',
            });
            navigate('/budget', { replace: true });
            return;
          }
        }

        if (active) {
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

  if (loading || redirecting || (user && !profile?.role && !activePendingSetup)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const persistWeddingIntentIfNeeded = () => {
    if (signupPath === 'professional') {
      clearPendingWeddingSetup();
      return;
    }

    persistPendingWeddingSetup({
      intent: signupPath,
      email,
      weddingOwnerRole: signupPath === 'create_wedding' ? weddingOwnerRole : null,
      partnerEmail: signupPath === 'create_wedding' ? partnerEmail : null,
      weddingName: signupPath === 'create_wedding' ? weddingName : null,
      weddingCode: signupPath === 'join_wedding' ? normalizeJoinCode(weddingCode) : null,
      weddingCounty: signupPath === 'create_wedding' ? weddingCounty : null,
      weddingTown: signupPath === 'create_wedding' ? weddingTown : null,
      weddingDate: signupPath === 'create_wedding' ? weddingDate : null,
    });
  };

  const validateGoogleSignupIntent = () => {
    if (!isSignUp) return;

    if (signupPath === 'create_wedding') {
      if (!weddingName.trim()) {
        throw new Error('Add a wedding name before continuing with Google.');
      }

      if (!weddingOwnerRole) {
        throw new Error('Choose whether the bride or groom is creating this wedding first.');
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
          if (!weddingName.trim()) {
            throw new Error('Add a wedding name to create your workspace.');
          }

          persistWeddingIntentIfNeeded();
          await signUp(email, password, fullName, 'couple', {
            signupIntent: 'create_wedding',
            weddingOwnerRole,
            partnerEmail,
            weddingName,
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
        } else {
          clearPendingWeddingSetup();
          await signUp(email, password, fullName, professionalRole, {
            signupIntent: 'professional',
            primaryCounty: primaryCounty || null,
            primaryTown: primaryTown || null,
          });
          toast({ title: 'Account created!', description: 'Check your email to confirm your account.' });
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
      await signInWithGoogle();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setGoogleSubmitting(false);
    }
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
            {isForgot ? 'Forgot Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isForgot
              ? 'Enter your email to receive a reset link.'
              : isSignUp
                ? 'Start by telling us whether you are creating a wedding, joining one, or opening a professional account.'
                : signupPath === 'join_wedding'
                  ? 'Sign in with the same email that received the invite and we’ll take you straight into the wedding.'
                  : 'Sign in to continue.'}
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
              {isSignUp && hasHomepageCarryover && (
                <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Continuing from homepage</p>
                  <p className="mt-1 text-sm text-foreground">
                    You’re starting in <span className="font-medium">{carryoverLabel}</span>. You can switch it below anytime.
                  </p>
                </div>
              )}

              {showTrackChooser && (
                <motion.div
                  initial={hasHomepageCarryover ? { opacity: 0, y: 18, scale: 0.985 } : false}
                  animate={hasHomepageCarryover ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-5 space-y-3"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Start Here</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose how you want to enter Zania. Weddings stay owned by the couple, while planners and vendors keep their own professional accounts.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(Object.entries(signupTrackMeta) as Array<[WeddingSignupIntent, (typeof signupTrackMeta)[WeddingSignupIntent]]>).map(([intent, meta]) => {
                      const Icon = meta.icon;
                      const active = signupPath === intent;

                      return (
                        <button
                          key={intent}
                          type="button"
                          onClick={() => setSignupPath(intent)}
                          className={`rounded-2xl border p-4 text-left transition-all ${
                            active
                              ? 'border-primary bg-primary/5 shadow-card'
                              : 'border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                            <p className="font-medium text-foreground">{meta.title}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{meta.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {showGoogleAuth && (
                <div className="space-y-4">
                  {isSignUp && signupPath === 'join_wedding' && (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      Use the same Google email that received the wedding invite. We’ll match it to the invitation code after sign-in.
                    </div>
                  )}
                  {isSignUp && signupPath === 'create_wedding' && (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      You can continue with Google here. We’ll create the wedding workspace and queue the partner invite after you come back from Google.
                    </div>
                  )}
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
                        <p className="text-sm font-medium text-foreground">Who is creating this wedding?</p>
                        <p className="text-xs text-muted-foreground">
                          The couple owns the wedding. Start by telling us whether you are the bride or groom.
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

                    <div className="space-y-2">
                      <Label htmlFor="wedding-name">Wedding Name</Label>
                      <Input
                        id="wedding-name"
                        value={weddingName}
                        onChange={(event) => setWeddingName(event.target.value)}
                        placeholder="e.g. Mary & James Wedding"
                        required
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="partner-email">Invite your partner by email</Label>
                        <Input
                          id="partner-email"
                          type="email"
                          value={partnerEmail}
                          onChange={(event) => setPartnerEmail(event.target.value)}
                          placeholder={weddingOwnerRole === 'bride' ? 'groom@example.com' : 'bride@example.com'}
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional for now. You can resend or update this invite later from the dashboard.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="wedding-date">Wedding Date</Label>
                        <Input
                          id="wedding-date"
                          type="date"
                          value={weddingDate}
                          onChange={(event) => setWeddingDate(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Where will the wedding happen?</p>
                        <p className="text-xs text-muted-foreground">
                          We’ll use this to match the wedding with nearby planners and vendors.
                        </p>
                      </div>
                      <KenyaLocationFields
                        county={weddingCounty}
                        town={weddingTown}
                        onCountyChange={setWeddingCounty}
                        onTownChange={setWeddingTown}
                        countyLabel="Wedding county"
                        townLabel="Wedding town / area"
                      />
                    </div>
                  </>
                )}

                {showJoinDetails && (
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Join an existing wedding</p>
                      <p className="text-xs text-muted-foreground">
                        Use the same email address that received the invite. We’ll preview the invite and join you automatically after sign-in or account confirmation.
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
                      ? 'Create Wedding Account'
                      : signupPath === 'join_wedding'
                        ? 'Create Account & Join Wedding'
                        : 'Create Account'
                    : 'Sign In'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp((current) => !current)}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
