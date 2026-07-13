import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getHomeRouteForRole } from '@/lib/roles';
import { getPublicBudgetEstimate, type PublicBudgetEstimateRow } from '@/lib/publicBudgetEstimator';
import { getPublicPlatformStats, type PublicPlatformStats } from '@/lib/publicPlatformStats';
import { saveEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';
import { kenyaCounties } from '@/lib/kenyaLocations';
import heroImage from '@/assets/hero-wedding.jpg';
import BrandWordmark from '@/components/BrandWordmark';
import { PublicPageSkeleton } from '@/components/AppLoadingSkeletons';
import PublicSiteFooter from '@/components/PublicSiteFooter';

const heroStats = [
  { index: '01', title: 'Planning workspace', desc: 'Keep guests, budgets, tasks, documents, and vendor notes in one place.' },
  { index: '02', title: 'Private vendor tracking', desc: 'Add the vendors you already have now, then invite them to join later.' },
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
    navigate('/auth?mode=signup');
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
      <Card className="border-white/16 bg-[linear-gradient(180deg,rgba(30,22,19,0.94),rgba(38,28,24,0.9))] shadow-[0_30px_90px_rgba(14,9,7,0.34)] backdrop-blur-md">
        <CardContent className="space-y-6 p-6 sm:space-y-7 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-[#ead7c4]/18 bg-[#c9a96e]/10 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#ead4aa]">
              Estimator
            </div>
            <div className="space-y-2">
              <h3 className="marketing-h3 text-[#f7efe7]">Quick Cost Estimate</h3>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#dcb188]">Free, instant, and no sign-up required</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7efe7]">Number of guests</Label>
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
              <Label htmlFor="hero-county" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7efe7]">County</Label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger id="hero-county" className="h-11 border-border/70 bg-white text-foreground shadow-sm sm:h-12">
                  <SelectValue placeholder="Choose a county" />
                </SelectTrigger>
                <SelectContent>
                  {kenyaCounties.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7efe7]">Wedding style</Label>
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
          </div>

          <Button onClick={() => void loadEstimate()} className="h-11 w-full gap-2 border border-[#ce7d57] bg-[#c2724f] text-[#fff8f1] hover:bg-[#a85c3c] sm:h-12" disabled={loadingEstimate}>
            {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Get Estimate
          </Button>

          <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[24px] border border-[#ead7c4]/14 bg-[rgba(15,10,8,0.28)] p-5">
              <p className="text-sm font-medium text-[#f7efe7]">Estimated total budget</p>
              <p className="marketing-h3 mt-2 text-[#fff8f1]">{formatCurrency(totals.suggested)}</p>
              <p className="mt-3 text-xs font-medium text-[#f7efe7]">
                Working range {formatCurrency(totals.low)} - {formatCurrency(totals.high)}
              </p>
            </div>

            <div className="rounded-[24px] border border-[#ead7c4]/14 bg-[rgba(255,255,255,0.05)] p-5">
              <p className="text-sm font-medium text-[#f7efe7]">Estimate confidence</p>
              <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[#fff8f1]">
                {totals.marketCount}/{estimateRows.length || 0}
              </p>
              <p className="mt-3 text-xs font-medium text-[#f7efe7]/78">
                categories using live market observations
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#ead7c4]/14 bg-[rgba(255,255,255,0.05)] p-5">
            <p className="text-sm font-medium text-[#f7efe7]">What your estimate includes</p>
            <div className="mt-4 grid gap-3 text-xs text-[#f7efe7]/85 sm:grid-cols-2">
              {estimateRows.slice(0, 4).map((row) => (
                <div key={row.category} className="rounded-2xl border border-[#ead7c4]/12 bg-[rgba(13,10,8,0.24)] px-4 py-3">
                  <p className="font-medium text-[#fff8f1]">{row.category}</p>
                  <p className="mt-1 font-medium text-[#f4dfc8]">{formatCurrency(row.suggested_amount)}</p>
                </div>
              ))}
            </div>
          </div>

          <Button variant="outline" className="h-11 w-full gap-2 border-[#ead7c4]/24 bg-[#f6efe8] text-[#241814] hover:bg-[#eadfcf]" onClick={handleTurnIntoPlan} disabled={startingPlan}>
            {startingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Turn This Into a Plan</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/95 shadow-warm backdrop-blur-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
            Estimator
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Cost Estimator</p>
            <h3 className="marketing-h3 mt-1 text-foreground">
              Start with a realistic budget
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use live Kenyan wedding pricing signals before you lock the rest of your plan.
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
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger id="county">
                <SelectValue placeholder="Choose a county" />
              </SelectTrigger>
              <SelectContent>
                {kenyaCounties.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <p className="marketing-h3 mt-2 text-foreground">{formatCurrency(totals.suggested)}</p>
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
            {loadingEstimate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh Estimate
          </Button>
          <Button variant="outline" className="w-full gap-2 sm:flex-1" onClick={handleTurnIntoPlan} disabled={startingPlan}>
            {startingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Turn This Into a Plan</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Early estimate only. Sign up to turn this into a working wedding workspace with vendors, guests, tasks, and approvals.
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
      <div className="rounded-[30px] border border-[#ead7c4]/32 bg-[linear-gradient(180deg,#f8f2ea,#f1e5d7)] p-6 shadow-[0_28px_60px_rgba(42,25,20,0.16)] backdrop-blur-sm sm:p-8 lg:p-10">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c2724f]">Start here</p>
          <h3 className="marketing-h2 text-[#201814]">Start planning before anyone else joins.</h3>
          <p className="max-w-2xl text-sm leading-7 text-[#6f5747]">
            Create your account once, open your wedding workspace, and start adding the guests, budgets, and vendors you already have. Planners and vendors can join later.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:max-w-3xl">
          <div className="rounded-[24px] border border-[#d9b79d] bg-[rgba(255,255,255,0.45)] p-5 shadow-[0_12px_28px_rgba(194,114,79,0.1)] sm:p-6">
            <div className="space-y-2">
              <p className="marketing-h4 text-[#201814]">Create your Zania account</p>
              <p className="max-w-2xl text-sm leading-7 text-[#6f5747]">
                Start with your name, email, and password. Couples can begin planning immediately, even if their vendors are still off-platform.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:max-w-md">
              <Button
                className="gap-2"
                onClick={() => navigate('/auth?mode=signup')}
              >
                Sign up to Zania
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-[#d6b698] bg-[#fffaf4] text-[#241814] hover:bg-[#f3e5d7]"
                onClick={() => navigate('/sign-in')}
              >
                I already have an account
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="ghost"
                className="justify-start px-0 text-[#a85c3c] hover:bg-transparent hover:text-[#8f4f34]"
                onClick={() => navigate('/auth?mode=signup&flow=join_wedding&audience=couple')}
              >
                I already have a wedding code
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="justify-start px-0 text-[#a85c3c] hover:bg-transparent hover:text-[#8f4f34]"
                onClick={() => navigate('/auth?mode=signup&audience=professional&role=vendor')}
              >
                Claim a vendor profile
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
  const [platformStats, setPlatformStats] = useState<PublicPlatformStats | null>(null);
  const workspaceRoute = user ? getHomeRouteForRole(profile?.role, profile?.planner_type) : '/dashboard';
  const signInRoute = '/sign-in';
  const primaryCtaLabel = user ? 'Continue to workspace' : 'Sign up free';
  const secondaryCtaLabel = user ? 'Open workspace' : 'Sign In';

  useEffect(() => {
    let ignore = false;

    getPublicPlatformStats()
      .then((stats) => {
        if (!ignore) setPlatformStats(stats);
      })
      .catch((error) => {
        console.error('Could not load public platform stats:', error);
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return <PublicPageSkeleton card={false} />;
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
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-6 py-7 sm:px-8 lg:px-12 xl:px-16">
            <BrandWordmark light size="lg" />
            <Link to={user ? workspaceRoute : signInRoute} className="inline-flex h-11 items-center rounded-sm border border-[#e4cf9e]/40 bg-[#d4bb7d]/95 px-5 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#201814] transition-colors hover:bg-[#c2724f] hover:text-[#fffaf4] md:hidden">
              {secondaryCtaLabel}
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <Link to="/vendors-directory" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Find vendors</Link>
              <Link to="/planners" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Planners</Link>
              <Link to="/pricing" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Pricing</Link>
              <a href="#cost-estimator" className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#f6eee6]/72 transition-colors hover:text-[#e9d4a9]">Estimator</a>
              <Link to={user ? workspaceRoute : signInRoute} className="inline-flex h-11 items-center rounded-sm border border-[#f1dfb6]/28 bg-transparent px-6 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#f6eee6] transition-colors hover:border-[#d4bb7d] hover:bg-[#d4bb7d] hover:text-[#1d1511]">
                {secondaryCtaLabel}
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[900px] max-w-[1600px] gap-12 px-6 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-12 lg:pb-20 lg:pt-10 xl:px-16">
          <div className="flex flex-col justify-between">
            <div className="max-w-[700px] pt-10 lg:pt-18">
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
                Kenya • Diaspora • Wedding planning workspace
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.28 }}
                className="marketing-h1 mt-7 max-w-[9.3ch] text-[#fbf4ec]"
              >
                Plan your wedding,
                <br />
                <span className="font-semibold text-[#d4bb7d]">all in one</span>
                <br />
                place.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.44 }}
                className="mt-10 max-w-[34rem] text-base leading-8 text-[#f6eee6]/74 sm:text-[17px]"
              >
                Zania gives couples one wedding workspace for budgets, guests, tasks, documents, payments, and vendor coordination. Your vendors do not need to be on Zania yet. Add them yourself now and invite them later if you want.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.58 }}
                className="mt-12 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <Link
                  to={user ? workspaceRoute : '/auth?mode=signup'}
                >
                  <Button className="h-12 rounded-sm bg-[#d4bb7d] px-8 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-[#1f1712] hover:bg-[#c6a660]">
                    {primaryCtaLabel}
                  </Button>
                </Link>
                {user ? (
                  <p className="text-sm leading-7 text-[#f6eee6]/70">
                    You’re signed in. Explore publicly, then jump back into your workspace whenever you’re ready.
                  </p>
                ) : (
                  <Link to="#cost-estimator" className="inline-flex items-center gap-3 text-[0.8rem] font-medium uppercase tracking-[0.26em] text-[#f6eee6]/82 transition-colors hover:text-[#e9d4a9]">
                    Try the estimator
                    <span aria-hidden="true">/</span>
                  </Link>
                )}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.66 }}
                className="mt-8 inline-flex w-fit items-center gap-3 rounded-full border border-[#ead7b5]/18 bg-[#fff7eb]/10 px-5 py-3 text-[#f8ead9] shadow-[0_18px_40px_rgba(10,6,4,0.18)] backdrop-blur-sm"
                aria-live="polite"
              >
                <span className="h-2 w-2 rounded-full bg-[#d4bb7d] shadow-[0_0_18px_rgba(212,187,125,0.9)]" />
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4bb7d]">
                  {platformStats?.weddingPlansStartedDisplay ?? '...'}
                </span>
                <span className="text-sm text-[#f6eee6]/78">wedding plans started on Zania</span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.74 }}
              className="mt-16 grid gap-6 border-t border-[#f3e4ce]/12 pt-10 sm:grid-cols-3"
            >
              {heroStats.map((stat) => (
                <div key={stat.title} className="space-y-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-5 backdrop-blur-[2px]">
                  <p className="marketing-h4 text-[#f5dfbb]">
                    <span className="mr-2 text-sm text-[#d4bb7d]/50">{stat.index}</span>
                    {stat.title}
                  </p>
                  <p className="max-w-[16rem] text-sm leading-7 text-[#f6eee6]/58">{stat.desc}</p>
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
            <div className="w-full max-w-[540px] rounded-[34px] border border-[#ecd9c7]/12 bg-[linear-gradient(180deg,rgba(32,23,19,0.9),rgba(28,20,17,0.96))] p-4 shadow-[0_28px_85px_rgba(8,5,4,0.38)] backdrop-blur-md sm:p-5 lg:mb-10">
              <PublicBudgetEstimator compact />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div>
          <QuickSignupChooser />
        </div>
      </section>

      <PublicSiteFooter dark />
    </div>
  );
}
