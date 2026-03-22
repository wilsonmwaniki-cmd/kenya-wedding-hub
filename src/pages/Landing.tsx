import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, CheckCircle, Wallet, Users, MessageSquare, ArrowRight, Loader2, Briefcase, Store, Calculator, Sparkles, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import heroImage from '@/assets/hero-wedding.jpg';
import { getHomeRouteForRole, type SignupRole } from '@/lib/roles';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { getPublicBudgetEstimate, type PublicBudgetEstimateRow } from '@/lib/publicBudgetEstimator';
import { saveEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';

const features = [
  { icon: Wallet, title: 'Budget Tracking', desc: 'Keep your wedding finances organized with category-level tracking.' },
  { icon: CheckCircle, title: 'Task Timeline', desc: 'Never miss a deadline with your personalized wedding checklist.' },
  { icon: Users, title: 'Guest Management', desc: 'Track RSVPs, meal preferences, and seating assignments.' },
  { icon: MessageSquare, title: 'AI Assistant', desc: 'Get instant help with Kenyan wedding planning tips and advice.' },
];

function formatCurrency(value: number | null | undefined) {
  if (value == null) return 'N/A';
  return `KES ${Number(value).toLocaleString()}`;
}

function PublicBudgetEstimator({ compact = false }: { compact?: boolean }) {
  const [guestCount, setGuestCount] = useState('120');
  const [county, setCounty] = useState('Nakuru');
  const [weddingStyle, setWeddingStyle] = useState<'intimate' | 'classic' | 'luxury' | 'garden'>('classic');
  const [venueTier, setVenueTier] = useState<'budget' | 'mid_tier' | 'luxury'>('mid_tier');
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [estimateRows, setEstimateRows] = useState<PublicBudgetEstimateRow[]>([]);
  const [startingPlan, setStartingPlan] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleTurnIntoPlan = () => {
    const normalizedGuestCount = Number(guestCount);
    if (!Number.isFinite(normalizedGuestCount) || normalizedGuestCount <= 0) {
      toast({
        title: 'Invalid guest count',
        description: 'Enter a realistic guest count greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    setStartingPlan(true);
    saveEstimatorPlanDraft({
      guestCount: normalizedGuestCount,
      county: county.trim() || 'Nairobi',
      weddingStyle,
      venueTier,
    });
    navigate('/auth');
  };

  const loadEstimate = async () => {
    const normalizedGuestCount = Number(guestCount);
    if (!Number.isFinite(normalizedGuestCount) || normalizedGuestCount <= 0) {
      toast({
        title: 'Invalid guest count',
        description: 'Enter a realistic guest count greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    setLoadingEstimate(true);
    try {
      const data = await getPublicBudgetEstimate({
        guestCount: normalizedGuestCount,
        county: county.trim() || null,
        venueTier,
        weddingStyle,
        minSampleSize: 5,
      });
      setEstimateRows(data);
    } catch (error: any) {
      toast({
        title: 'Estimator unavailable',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingEstimate(false);
    }
  };

  useEffect(() => {
    void loadEstimate();
  }, []);

  const totals = useMemo(() => {
    return estimateRows.reduce(
      (acc, row) => {
        acc.suggested += row.suggested_amount;
        acc.low += row.low_amount;
        acc.high += row.high_amount;
        acc.marketCount += row.source === 'market' ? 1 : 0;
        return acc;
      },
      { suggested: 0, low: 0, high: 0, marketCount: 0 },
    );
  }, [estimateRows]);

  if (compact) {
    return (
      <Card className="border-white/30 bg-[rgba(43,28,24,0.62)] shadow-[0_28px_80px_rgba(57,38,31,0.24)] backdrop-blur-md">
        <CardContent className="space-y-5 p-7">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/12 p-2.5">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-[1.9rem] font-semibold leading-none text-white">Quick Cost Estimate</h3>
              <p className="mt-2 text-sm font-medium text-white">Free, instant, and no sign-up required</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">Number of guests</Label>
            <Select value={guestCount} onValueChange={setGuestCount}>
              <SelectTrigger className="h-12 border-border/70 bg-white text-foreground shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">Up to 50 guests</SelectItem>
                <SelectItem value="80">50 - 100 guests</SelectItem>
                <SelectItem value="120">100 - 150 guests</SelectItem>
                <SelectItem value="180">150 - 220 guests</SelectItem>
                <SelectItem value="260">220+ guests</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-county" className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">County</Label>
            <Input
              id="hero-county"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              placeholder="e.g. Nairobi"
              className="h-12 border-border/70 bg-white text-foreground placeholder:text-muted-foreground shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">Wedding style</Label>
            <Select value={weddingStyle} onValueChange={(value: 'intimate' | 'classic' | 'luxury' | 'garden') => setWeddingStyle(value)}>
              <SelectTrigger className="h-12 border-border/70 bg-white text-foreground shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="intimate">Intimate & Simple</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="garden">Garden</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => void loadEstimate()} className="h-12 w-full gap-2" disabled={loadingEstimate}>
            {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Get Estimate
          </Button>

          <div className="rounded-2xl border border-white/20 bg-black/30 p-4">
            <p className="text-sm font-medium text-white">Estimated total budget</p>
            <p className="mt-1 font-display text-3xl font-bold text-white">{formatCurrency(totals.suggested)}</p>
            <p className="mt-2 text-xs font-medium text-white/90">
              Working range {formatCurrency(totals.low)} - {formatCurrency(totals.high)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-sm font-medium text-white">What your estimate includes</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/85">
              {estimateRows.slice(0, 4).map((row) => (
                <div key={row.category} className="rounded-xl border border-white/20 bg-black/20 px-3 py-2">
                  <p className="font-medium text-white">{row.category}</p>
                  <p className="font-medium text-white/90">{formatCurrency(row.suggested_amount)}</p>
                </div>
              ))}
            </div>
          </div>

          <Button variant="outline" className="h-11 w-full gap-2" onClick={handleTurnIntoPlan} disabled={startingPlan}>
            {startingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Turn This Into a Plan</span>
            {!startingPlan && <ArrowRight className="h-4 w-4" />}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/95 shadow-warm backdrop-blur-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-3">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Cost Estimator</p>
            <h3 className="mt-1 font-display text-2xl font-semibold text-foreground">
              Start with a realistic budget
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use live Kenyan wedding pricing signals before you book vendors.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="guest-count">Guest count</Label>
            <Input
              id="guest-count"
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="120"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="county">County / town</Label>
            <Input
              id="county"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              placeholder="e.g. Nairobi, Nakuru, Kiambu"
            />
          </div>

          <div className="space-y-2">
            <Label>Wedding style</Label>
            <Select value={weddingStyle} onValueChange={(value: 'intimate' | 'classic' | 'luxury' | 'garden') => setWeddingStyle(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="intimate">Intimate</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="garden">Garden</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Venue tier</Label>
            <Select value={venueTier} onValueChange={(value: 'budget' | 'mid_tier' | 'luxury') => setVenueTier(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="mid_tier">Mid-tier</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl bg-primary/5 p-5">
            <p className="text-sm font-medium text-muted-foreground">Estimated total budget</p>
            <p className="mt-2 font-display text-3xl font-bold text-foreground">{formatCurrency(totals.suggested)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Working range {formatCurrency(totals.low)} - {formatCurrency(totals.high)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-5">
            <p className="text-sm font-medium text-foreground">Market confidence</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{totals.marketCount}/{estimateRows.length || 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              categories using live observations
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {estimateRows.slice(0, 4).map((row) => (
            <div key={row.category} className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{row.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.source === 'market' ? `${row.sample_size} live observations` : 'Modeled fallback'}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {row.source}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-foreground">{formatCurrency(row.suggested_amount)}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={() => void loadEstimate()} className="gap-2 sm:flex-1" disabled={loadingEstimate}>
            {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Refresh Estimate
          </Button>
          <Button variant="outline" className="w-full gap-2 sm:flex-1" onClick={handleTurnIntoPlan} disabled={startingPlan}>
            {startingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Turn This Into a Plan</span>
            {!startingPlan && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Early estimate only. Sign up to turn this into a working wedding plan with vendors, tasks, and approvals.
        </p>
      </CardContent>
    </Card>
  );
}

function InlineAuthForm() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>('couple');
  const [committeeName, setCommitteeName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();

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
        await signUp(email, password, fullName, role, {
          committeeName: role === 'committee' ? committeeName : null,
        });
        toast({ title: 'Account created!', description: 'Check your email to confirm your account.' });
      } else {
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
      await signInWithGoogle();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setGoogleSubmitting(false);
    }
  };

  const roles = [
    {
      value: 'couple' as const,
      icon: Users,
      title: "I'm planning my own wedding",
      description: 'For a bride, groom, or partner managing budget, vendors, guests, and tasks.',
      helper: 'Choose: Couple',
    },
    {
      value: 'planner' as const,
      icon: Briefcase,
      title: "I'm a professional planner",
      description: 'For planners and coordinators managing weddings for clients.',
      helper: 'Choose: Planner',
    },
    {
      value: 'committee' as const,
      icon: UserCog,
      title: "I'm part of a wedding committee",
      description: 'For a chair, sibling, cousin, or family organizer helping run one wedding together.',
      helper: 'Choose: Wedding Committee',
    },
    {
      value: 'vendor' as const,
      icon: Store,
      title: "I'm a vendor",
      description: 'For photographers, caterers, florists, DJs, venues, decor teams, and other service providers.',
      helper: 'Choose: Vendor',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="w-full rounded-[28px] border border-border/60 bg-card/95 p-6 shadow-warm backdrop-blur-sm"
    >
      <div className="mb-5 border-b border-border/60 pb-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Sign in or create your account</p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-card-foreground">
          {isForgot ? 'Forgot Password' : isSignUp ? 'Create Your Account' : 'Welcome Back'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isForgot ? 'Enter your email to receive a reset link' : isSignUp ? 'Open your wedding workspace in minutes.' : 'Pick up exactly where the wedding left off.'}
        </p>
      </div>

      {isForgot ? (
        <form onSubmit={handleForgotPassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hero-email" className="text-xs">Email</Label>
            <Input id="hero-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-9 text-sm" />
          </div>
          <Button type="submit" className="w-full gap-2" size="sm" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send Reset Link
          </Button>
          <div className="text-center">
            <button type="button" onClick={() => { setIsForgot(false); setIsSignUp(false); }} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Back to Sign In
            </button>
          </div>
        </form>
      ) : (
        <>
      <div className="space-y-3">
        <GoogleAuthButton
          loading={googleSubmitting}
          disabled={submitting || googleSubmitting}
          onClick={handleGoogleSignIn}
          text={isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
        />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
          </div>
        </div>
      </div>
          <form onSubmit={handleSubmit} className="space-y-3">
        {isSignUp && (
          <>
          <div className="space-y-1.5">
              <Label htmlFor="hero-name" className="text-xs">{role === 'committee' ? 'Committee Chair Name' : 'Full Name'}</Label>
              <Input
                id="hero-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={role === 'committee' ? 'The main person coordinating the committee' : 'Your full name'}
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">How will you use Zania?</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Pick the option that best matches what you want to do first.
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Most people choose <span className="font-medium text-foreground">Couple</span> for their own wedding, and <span className="font-medium text-foreground">Wedding Committee</span> for a family-led wedding.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-colors ${
                      role === r.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <r.icon className="h-4 w-4" />
                    <span className="text-xs font-semibold leading-tight text-foreground">{r.title}</span>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">{r.description}</span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary">{r.helper}</span>
                  </button>
                ))}
              </div>
            </div>
            {role === 'committee' && (
              <div className="space-y-1.5">
                <Label htmlFor="hero-committee-name" className="text-xs">Committee Name</Label>
                <Input
                  id="hero-committee-name"
                  value={committeeName}
                  onChange={(e) => setCommitteeName(e.target.value)}
                  placeholder="e.g. Anne & Mark Wedding Committee"
                  required
                  className="h-9 text-sm"
                />
              </div>
            )}
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="hero-email" className="text-xs">Email</Label>
          <Input id="hero-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="hero-password" className="text-xs">Password</Label>
            {!isSignUp && (
              <button type="button" onClick={() => setIsForgot(true)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                Forgot password?
              </button>
            )}
          </div>
          <Input id="hero-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-9 text-sm" />
        </div>
        <Button type="submit" className="w-full gap-2" size="sm" disabled={submitting || googleSubmitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSignUp ? 'Get Started' : 'Sign In'}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
        </>
      )}
    </motion.div>
  );
}

function QuickSignupChooser() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<SignupRole>('couple');

  const options = [
    {
      value: 'couple' as const,
      icon: Users,
      title: 'Planning my own wedding',
      helper: 'Couple',
    },
    {
      value: 'committee' as const,
      icon: UserCog,
      title: 'Helping run a family wedding',
      helper: 'Wedding Committee',
    },
    {
      value: 'planner' as const,
      icon: Briefcase,
      title: 'Managing weddings for clients',
      helper: 'Planner',
    },
    {
      value: 'vendor' as const,
      icon: Store,
      title: 'Offering wedding services',
      helper: 'Vendor',
    },
  ];

  const openAuth = (mode: 'signup' | 'signin') => {
    navigate('/auth', {
      state: {
        mode,
        role: selectedRole,
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="rounded-[28px] border border-white/18 bg-[rgba(35,24,21,0.58)] p-5 shadow-[0_28px_60px_rgba(40,26,22,0.22)] backdrop-blur-md"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Start here</p>
        <h3 className="font-display text-2xl font-semibold text-white">Create your account</h3>
        <p className="text-sm leading-relaxed text-white/78">
          Pick the option that best matches how you&apos;ll use Zania. Most new users choose Couple or Wedding Committee.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSelectedRole(option.value)}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
              selectedRole === option.value
                ? 'border-white/60 bg-white/16 text-white'
                : 'border-white/18 bg-black/10 text-white/82 hover:border-white/35 hover:bg-white/10'
            }`}
          >
            <option.icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium leading-tight">{option.title}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/70">{option.helper}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1 gap-2" onClick={() => openAuth('signup')}>
          Create account
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="flex-1 border-white/30 bg-white/8 text-white hover:bg-white/16 hover:text-white"
          onClick={() => openAuth('signin')}
        >
          I already have an account
        </Button>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={getHomeRouteForRole(profile?.role, profile?.planner_type)} replace />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fcf8f3_0%,#fffdfa_24%,#ffffff_100%)] text-foreground">
      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-semibold text-foreground">Zania</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <Link to="/vendors-directory" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Vendors</Link>
            <Link to="/planners" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Planners</Link>
            <a href="#cost-estimator" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Cost Estimator</a>
            <a href="#auth" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Sign In
            </a>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pt-8 lg:px-8 lg:pt-10">
        <div className="overflow-hidden rounded-[34px] border border-border/40 shadow-[0_30px_80px_rgba(62,39,35,0.18)]">
          <div className="relative min-h-[760px]">
            <img src={heroImage} alt="Kenyan wedding floral arrangement" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,28,24,0.74)_0%,rgba(42,28,24,0.52)_38%,rgba(42,28,24,0.3)_100%)]" />
            <div className="relative grid min-h-[760px] gap-10 px-8 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:px-16 lg:py-12">
              <div className="flex flex-col justify-center text-primary-foreground">
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-sm uppercase tracking-[0.35em] text-primary-foreground/80"
                >
                  Wedding Planning for Kenya
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[0.94] sm:text-6xl xl:text-[5.4rem]"
                >
                  Find trusted vendors.
                  <br />
                  <span className="italic font-normal">Know your budget.</span>
                  <br />
                  <span className="font-normal">Plan with confidence.</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mt-6 max-w-2xl text-xl leading-relaxed text-primary-foreground/86"
                >
                  Zania helps couples, planners, and committees discover vendors, find planners, and estimate costs in one wedding planning platform built for Kenya.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="mt-10 flex flex-wrap gap-4"
                >
                  <Link to="/vendors-directory">
                    <Button variant="outline" className="h-12 min-w-[200px] border-white/40 bg-white/8 px-6 text-base text-white backdrop-blur hover:bg-white/18 hover:text-white">
                      Vendor Directory
                    </Button>
                  </Link>
                  <Link to="/planners">
                    <Button variant="outline" className="h-12 min-w-[200px] border-white/40 bg-white/8 px-6 text-base text-white backdrop-blur hover:bg-white/18 hover:text-white">
                      Find a Planner
                    </Button>
                  </Link>
                  <a href="#cost-estimator">
                    <Button variant="outline" className="h-12 min-w-[200px] border-white/40 bg-white/8 px-6 text-base text-white backdrop-blur hover:bg-white/18 hover:text-white">
                      Cost Estimator
                    </Button>
                  </a>
                </motion.div>
              </div>

              <div id="cost-estimator" className="flex items-center lg:justify-end">
                <div className="w-full max-w-[540px] space-y-4">
                  <PublicBudgetEstimator compact />
                  <QuickSignupChooser />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-18 lg:px-8">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.22em] text-primary">Choose your starting point</p>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Start with the part that matters <span className="italic font-normal">most</span>
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">
            Compare vendors, find the right planner, or turn your estimate into a workable wedding plan.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          <Link to="/vendors-directory" className="group">
            <Card className="h-full rounded-[28px] border-border/60 bg-card/95 shadow-card transition-transform duration-200 group-hover:-translate-y-1">
              <CardContent className="space-y-5 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold">Vendor Directory</h3>
                  <p className="mt-3 text-base leading-8 text-muted-foreground">
                    Browse vetted venues, caterers, photographers, florists, DJs, and more across Kenya.
                  </p>
                </div>
                <div className="pt-4 text-sm font-medium uppercase tracking-[0.14em] text-primary">
                  Browse vendors →
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/planners" className="group">
            <Card className="h-full rounded-[28px] border-border/60 bg-card/95 shadow-card transition-transform duration-200 group-hover:-translate-y-1">
              <CardContent className="space-y-5 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold">Find a Planner</h3>
                  <p className="mt-3 text-base leading-8 text-muted-foreground">
                    Get matched with experienced wedding planners and coordinators who know your region and style.
                  </p>
                </div>
                <div className="pt-4 text-sm font-medium uppercase tracking-[0.14em] text-primary">
                  Explore planners →
                </div>
              </CardContent>
            </Card>
          </Link>

          <a href="#cost-estimator" className="group">
            <Card className="h-full rounded-[28px] border-border/60 bg-card/95 shadow-card transition-transform duration-200 group-hover:-translate-y-1">
              <CardContent className="space-y-5 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold">Cost Estimator</h3>
                  <p className="mt-3 text-base leading-8 text-muted-foreground">
                    Get realistic budget breakdowns tailored to your guest count, location, and wedding style.
                  </p>
                </div>
                <div className="pt-4 text-sm font-medium uppercase tracking-[0.14em] text-primary">
                  Estimate costs →
                </div>
              </CardContent>
            </Card>
          </a>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-border/60 bg-card/90 p-6 shadow-sm"
            >
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="auth" className="border-y border-border/50 bg-[#f7f0e8]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1fr_520px] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-sm uppercase tracking-[0.22em] text-primary">Get Started</p>
            <h2 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Your planning <span className="italic font-normal">workspace</span>
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-9 text-muted-foreground">
              Create a free account to save vendors, build your budget, and move from first estimate to final decisions in one place.
            </p>
            <ul className="mt-8 space-y-5 text-lg text-foreground">
              <li className="flex items-start gap-4"><span className="mt-2 h-2 w-2 rounded-full bg-primary" />Save and compare vendors side by side</li>
              <li className="flex items-start gap-4"><span className="mt-2 h-2 w-2 rounded-full bg-primary" />Turn your estimate into a real wedding budget</li>
              <li className="flex items-start gap-4"><span className="mt-2 h-2 w-2 rounded-full bg-primary" />Collaborate with your committee or planner</li>
              <li className="flex items-start gap-4"><span className="mt-2 h-2 w-2 rounded-full bg-primary" />Track vendor decisions, tasks, and progress in one place</li>
            </ul>
          </div>

          <div className="flex items-center">
            <InlineAuthForm />
          </div>
        </div>
      </section>

      <footer className="bg-primary px-6 py-8 text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm sm:flex-row lg:px-2">
          <div className="font-display text-2xl font-semibold">Zania</div>
          <div className="text-center text-primary-foreground/80 sm:text-right">
            © {new Date().getFullYear()} Zania. Wedding planning for Kenya.
          </div>
        </div>
      </footer>
    </div>
  );
}
