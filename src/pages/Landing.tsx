import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

function PublicBudgetEstimator() {
  const [guestCount, setGuestCount] = useState('120');
  const [county, setCounty] = useState('Nakuru');
  const [weddingStyle, setWeddingStyle] = useState<'intimate' | 'classic' | 'luxury' | 'garden'>('classic');
  const [venueTier, setVenueTier] = useState<'budget' | 'mid_tier' | 'luxury'>('mid_tier');
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [estimateRows, setEstimateRows] = useState<PublicBudgetEstimateRow[]>([]);
  const { toast } = useToast();

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
          <Link to="/auth" className="sm:flex-1">
            <Button variant="outline" className="w-full gap-2">
              Turn This Into a Plan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
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
    { value: 'couple' as const, icon: Users, label: 'Couple', sub: 'Plan your wedding' },
    { value: 'planner' as const, icon: Briefcase, label: 'Planner', sub: 'Manage clients' },
    { value: 'committee' as const, icon: UserCog, label: 'Committee', sub: 'Run one wedding together' },
    { value: 'vendor' as const, icon: Store, label: 'Vendor', sub: 'List your business' },
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
              <Label htmlFor="hero-name" className="text-xs">{role === 'committee' ? 'Chairperson Name' : 'Full Name'}</Label>
              <Input
                id="hero-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={role === 'committee' ? 'Committee chair full name' : 'Your full name'}
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors ${
                      role === r.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <r.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{r.label}</span>
                    <span className="text-[10px] leading-tight text-center opacity-80">{r.sub}</span>
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
    return <Navigate to={getHomeRouteForRole(profile?.role)} replace />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf6f1_0%,#fffdfa_18%,#ffffff_100%)]">
      {/* Nav */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2.5">
            <Heart className="h-6 w-6 text-primary" fill="currentColor" />
          </div>
          <div>
            <span className="font-display text-2xl font-bold text-foreground">Centerpiece</span>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Wedding Planning in Kenya</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link to="/planners">
            <Button variant="ghost" size="sm">Find a Planner</Button>
          </Link>
          <Link to="/vendors-directory">
            <Button variant="ghost" size="sm">Vendor Directory</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="gap-2">
              Login / Sign Up
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pb-16">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(221,108,58,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(62,39,35,0.12),transparent_32%)]" />
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-24 hidden h-[420px] w-[32rem] overflow-hidden rounded-l-[3rem] lg:block">
          <img src={heroImage} alt="Kenyan wedding couple" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(42,28,24,0.55),rgba(42,28,24,0.12))]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 pt-6 lg:px-8 lg:pt-8">
          <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr_0.9fr]">
            <div className="flex flex-col justify-between gap-6">
              <div className="max-w-xl">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-primary shadow-sm backdrop-blur-sm">
                  One home for the whole wedding
                </div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                  className="mt-6 font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl xl:text-6xl"
              >
                  Plan the wedding,
                  <br />
                  find the right team,
                  <br />
                  know the cost early.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                  className="mt-6 max-w-2xl text-lg text-muted-foreground"
              >
                  Centerpiece gives couples, committees, planners, and verified vendors one elegant wedding workspace for budgets, discovery, reviews, and execution.
              </motion.p>
            </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link to="/vendors-directory" className="group">
                  <Card className="h-full border-border/60 bg-white/85 shadow-card transition-transform duration-200 group-hover:-translate-y-1">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-display text-xl font-semibold text-foreground">Vendor Directory</p>
                        <p className="mt-1 text-sm text-muted-foreground">Browse verified wedding vendors without digging through WhatsApp referrals.</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        Explore vendors
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/planners" className="group">
                  <Card className="h-full border-border/60 bg-white/85 shadow-card transition-transform duration-200 group-hover:-translate-y-1">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-display text-xl font-semibold text-foreground">Find a Planner</p>
                        <p className="mt-1 text-sm text-muted-foreground">See professional planners or choose a committee-led setup for your wedding.</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        Meet planners
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              <div className="grid gap-3 rounded-[28px] border border-border/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Built for</p>
                  <p className="mt-2 font-medium text-foreground">Couples, planners, committees, vendors</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Trust layer</p>
                  <p className="mt-2 font-medium text-foreground">Verified access, pricing, reviews</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Start fast</p>
                  <p className="mt-2 font-medium text-foreground">Estimate cost and open your workspace</p>
                </div>
              </div>
            </div>

            <div className="xl:pt-10">
              <PublicBudgetEstimator />
            </div>

            <div className="xl:pt-12">
              <InlineAuthForm />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-bold text-foreground">Everything You Need</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Designed specifically for Kenyan weddings — from ruracio to reception.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-border bg-card p-6 shadow-card"
            >
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-primary" fill="currentColor" />
          <span>Centerpiece © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
