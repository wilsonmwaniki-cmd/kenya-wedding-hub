import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ArrowUpRight, Banknote, Gift, HandCoins, HeartHandshake, Loader2, Users } from 'lucide-react';

type SharedRound = {
  title: string;
  goal_amount: number;
  pledged_cash: number;
  collected_cash: number;
  in_kind_value: number;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  notes: string | null;
};

type SharedContributionSummary = {
  workspace_title: string;
  workspace_subtitle: string;
  budget_target: number;
  pledged_cash: number;
  collected_cash: number;
  in_kind_value: number;
  total_support: number;
  outstanding_pledges: number;
  pending_count: number;
  contributor_count: number;
  rounds: SharedRound[];
};

function formatCurrency(value: number | null | undefined) {
  return `KES ${Number(value ?? 0).toLocaleString()}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ContributionsShare() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [summary, setSummary] = useState<SharedContributionSummary | null>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      setNotFound(false);
      const { data, error } = await supabase.rpc('get_shared_contributions_summary', { _share_token: token });

      if (error || !data) {
        setSummary(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setSummary(data as unknown as SharedContributionSummary);
      setLoading(false);
    };

    void load();
  }, [token]);

  const fundingTarget = summary?.budget_target ?? 0;
  const coveragePercentage = useMemo(() => {
    if (!summary || fundingTarget <= 0) return 0;
    return Math.min((summary.total_support / fundingTarget) * 100, 100);
  }, [summary, fundingTarget]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading contribution summary...
        </div>
      </div>
    );
  }

  if (notFound || !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <HeartHandshake className="mx-auto h-10 w-10 text-primary/60" />
          <h1 className="mt-4 font-display text-3xl font-bold text-foreground">Contribution summary not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link may have expired or been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-primary/15 bg-white/92 p-6 shadow-card sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Zania Contributions</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-foreground">{summary.workspace_title}</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{summary.workspace_subtitle}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-border/60 bg-background/75 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Support raised</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{formatCurrency(summary.total_support)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Against a wedding target of {formatCurrency(summary.budget_target)}</p>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {summary.pending_count} pledge{summary.pending_count === 1 ? '' : 's'} pending
                </Badge>
              </div>
              <div className="mt-5">
                <Progress value={coveragePercentage} className="h-2.5" />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Math.round(coveragePercentage)}% covered</span>
                  <span>{formatCurrency(summary.outstanding_pledges)} still pledged</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Supporters tracked</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{summary.contributor_count}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Rounds</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{summary.rounds.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Wedding target</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Banknote className="h-5 w-5 text-primary" />
                {formatCurrency(summary.budget_target)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Pledged cash</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <HandCoins className="h-5 w-5 text-primary" />
                {formatCurrency(summary.pledged_cash)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Collected cash</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                {formatCurrency(summary.collected_cash)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>In-kind support</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Gift className="h-5 w-5 text-primary" />
                {formatCurrency(summary.in_kind_value)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Still pending</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Users className="h-5 w-5 text-primary" />
                {formatCurrency(summary.outstanding_pledges)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="mt-6 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Fundraising rounds</CardTitle>
            <CardDescription>Each committee drive or meeting can be tracked separately while still rolling into the overall wedding fund.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.rounds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                No rounds have been published for this summary yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {summary.rounds.map((round) => (
                  <div key={`${round.title}-${round.starts_on ?? 'na'}`} className="rounded-2xl border border-border/70 bg-background/75 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{round.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Goal {formatCurrency(round.goal_amount)}</p>
                      </div>
                      <Badge variant={round.is_active ? 'default' : 'outline'} className="rounded-full">
                        {round.is_active ? 'Active' : 'Closed'}
                      </Badge>
                    </div>
                    {(round.starts_on || round.ends_on) ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {formatDate(round.starts_on)} {round.ends_on ? `to ${formatDate(round.ends_on)}` : ''}
                      </p>
                    ) : null}
                    {round.notes ? <p className="mt-3 text-sm text-muted-foreground">{round.notes}</p> : null}
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/60 bg-white/80 p-3">
                        <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Pledged</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(round.pledged_cash)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-white/80 p-3">
                        <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Paid</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(round.collected_cash)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-white/80 p-3">
                        <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">In-kind</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(round.in_kind_value)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
