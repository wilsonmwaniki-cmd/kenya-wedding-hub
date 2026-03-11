import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, CheckCircle, Wallet, Users, MessageSquare, ArrowRight, Loader2, Briefcase, Store, Calculator, Sparkles } from 'lucide-react';
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
    <section className="border-y border-border bg-gradient-to-b from-muted/30 to-background">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Cost Index</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
            Estimate your Kenyan wedding budget before you hire anyone
          </h2>
          <p className="mt-4 text-muted-foreground">
            Powered by anonymized wedding pricing data from real planner workflows. Use it to set a realistic starting budget, then sign up to turn the estimate into a working plan.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="border-border/60 bg-card/95 shadow-warm">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Budget calculator</p>
                  <p className="text-sm text-muted-foreground">Tune the wedding profile and generate an estimate.</p>
                </div>
              </div>

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

              <Button onClick={() => void loadEstimate()} className="w-full gap-2" disabled={loadingEstimate}>
                {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Estimate Wedding Budget
              </Button>

              <p className="text-xs text-muted-foreground">
                This is an early estimate, not a quotation. Market-backed categories appear once enough anonymized observations exist.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card shadow-card">
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl bg-primary/5 p-5">
                  <p className="text-sm font-medium text-muted-foreground">Estimated total budget</p>
                  <p className="mt-2 font-display text-4xl font-bold text-foreground">{formatCurrency(totals.suggested)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Working range {formatCurrency(totals.low)} - {formatCurrency(totals.high)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-5">
                  <p className="text-sm font-medium text-foreground">Estimator confidence</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{totals.marketCount}/{estimateRows.length || 0}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    categories using live market observations
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {estimateRows.map((row) => (
                  <div key={row.category} className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{row.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.source === 'market'
                            ? `${row.sample_size} market observations`
                            : 'Fallback model until more live data is available'}
                        </p>
                      </div>
                      <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {row.source}
                      </span>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-foreground">{formatCurrency(row.suggested_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Range {formatCurrency(row.low_amount)} - {formatCurrency(row.high_amount)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/auth">
                  <Button className="gap-2">
                    Turn This Into a Plan
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="text-sm text-muted-foreground">
                  Sign up to track vendors, capture real prices, and refine the estimate with your planner.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function InlineAuthForm() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>('couple');
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
        await signUp(email, password, fullName, role);
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
    { value: 'vendor' as const, icon: Store, label: 'Vendor', sub: 'List your business' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="w-full max-w-sm rounded-2xl border border-border/50 bg-card/95 p-6 shadow-warm backdrop-blur-sm"
    >
      <div className="mb-4 text-center">
        <h3 className="font-display text-lg font-semibold text-card-foreground">
          {isForgot ? 'Forgot Password' : isSignUp ? 'Create Your Account' : 'Welcome Back'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isForgot ? 'Enter your email to receive a reset link' : isSignUp ? 'Start planning your dream wedding' : 'Sign in to continue'}
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
              <Label htmlFor="hero-name" className="text-xs">Full Name</Label>
              <Input id="hero-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Type</Label>
              <div className="grid grid-cols-3 gap-1.5">
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
                  </button>
                ))}
              </div>
            </div>
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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" fill="currentColor" />
          <span className="font-display text-xl font-bold text-foreground">Centerpiece</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/planners">
            <Button variant="ghost" size="sm">Find a Planner</Button>
          </Link>
          <Link to="/vendors-directory">
            <Button variant="ghost" size="sm">Vendor Directory</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Kenyan wedding couple" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-hero" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-32">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: copy */}
            <div className="max-w-lg text-center lg:text-left">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="font-display text-4xl font-bold leading-tight text-primary-foreground sm:text-5xl lg:text-6xl"
              >
                Plan Your Dream<br />Kenyan Wedding
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-6 text-lg text-primary-foreground/80"
              >
                From budgets to guest lists, manage every detail of your wedding day with one beautiful platform.
              </motion.p>
            </div>

            {/* Right: auth form */}
            <InlineAuthForm />
          </div>
        </div>
      </section>

      <PublicBudgetEstimator />

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
