import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle,
  ArrowRight,
  Loader2,
  Calculator,
  Sparkles,
  UserRoundPlus,
  LogIn,
  Users,
  Briefcase,
  Store,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getHomeRouteForRole } from '@/lib/roles';
import { getPublicBudgetEstimate, type PublicBudgetEstimateRow } from '@/lib/publicBudgetEstimator';
import { saveEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';
import heroImage from '@/assets/hero-wedding.jpg';
import BrandWordmark from '@/components/BrandWordmark';

const heroStats = [
  { index: '01', title: 'Curated vendors', desc: 'Venues, florals, photography, and more across Kenya.' },
  { index: '02', title: 'Live budget signals', desc: 'Estimator intelligence grounded in real pricing data.' },
  { index: '03', title: 'Diaspora-ready', desc: 'Plan from anywhere while staying anchored at home.' },
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
      <section className="relative overflow-hidden bg-[#120d0b] text-[#f6eee6]">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Zania wedding planning hero"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,9,7,0.82)_0%,rgba(24,16,12,0.64)_34%,rgba(24,15,11,0.58)_58%,rgba(13,9,7,0.78)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(210,152,95,0.18),transparent_25%),radial-gradient(circle_at_86%_18%,rgba(212,187,125,0.14),transparent_20%),linear-gradient(180deg,rgba(19,13,10,0.16)_0%,rgba(19,13,10,0.42)_100%)]" />
        </div>

        <nav className="relative z-20">
          <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-6 py-7 sm:px-8 lg:px-12 xl:px-16">
            <BrandWordmark light size="lg" />
            <Link to="/auth" className="inline-flex h-11 items-center rounded-sm border border-[#e4cf9e]/40 bg-[#d4bb7d]/95 px-5 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#201814] transition-colors hover:bg-[#c2724f] hover:text-[#fffaf4] md:hidden">
              Sign In
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <Link to="/vendors-directory" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Vendors</Link>
              <Link to="/planners" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Planners</Link>
              <Link to="/pricing" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Pricing</Link>
              <a href="#cost-estimator" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Estimator</a>
              <Link to="/auth" className="inline-flex h-11 items-center rounded-sm border border-[#f1dfb6]/28 bg-transparent px-6 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#f6eee6] transition-colors hover:border-[#d4bb7d] hover:bg-[#d4bb7d] hover:text-[#1d1511]">
                Sign In
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[860px] max-w-[1680px] gap-10 px-6 pb-14 pt-12 sm:px-8 lg:grid-cols-[1.18fr_0.82fr] lg:px-12 lg:pb-16 lg:pt-10 xl:px-16">
          <div className="flex flex-col justify-between">
            <div className="max-w-[780px] pt-10 lg:pt-16">
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.55, delay: 0.06 }}
                className="mb-8 h-[2px] w-14 origin-left bg-[#d4bb7d]"
              />
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16 }}
                className="text-[0.72rem] uppercase tracking-[0.36em] text-[#d69d7a]"
              >
                Kenya • Diaspora • Refined planning atelier
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.28 }}
                className="mt-7 max-w-[7.2ch] font-editorial text-[3.7rem] font-medium leading-[0.86] tracking-[-0.03em] text-[#fbf4ec] sm:text-[5.2rem] lg:text-[6.3rem] xl:text-[7.4rem]"
              >
                Your wedding,
                <br />
                <span className="italic font-normal text-[#d4bb7d]">quietly</span>
                <br />
                extraordinary.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.44 }}
                className="mt-8 max-w-2xl text-lg leading-[1.9] text-[#f6eee6]/74 sm:text-[1.17rem]"
              >
                A considered planning workspace for couples in Kenya and across the diaspora, bringing budgets, vendors, guests, and timelines into one warm, beautifully organized place.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.58 }}
                className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <Link to="/auth">
                  <Button className="h-12 rounded-sm bg-[#d4bb7d] px-8 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-[#1f1712] hover:bg-[#c6a660]">
                    Begin planning
                  </Button>
                </Link>
                <Link to="/vendors-directory" className="inline-flex items-center gap-3 text-[0.8rem] font-medium uppercase tracking-[0.26em] text-[#f6eee6]/82 transition-colors hover:text-[#e9d4a9]">
                  Explore vendors
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.74 }}
              className="mt-12 grid gap-5 border-t border-[#f3e4ce]/12 pt-8 sm:grid-cols-3"
            >
              {heroStats.map((stat) => (
                <div key={stat.title} className="space-y-3">
                  <p className="font-editorial text-[1.35rem] leading-none text-[#f5dfbb]">
                    <span className="mr-2 text-[1rem] italic text-[#d4bb7d]/9">{stat.index}</span>
                    {stat.title}
                  </p>
                  <p className="max-w-xs text-sm leading-7 text-[#f6eee6]/58">{stat.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            id="cost-estimator"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.62 }}
            className="flex items-end lg:justify-end"
          >
            <div className="w-full max-w-[600px] rounded-[30px] border border-[#ecd9c7]/12 bg-[linear-gradient(180deg,rgba(32,23,19,0.9),rgba(28,20,17,0.96))] p-4 shadow-[0_28px_85px_rgba(8,5,4,0.38)] backdrop-blur-md sm:p-5 lg:mb-8">
              <PublicBudgetEstimator compact />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 py-14 sm:px-8 sm:py-18 lg:px-12">
        <div>
          <QuickSignupChooser />
        </div>
      </section>

      <footer className="bg-[#1c1612] px-6 py-8 text-[#f6eee6]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm sm:flex-row lg:px-2">
          <BrandWordmark light size="md" />
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
