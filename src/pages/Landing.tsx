import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Wallet, Users, MessageSquare, ArrowRight, Loader2, Briefcase, Store, Calculator, Sparkles, UserRoundPlus, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import heroImage from '@/assets/hero-wedding.jpg';
import { getHomeRouteForRole } from '@/lib/roles';
import { getPublicBudgetEstimate, type PublicBudgetEstimateRow } from '@/lib/publicBudgetEstimator';
import { saveEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';

const features = [
  { icon: Wallet, title: 'Budget Tracking', desc: 'Keep your wedding finances organized with category-level tracking.' },
  { icon: CheckCircle, title: 'Task Timeline', desc: 'Never miss a deadline with your personalized wedding checklist.' },
  { icon: Users, title: 'Guest Management', desc: 'Track RSVPs, meal preferences, and seating assignments.' },
  { icon: MessageSquare, title: 'AI Assistant', desc: 'Get instant help with Kenyan wedding planning tips and advice.' },
];

const heroHighlights = [
  { icon: Store, title: 'Trusted vendors', desc: 'Discover venues, caterers, photographers, florists, and more across Kenya.' },
  { icon: Calculator, title: 'Real budget signals', desc: 'Estimate costs using live wedding pricing patterns from Kenya.' },
  { icon: Users, title: 'Shared planning', desc: 'Keep partners, planners, and committees aligned in one workspace.' },
  { icon: Briefcase, title: 'Diaspora-ready', desc: 'Plan from abroad while staying grounded in Kenya wedding logistics.' },
];

const heroStats = [
  { value: 'Kenya', label: 'Grounded in local wedding logistics' },
  { value: 'Diaspora', label: 'Built for planning from abroad' },
  { value: 'One place', label: 'Budget, vendors, guests, and timeline' },
];

function LandingWordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="inline-flex flex-col gap-3">
      <div
        aria-label="Zania"
        className={`font-editorial text-[2.35rem] font-light uppercase leading-none tracking-[0.22em] ${light ? 'text-[#f6eee6]' : 'text-[#201814]'}`}
      >
        <span>Z</span>
        <span className="text-[#d4bb7d]">A</span>
        <span>NIA</span>
      </div>
      <div className={`h-[2px] w-20 ${light ? 'bg-[#c9a96e]' : 'bg-[#c2724f]'}`} />
    </div>
  );
}

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
        <Card className="border-white/18 bg-[linear-gradient(180deg,rgba(30,22,19,0.92),rgba(42,30,25,0.88))] shadow-[0_28px_80px_rgba(20,12,10,0.3)] backdrop-blur-md">
        <CardContent className="space-y-4 p-5 sm:space-y-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#c9a96e]/15 p-2.5">
              <Calculator className="h-5 w-5 text-[#ead4aa]" />
            </div>
            <div>
              <h3 className="font-editorial text-[1.7rem] font-medium leading-none text-[#f7efe7] sm:text-[2.2rem]">Quick Cost Estimate</h3>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.24em] text-[#dcb188]">Free, instant, and no sign-up required</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7efe7]/88">Number of guests</Label>
            <Select value={guestCount} onValueChange={setGuestCount}>
              <SelectTrigger className="h-11 border-border/70 bg-white text-foreground shadow-sm sm:h-12">
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
            <Label htmlFor="hero-county" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7efe7]/88">County</Label>
            <Input
              id="hero-county"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              placeholder="e.g. Nairobi"
              className="h-11 border-border/70 bg-white text-foreground placeholder:text-muted-foreground shadow-sm sm:h-12"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7efe7]/88">Wedding style</Label>
            <Select value={weddingStyle} onValueChange={(value: 'intimate' | 'classic' | 'luxury' | 'garden') => setWeddingStyle(value)}>
              <SelectTrigger className="h-11 border-border/70 bg-white text-foreground shadow-sm sm:h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="intimate">Intimate & Simple</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="garden">Garden</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => void loadEstimate()} className="h-11 w-full gap-2 border border-[#ce7d57] bg-[#c2724f] text-[#fff8f1] hover:bg-[#a85c3c] sm:h-12" disabled={loadingEstimate}>
            {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Get Estimate
          </Button>

          <div className="rounded-2xl border border-[#ead7c4]/14 bg-[rgba(15,10,8,0.28)] p-4">
            <p className="text-sm font-medium text-[#f7efe7]">Estimated total budget</p>
            <p className="mt-1 font-editorial text-3xl font-semibold text-[#fff8f1]">{formatCurrency(totals.suggested)}</p>
            <p className="mt-2 text-xs font-medium text-[#f7efe7]/78">
              Working range {formatCurrency(totals.low)} - {formatCurrency(totals.high)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#ead7c4]/14 bg-[rgba(255,255,255,0.05)] p-4">
            <p className="text-sm font-medium text-[#f7efe7]">What your estimate includes</p>
            <div className="mt-3 grid gap-2 text-xs text-[#f7efe7]/85 sm:grid-cols-2">
              {estimateRows.slice(0, 4).map((row) => (
                <div key={row.category} className="rounded-xl border border-[#ead7c4]/12 bg-[rgba(13,10,8,0.24)] px-3 py-2">
                  <p className="font-medium text-[#fff8f1]">{row.category}</p>
                  <p className="font-medium text-[#f4dfc8]">{formatCurrency(row.suggested_amount)}</p>
                </div>
              ))}
            </div>
          </div>

          <Button variant="outline" className="h-11 w-full gap-2 border-[#ead7c4]/24 bg-[#f6efe8] text-[#241814] hover:bg-[#eadfcf]" onClick={handleTurnIntoPlan} disabled={startingPlan}>
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

function QuickSignupChooser() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <div className="rounded-[30px] border border-[#ead7c4]/32 bg-[linear-gradient(180deg,#f8f2ea,#f1e5d7)] p-5 shadow-[0_28px_60px_rgba(42,25,20,0.16)] backdrop-blur-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c2724f]">Start here</p>
          <h3 className="font-editorial text-[2rem] font-medium leading-none text-[#201814]">Start planning in Kenya or from abroad</h3>
          <p className="text-sm leading-relaxed text-[#6f5747]">
            Choose the path that matches you and we’ll open the right workspace.
          </p>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="rounded-[24px] border border-[#d9b79d] bg-[rgba(255,255,255,0.45)] p-4 shadow-[0_12px_28px_rgba(194,114,79,0.1)]">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#c2724f]/10 p-2">
                <Users className="h-4 w-4 text-[#a85c3c]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#201814]">For couples</p>
                <p className="text-xs leading-relaxed text-[#6f5747]">
                  Create your shared wedding workspace, invite your partner, and keep planning together.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <Button
                className="gap-2"
                onClick={() =>
                  navigate('/auth', {
                    state: {
                      mode: 'signup' as const,
                      signupPath: 'create_wedding' as const,
                    },
                  })
                }
              >
                <UserRoundPlus className="h-4 w-4" />
                Start our wedding
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="gap-2 border-[#d6b698] bg-[#fffaf4] text-[#241814] hover:bg-[#f3e5d7]"
                onClick={() =>
                  navigate('/auth', {
                    state: {
                      mode: 'signin' as const,
                      signupPath: 'create_wedding' as const,
                    },
                  })
                }
              >
                <LogIn className="h-4 w-4" />
                Couple sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="justify-start px-0 text-[#a85c3c] hover:bg-transparent hover:text-[#8f4f34]"
                onClick={() =>
                  navigate('/auth', {
                    state: {
                      mode: 'signup' as const,
                      signupPath: 'join_wedding' as const,
                    },
                  })
                }
              >
                I already have a wedding code
              </Button>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#dfd3c5] bg-[#fffdf9] px-4 py-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#a85c3c]" />
              <p className="text-sm font-medium text-[#201814]">For wedding professionals</p>
            </div>
            <p className="mt-1 text-xs text-[#6f5747]">
              Open a planner or vendor workspace without mixing it into a couple account.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-[#d6b698] bg-[#fffaf4] text-[#241814] hover:bg-[#f3e5d7]"
                onClick={() =>
                  navigate('/auth', {
                    state: {
                      mode: 'signup' as const,
                      signupPath: 'professional' as const,
                      professionalRole: 'planner' as const,
                    },
                  })
                }
              >
                <Briefcase className="h-4 w-4" />
                Planner sign up
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-[#d6b698] bg-[#fffaf4] text-[#241814] hover:bg-[#f3e5d7]"
                onClick={() =>
                  navigate('/auth', {
                    state: {
                      mode: 'signup' as const,
                      signupPath: 'professional' as const,
                      professionalRole: 'vendor' as const,
                    },
                  })
                }
              >
                <Store className="h-4 w-4" />
                Vendor sign up
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                className="gap-2 bg-[#f1e5d7] text-[#3a2720] hover:bg-[#ead8c4]"
                onClick={() =>
                  navigate('/auth', {
                    state: {
                      mode: 'signin' as const,
                      signupPath: 'professional' as const,
                      professionalRole: 'planner' as const,
                    },
                  })
                }
              >
                <LogIn className="h-4 w-4" />
                Planner sign in
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 bg-[#f1e5d7] text-[#3a2720] hover:bg-[#ead8c4]"
                onClick={() =>
                  navigate('/auth', {
                    state: {
                      mode: 'signin' as const,
                      signupPath: 'professional' as const,
                      professionalRole: 'vendor' as const,
                    },
                  })
                }
              >
                <LogIn className="h-4 w-4" />
                Vendor sign in
              </Button>
            </div>
          </div>
        </div>
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9f3ec_0%,#f6f1e8_18%,#fbf8f4_38%,#ffffff_100%)] text-foreground">
      <nav className="sticky top-0 z-20 border-b border-[#eadfce] bg-[rgba(249,243,236,0.95)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <LandingWordmark />
          <Link to="/auth" className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 md:hidden">
            Sign In
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link to="/vendors-directory" className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#7a5c48] transition-colors hover:text-[#c2724f]">Vendors</Link>
            <Link to="/planners" className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#7a5c48] transition-colors hover:text-[#c2724f]">Planners</Link>
            <Link to="/pricing" className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#7a5c48] transition-colors hover:text-[#c2724f]">Pricing</Link>
            <a href="#cost-estimator" className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#7a5c48] transition-colors hover:text-[#c2724f]">Cost Estimator</a>
            <Link to="/auth" className="inline-flex h-10 items-center rounded-sm bg-[#d4bb7d] px-6 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#201814] transition-colors hover:bg-[#c2724f] hover:text-[#fffaf4]">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <section className="px-0 pt-4 sm:pt-6 lg:pt-8">
        <div className="overflow-hidden border-y border-[#3f2c24] shadow-[0_40px_110px_rgba(35,24,20,0.24)]">
          <div className="relative min-h-[640px] bg-[#1c1612] sm:min-h-[760px]">
            <div className="absolute inset-x-0 top-0 z-[1] h-3 bg-[linear-gradient(90deg,#6e4432_0%,#2d211c_20%,#2d211c_80%,#c9a96e_100%)]" />
            <img src={heroImage} alt="Kenyan wedding floral arrangement" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(22,17,14,0.9)_0%,rgba(28,22,18,0.84)_32%,rgba(28,22,18,0.55)_55%,rgba(28,22,18,0.68)_100%)]" />
            <div className="relative mx-auto grid min-h-[640px] w-full max-w-[1700px] gap-8 px-5 py-6 sm:min-h-[760px] sm:px-8 sm:py-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12 lg:px-16 lg:py-14 xl:px-24 2xl:px-32">
              <div className="flex flex-col justify-center text-primary-foreground">
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.55, delay: 0.05 }}
                  className="mb-10 hidden h-[2px] w-16 origin-left bg-[#d4bb7d] lg:block"
                />
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.12 }}
                  className="mb-12 hidden lg:block"
                >
                  <LandingWordmark light />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-xs uppercase tracking-[0.35em] text-[#ce8d68]"
                >
                  Plan weddings in Kenya and the diaspora
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.32 }}
                  className="mt-5 max-w-[7ch] font-editorial text-[3.15rem] font-medium leading-[0.88] tracking-[-0.02em] text-[#f6eee6] sm:mt-6 sm:text-[4.8rem] lg:text-[5.6rem] xl:text-[6.6rem]"
                >
                  Your wedding,
                  <br />
                  <span className="text-[#f6eee6]">planned </span>
                  <span className="italic font-normal text-[#d4bb7d]">your</span>
                  <br />
                  <span className="font-normal text-[#f6eee6]">way.</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.44 }}
                  className="mt-5 max-w-2xl text-lg leading-relaxed text-[#f6eee6]/74 sm:mt-7 sm:text-xl"
                >
                  Built for couples planning in Kenya and across the diaspora, Zania brings budgeting, vendors, guests, timelines, and shared decisions into one refined planning workspace.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.56 }}
                  className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2"
                >
                  {heroHighlights.map(({ icon: Icon, title, desc }) => (
                    <div
                      key={title}
                      className="rounded-[22px] border border-[#ead7c4]/14 bg-[rgba(255,255,255,0.06)] px-4 py-4 backdrop-blur-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-[#d4bb7d]/12 p-2.5">
                          <Icon className="h-4 w-4 text-[#e8cf9f]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#fff8f1]">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#f6eee6]/68">{desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.68 }}
                  className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4"
                >
                  <Link to="/vendors-directory">
                    <Button variant="outline" className="h-12 w-full rounded-sm border-[#e3cfb7]/28 bg-[rgba(255,255,255,0.05)] px-6 text-[0.72rem] font-medium uppercase tracking-[0.2em] text-[#fff8f1] backdrop-blur hover:bg-[rgba(255,255,255,0.12)] hover:text-white sm:min-w-[200px] sm:w-auto">
                      Vendor Directory
                    </Button>
                  </Link>
                  <Link to="/planners">
                    <Button variant="outline" className="h-12 w-full rounded-sm border-[#e3cfb7]/28 bg-[rgba(255,255,255,0.05)] px-6 text-[0.72rem] font-medium uppercase tracking-[0.2em] text-[#fff8f1] backdrop-blur hover:bg-[rgba(255,255,255,0.12)] hover:text-white sm:min-w-[200px] sm:w-auto">
                      Find a Planner
                    </Button>
                  </Link>
                  <a href="#cost-estimator">
                    <Button variant="outline" className="h-12 w-full rounded-sm border-[#e3cfb7]/28 bg-[rgba(255,255,255,0.05)] px-6 text-[0.72rem] font-medium uppercase tracking-[0.2em] text-[#fff8f1] backdrop-blur hover:bg-[rgba(255,255,255,0.12)] hover:text-white sm:min-w-[200px] sm:w-auto">
                      Cost Estimator
                    </Button>
                  </a>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="mt-8 grid max-w-4xl gap-4 border-t border-[#ead7c4]/12 pt-6 sm:grid-cols-3"
                >
                  {heroStats.map((stat) => (
                    <div key={stat.label} className="space-y-1">
                      <p className="font-editorial text-[1.7rem] leading-none text-[#f6eee6]">{stat.value}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#f6eee6]/54">{stat.label}</p>
                    </div>
                  ))}
                </motion.div>
              </div>

              <div id="cost-estimator" className="flex items-center lg:justify-end">
                <div className="w-full max-w-[660px] space-y-5 lg:rounded-[30px] lg:border lg:border-[#ead7c4]/10 lg:bg-[linear-gradient(180deg,rgba(28,22,18,0.5),rgba(28,22,18,0.74))] lg:p-6 lg:shadow-[0_24px_70px_rgba(12,8,7,0.24)] lg:backdrop-blur-sm">
                  <PublicBudgetEstimator compact />
                  <QuickSignupChooser />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 py-14 sm:px-8 sm:py-18 lg:px-12">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.22em] text-primary">Choose your starting point</p>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Start with the part that matters <span className="italic font-normal">most</span>
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">
            Compare vendors, find the right planner, or turn your estimate into a workable wedding plan.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:mt-14 lg:gap-8 lg:grid-cols-3">
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

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:gap-6 lg:grid-cols-4">
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

      <footer className="bg-[#1c1612] px-6 py-8 text-[#f6eee6]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm sm:flex-row lg:px-2">
          <LandingWordmark light />
          <div className="flex flex-col items-center gap-2 text-center text-[#f6eee6]/72 sm:items-end sm:text-right">
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.18em]">
              <Link to="/pricing" className="transition-opacity hover:opacity-100">
                Pricing
              </Link>
              <Link to="/auth" className="transition-opacity hover:opacity-100">
                Sign In
              </Link>
            </div>
            © {new Date().getFullYear()} Zania. Wedding planning for Kenya and the diaspora.
          </div>
        </div>
      </footer>
    </div>
  );
}
