import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, CheckCircle, Wallet, Users, MessageSquare, ArrowRight, Loader2, Briefcase, Store, Calculator, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import heroImage from '@/assets/hero-wedding.jpg';
import { getHomeRouteForRole, type SignupRole } from '@/lib/roles';
import { getPublicBudgetEstimate, type PublicBudgetEstimateRow } from '@/lib/publicBudgetEstimator';
import { saveEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';
import { UserRoleChooserPanel } from '@/components/UserRoleChooser';

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
        <CardContent className="space-y-4 p-5 sm:space-y-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/12 p-2.5">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-[1.55rem] font-semibold leading-none text-white sm:text-[1.9rem]">Quick Cost Estimate</h3>
              <p className="mt-2 text-sm font-medium text-white">Free, instant, and no sign-up required</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">Number of guests</Label>
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
            <Label htmlFor="hero-county" className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">County</Label>
            <Input
              id="hero-county"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              placeholder="e.g. Nairobi"
              className="h-11 border-border/70 bg-white text-foreground placeholder:text-muted-foreground shadow-sm sm:h-12"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">Wedding style</Label>
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

          <Button onClick={() => void loadEstimate()} className="h-11 w-full gap-2 sm:h-12" disabled={loadingEstimate}>
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
            <div className="mt-3 grid gap-2 text-xs text-white/85 sm:grid-cols-2">
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

function QuickSignupChooser() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<SignupRole>('couple');

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
    >
      <UserRoleChooserPanel
        value={selectedRole}
        onChange={setSelectedRole}
        eyebrow="Start here"
        title="Create your account"
        description="Choose the option that best matches how you want to get started."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1 gap-2" onClick={() => openAuth('signup')}>
            Create account
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => openAuth('signin')}
          >
            I already have an account
          </Button>
        </div>
      </UserRoleChooserPanel>
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-semibold text-foreground">Zania</span>
          </div>
          <a href="#auth" className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 md:hidden">
            Sign In
          </a>
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

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        <div className="overflow-hidden rounded-[24px] border border-border/40 shadow-[0_30px_80px_rgba(62,39,35,0.18)] sm:rounded-[34px]">
          <div className="relative min-h-[640px] sm:min-h-[760px]">
            <img src={heroImage} alt="Kenyan wedding floral arrangement" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,28,24,0.74)_0%,rgba(42,28,24,0.52)_38%,rgba(42,28,24,0.3)_100%)]" />
            <div className="relative grid min-h-[640px] gap-6 px-4 py-5 sm:min-h-[760px] sm:px-6 sm:py-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:px-16 lg:py-12">
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
                  className="mt-5 max-w-3xl font-display text-[2.45rem] font-semibold leading-[0.95] sm:mt-6 sm:text-6xl xl:text-[5.4rem]"
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
                  className="mt-5 max-w-2xl text-lg leading-relaxed text-primary-foreground/86 sm:mt-6 sm:text-xl"
                >
                  Zania helps couples, planners, and committees discover vendors, find planners, and estimate costs in one wedding planning platform built for Kenya.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4"
                >
                  <Link to="/vendors-directory">
                    <Button variant="outline" className="h-12 w-full border-white/40 bg-white/8 px-6 text-base text-white backdrop-blur hover:bg-white/18 hover:text-white sm:min-w-[200px] sm:w-auto">
                      Vendor Directory
                    </Button>
                  </Link>
                  <Link to="/planners">
                    <Button variant="outline" className="h-12 w-full border-white/40 bg-white/8 px-6 text-base text-white backdrop-blur hover:bg-white/18 hover:text-white sm:min-w-[200px] sm:w-auto">
                      Find a Planner
                    </Button>
                  </Link>
                  <a href="#cost-estimator">
                    <Button variant="outline" className="h-12 w-full border-white/40 bg-white/8 px-6 text-base text-white backdrop-blur hover:bg-white/18 hover:text-white sm:min-w-[200px] sm:w-auto">
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

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
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
