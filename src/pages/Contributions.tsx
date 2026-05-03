import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import {
  contributionPaymentMethodLabel,
  contributionPaymentMethodOptions,
  contributionStatusLabel,
  contributionStatusOptions,
  contributionStatusTone,
  contributionTypeLabel,
  contributionTypeOptions,
  summarizeContributions,
} from '@/lib/contributions';
import { downloadCsv, safeDateLabel } from '@/lib/exportHelpers';
import { ArrowUpRight, Banknote, CalendarDays, Download, Gift, HandCoins, Loader2, Plus, Trash2, Users } from 'lucide-react';

type ContributionRound = {
  id: string;
  title: string;
  goal_amount: number;
  notes: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
};

type ContributionRow = {
  id: string;
  round_id: string | null;
  contributor_name: string;
  contributor_phone: string | null;
  contributor_group: string | null;
  contribution_type: string;
  status: string;
  payment_method: string;
  pledged_amount: number;
  paid_amount: number;
  in_kind_value: number;
  in_kind_item: string | null;
  purpose: string | null;
  paid_on: string | null;
  notes: string | null;
  created_at: string;
};

type ContributionFormState = {
  contributorName: string;
  contributorPhone: string;
  contributorGroup: string;
  roundId: string;
  contributionType: 'cash' | 'in_kind';
  status: 'pledged' | 'partial' | 'paid' | 'in_kind' | 'cancelled';
  paymentMethod: 'mpesa' | 'cash' | 'bank' | 'other' | 'in_kind';
  pledgedAmount: string;
  paidAmount: string;
  inKindValue: string;
  inKindItem: string;
  purpose: string;
  paidOn: string;
  notes: string;
};

type RoundFormState = {
  title: string;
  goalAmount: string;
  startsOn: string;
  endsOn: string;
  notes: string;
  isActive: boolean;
};

const CONTRIBUTOR_GROUP_OPTIONS = [
  'Family',
  'Friends',
  'Committee',
  'Chama',
  'Church',
  'Workmates',
  'Neighbourhood',
  'Vendor sponsor',
  'Other',
];

function emptyContributionForm(roundId = 'none'): ContributionFormState {
  return {
    contributorName: '',
    contributorPhone: '',
    contributorGroup: '',
    roundId,
    contributionType: 'cash',
    status: 'pledged',
    paymentMethod: 'mpesa',
    pledgedAmount: '',
    paidAmount: '',
    inKindValue: '',
    inKindItem: '',
    purpose: '',
    paidOn: '',
    notes: '',
  };
}

function emptyRoundForm(): RoundFormState {
  return {
    title: '',
    goalAmount: '',
    startsOn: '',
    endsOn: '',
    notes: '',
    isActive: true,
  };
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return `KES ${amount.toLocaleString()}`;
}

export default function Contributions() {
  const { user } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const db = supabase as any;

  const [loading, setLoading] = useState(true);
  const [savingContribution, setSavingContribution] = useState(false);
  const [savingRound, setSavingRound] = useState(false);
  const [rounds, setRounds] = useState<ContributionRound[]>([]);
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [budgetTarget, setBudgetTarget] = useState(0);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('all');
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [roundDialogOpen, setRoundDialogOpen] = useState(false);
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [contributionForm, setContributionForm] = useState<ContributionFormState>(emptyContributionForm());
  const [roundForm, setRoundForm] = useState<RoundFormState>(emptyRoundForm());

  useEffect(() => {
    if (isPlanner && !selectedClient) {
      navigate('/clients');
    }
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!user || !dataOrFilter) return;
    setLoading(true);
    try {
      const [roundResult, contributionResult, budgetResult] = await Promise.all([
        db.from('contribution_rounds').select('*').or(dataOrFilter).order('starts_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
        db.from('wedding_contributions').select('*').or(dataOrFilter).order('created_at', { ascending: false }),
        supabase.from('budget_categories').select('allocated').or(dataOrFilter).eq('budget_scope', 'wedding'),
      ]);

      if (roundResult.error) throw roundResult.error;
      if (contributionResult.error) throw contributionResult.error;
      if (budgetResult.error) throw budgetResult.error;

      setRounds(((roundResult.data ?? []) as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        goal_amount: Number(row.goal_amount ?? 0),
        notes: row.notes ?? null,
        starts_on: row.starts_on ?? null,
        ends_on: row.ends_on ?? null,
        is_active: row.is_active !== false,
      })));
      setRows(((contributionResult.data ?? []) as any[]).map((row) => ({
        ...row,
        pledged_amount: Number(row.pledged_amount ?? 0),
        paid_amount: Number(row.paid_amount ?? 0),
        in_kind_value: Number(row.in_kind_value ?? 0),
      })));
      setBudgetTarget((budgetResult.data ?? []).reduce((sum, row) => sum + Number(row.allocated ?? 0), 0));
    } catch (error: any) {
      toast({
        title: 'Could not load contributions',
        description: error?.message || 'There was a problem loading your wedding contributions.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user, dataOrFilter]);

  const filteredRows = useMemo(() => {
    if (selectedRoundId === 'all') return rows;
    if (selectedRoundId === 'unassigned') return rows.filter((row) => !row.round_id);
    return rows.filter((row) => row.round_id === selectedRoundId);
  }, [rows, selectedRoundId]);

  const summary = useMemo(() => summarizeContributions(filteredRows), [filteredRows]);
  const currentRound = useMemo(
    () => rounds.find((round) => round.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId],
  );
  const activeGoal = selectedRoundId !== 'all'
    ? currentRound?.goal_amount ?? 0
    : rounds.reduce((sum, round) => sum + round.goal_amount, 0) || budgetTarget;
  const fundingTarget = activeGoal > 0 ? activeGoal : budgetTarget;
  const fundingGap = Math.max(fundingTarget - summary.totalSupport, 0);
  const coveragePercentage = fundingTarget > 0 ? Math.min((summary.totalSupport / fundingTarget) * 100, 100) : 0;
  const activeRounds = rounds.filter((round) => round.is_active).length;
  const selectedRoundLabel =
    selectedRoundId === 'all'
      ? 'All rounds'
      : selectedRoundId === 'unassigned'
        ? 'Unassigned contributions'
        : currentRound?.title ?? 'Selected round';

  const resetContributionForm = (roundId = 'none') => {
    setEditingContributionId(null);
    setContributionForm(emptyContributionForm(roundId));
  };

  const openCreateContribution = () => {
    resetContributionForm(selectedRoundId === 'all' ? 'none' : selectedRoundId);
    setContributionDialogOpen(true);
  };

  const openEditContribution = (row: ContributionRow) => {
    setEditingContributionId(row.id);
    setContributionForm({
      contributorName: row.contributor_name,
      contributorPhone: row.contributor_phone ?? '',
      contributorGroup: row.contributor_group ?? '',
      roundId: row.round_id ?? 'none',
      contributionType: (row.contribution_type === 'in_kind' ? 'in_kind' : 'cash'),
      status: (contributionStatusOptions.includes(row.status as any) ? row.status : 'pledged') as ContributionFormState['status'],
      paymentMethod: (contributionPaymentMethodOptions.includes(row.payment_method as any) ? row.payment_method : 'mpesa') as ContributionFormState['paymentMethod'],
      pledgedAmount: row.pledged_amount ? String(row.pledged_amount) : '',
      paidAmount: row.paid_amount ? String(row.paid_amount) : '',
      inKindValue: row.in_kind_value ? String(row.in_kind_value) : '',
      inKindItem: row.in_kind_item ?? '',
      purpose: row.purpose ?? '',
      paidOn: row.paid_on ?? '',
      notes: row.notes ?? '',
    });
    setContributionDialogOpen(true);
  };

  const saveRound = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!roundForm.title.trim()) {
      toast({ title: 'Add a round name', description: 'Give this fundraising round a clear name before saving.', variant: 'destructive' });
      return;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      title: roundForm.title.trim(),
      goal_amount: Number(roundForm.goalAmount || 0),
      notes: roundForm.notes.trim() || null,
      starts_on: roundForm.startsOn || null,
      ends_on: roundForm.endsOn || null,
      is_active: roundForm.isActive,
    };
    if (isPlanner && selectedClient) payload.client_id = selectedClient.id;

    setSavingRound(true);
    const { error } = await db.from('contribution_rounds').insert(payload);
    setSavingRound(false);

    if (error) {
      toast({ title: 'Could not save round', description: error.message, variant: 'destructive' });
      return;
    }

    setRoundDialogOpen(false);
    setRoundForm(emptyRoundForm());
    toast({ title: 'Round saved', description: 'The fundraising round is ready to use.' });
    await load();
  };

  const saveContribution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!contributionForm.contributorName.trim()) {
      toast({ title: 'Add a contributor name', description: 'Capture who made the pledge or contribution.', variant: 'destructive' });
      return;
    }

    const isInKind = contributionForm.contributionType === 'in_kind';
    if (isInKind && !contributionForm.inKindItem.trim()) {
      toast({ title: 'Add the in-kind item', description: 'Describe the goods or support being contributed.', variant: 'destructive' });
      return;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      round_id: contributionForm.roundId === 'none' ? null : contributionForm.roundId,
      contributor_name: contributionForm.contributorName.trim(),
      contributor_phone: contributionForm.contributorPhone.trim() || null,
      contributor_group: contributionForm.contributorGroup || null,
      contribution_type: contributionForm.contributionType,
      status: contributionForm.status,
      payment_method: isInKind ? 'in_kind' : contributionForm.paymentMethod,
      pledged_amount: Number(contributionForm.pledgedAmount || 0),
      paid_amount: Number(contributionForm.paidAmount || 0),
      in_kind_value: Number(contributionForm.inKindValue || 0),
      in_kind_item: contributionForm.inKindItem.trim() || null,
      purpose: contributionForm.purpose.trim() || null,
      paid_on: contributionForm.paidOn || null,
      notes: contributionForm.notes.trim() || null,
    };
    if (isPlanner && selectedClient) payload.client_id = selectedClient.id;

    setSavingContribution(true);
    const query = editingContributionId
      ? db.from('wedding_contributions').update(payload).eq('id', editingContributionId)
      : db.from('wedding_contributions').insert(payload);
    const { error } = await query;
    setSavingContribution(false);

    if (error) {
      toast({ title: 'Could not save contribution', description: error.message, variant: 'destructive' });
      return;
    }

    setContributionDialogOpen(false);
    resetContributionForm(selectedRoundId === 'all' ? 'none' : selectedRoundId);
    toast({ title: editingContributionId ? 'Contribution updated' : 'Contribution added' });
    await load();
  };

  const deleteContribution = async (id: string) => {
    const { error } = await db.from('wedding_contributions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete contribution', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Contribution removed' });
    await load();
  };

  const exportContributions = () => {
    downloadCsv(
      `zania-contributions-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredRows.map((row) => ({
        contributor_name: row.contributor_name,
        contributor_group: row.contributor_group ?? '',
        contributor_phone: row.contributor_phone ?? '',
        round: rounds.find((round) => round.id === row.round_id)?.title ?? '',
        type: contributionTypeLabel(row.contribution_type),
        status: contributionStatusLabel(row.status),
        payment_method: contributionPaymentMethodLabel(row.payment_method),
        pledged_amount_kes: row.pledged_amount,
        paid_amount_kes: row.paid_amount,
        in_kind_value_kes: row.in_kind_value,
        in_kind_item: row.in_kind_item ?? '',
        purpose: row.purpose ?? '',
        paid_on: safeDateLabel(row.paid_on),
        notes: row.notes ?? '',
      })),
    );
  };

  if (isPlanner && !selectedClient) return null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 shadow-card">
        <CardContent className="grid gap-5 bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.14),transparent_42%),linear-gradient(180deg,rgba(255,249,246,0.96),rgba(255,255,255,0.98))] p-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Committee Contributions</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Wedding Contributions</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Track harambee pledges, contributions received, in-kind support, and the remaining funding gap without leaving the wedding workspace.
            </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-primary/15 bg-white/85 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Track promises</p>
                <p className="mt-2 text-sm text-foreground">Log who pledged, how much, and which round or meeting it came from.</p>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-white/85 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Record support</p>
                <p className="mt-2 text-sm text-foreground">Capture paid cash and in-kind help like chairs, food, transport, or cake support.</p>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-white/85 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">See the gap</p>
                <p className="mt-2 text-sm text-foreground">Compare real support against the wedding budget so the committee knows what is still uncovered.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={openCreateContribution} className="gap-2">
                <Plus className="h-4 w-4" />
                Add contribution
              </Button>
              <Button variant="outline" onClick={() => setRoundDialogOpen(true)} className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Add round
              </Button>
              <Button variant="outline" onClick={exportContributions} disabled={filteredRows.length === 0} className="gap-2">
                <Download className="h-4 w-4" />
                Export summary
              </Button>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-background/90 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {selectedRoundId === 'all' ? 'Overall progress' : currentRound?.title ?? 'Selected round'}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{formatCurrency(summary.totalSupport)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Raised against a target of {formatCurrency(fundingTarget)}
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {summary.pendingCount} pledge{summary.pendingCount === 1 ? '' : 's'} pending
              </Badge>
            </div>
            <div className="mt-4">
              <Progress value={coveragePercentage} className="h-2" />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(coveragePercentage)}% covered</span>
                <span>{formatCurrency(fundingGap)} gap remaining</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Active rounds</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{activeRounds}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rounds.length ? `${rounds.length} total round${rounds.length === 1 ? '' : 's'} tracked` : 'No fundraising rounds yet'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Current view</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{selectedRoundLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {filteredRows.length} contribution{filteredRows.length === 1 ? '' : 's'} shown in this view
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Wedding target</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Banknote className="h-5 w-5 text-primary" />
              {formatCurrency(budgetTarget)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Current wedding budget target</p>
          </CardHeader>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Pledged cash</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <HandCoins className="h-5 w-5 text-primary" />
              {formatCurrency(summary.pledgedCash)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Promises recorded so far</p>
          </CardHeader>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Collected cash</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
              {formatCurrency(summary.collectedCash)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Money already received</p>
          </CardHeader>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>In-kind value</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Gift className="h-5 w-5 text-primary" />
              {formatCurrency(summary.inKindValue)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Goods and services pledged</p>
          </CardHeader>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Supporters tracked</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="h-5 w-5 text-primary" />
              {summary.contributorCount}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Unique contributors recorded</p>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Fundraising rounds</CardTitle>
          <CardDescription>Track each family meeting, committee drive, or church fundraiser separately when needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={selectedRoundId === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedRoundId('all')}
            >
              All rounds
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedRoundId === 'unassigned' ? 'default' : 'outline'}
              onClick={() => setSelectedRoundId('unassigned')}
            >
              Unassigned
            </Button>
            {rounds.map((round) => (
              <Button
                key={round.id}
                type="button"
                size="sm"
                variant={selectedRoundId === round.id ? 'default' : 'outline'}
                onClick={() => setSelectedRoundId(round.id)}
              >
                {round.title}
              </Button>
            ))}
          </div>
          {rounds.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rounds.map((round) => (
                <div key={round.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{round.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Goal {formatCurrency(round.goal_amount)}
                      </p>
                    </div>
                    <Badge variant={round.is_active ? 'default' : 'outline'} className="rounded-full">
                      {round.is_active ? 'Active' : 'Closed'}
                    </Badge>
                  </div>
                  {(round.starts_on || round.ends_on) && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {safeDateLabel(round.starts_on)} {round.ends_on ? `to ${safeDateLabel(round.ends_on)}` : ''}
                    </p>
                  )}
                  {round.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">{round.notes}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-6">
              <p className="text-sm font-medium text-foreground">No rounds yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a round for each fundraiser, family meeting, church drive, or committee collection if you want to track them separately.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Contribution tracker</CardTitle>
          <CardDescription>
            Log pledges, fulfilled payments, and in-kind support so the couple and committee always know the real funding position.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/10 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedRoundLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredRows.length
                  ? `Showing ${filteredRows.length} contribution record${filteredRows.length === 1 ? '' : 's'} for this view.`
                  : 'No contribution records match this view yet.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full">Outstanding {formatCurrency(summary.outstandingPledges)}</Badge>
              <Badge variant="outline" className="rounded-full">Collected {formatCurrency(summary.collectedCash)}</Badge>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contributions...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-6">
              <p className="text-sm font-medium text-foreground">No contributions recorded yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start by adding a pledge, a payment already received, or in-kind support like chairs, goats, transport, or catering items.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRows.map((row) => {
                const round = rounds.find((item) => item.id === row.round_id);
                const rowOutstanding = Math.max(row.pledged_amount - row.paid_amount, 0);
                return (
                  <div key={row.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{row.contributor_name}</p>
                          <Badge variant={contributionStatusTone(row.status)} className="rounded-full">
                            {contributionStatusLabel(row.status)}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {contributionTypeLabel(row.contribution_type)}
                          </Badge>
                          {round && (
                            <Badge variant="outline" className="rounded-full">
                              {round.title}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          {row.contributor_group ? <span>{row.contributor_group}</span> : null}
                          {row.contributor_phone ? <span>{row.contributor_phone}</span> : null}
                          {row.paid_on ? <span>Paid {safeDateLabel(row.paid_on)}</span> : null}
                          <span>{contributionPaymentMethodLabel(row.payment_method)}</span>
                        </div>
                        {row.purpose && (
                          <p className="text-sm text-muted-foreground">For: {row.purpose}</p>
                        )}
                        {row.in_kind_item && (
                          <p className="text-sm text-muted-foreground">In-kind item: {row.in_kind_item}</p>
                        )}
                        {row.notes && (
                          <p className="text-sm text-muted-foreground">{row.notes}</p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {rowOutstanding > 0 && row.contribution_type !== 'in_kind' ? (
                            <Badge variant="outline" className="rounded-full">
                              Outstanding {formatCurrency(rowOutstanding)}
                            </Badge>
                          ) : null}
                          {row.paid_amount > 0 ? (
                            <Badge variant="outline" className="rounded-full">
                              Cash received {formatCurrency(row.paid_amount)}
                            </Badge>
                          ) : null}
                          {row.in_kind_value > 0 ? (
                            <Badge variant="outline" className="rounded-full">
                              In-kind value {formatCurrency(row.in_kind_value)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid min-w-[250px] gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Pledged</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(row.pledged_amount)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Paid</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(row.paid_amount)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">In-kind</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(row.in_kind_value)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:col-span-3 xl:col-span-1">
                          <Button variant="outline" size="sm" onClick={() => openEditContribution(row)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void deleteContribution(row.id)}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={roundDialogOpen} onOpenChange={setRoundDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Add fundraising round</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveRound} className="space-y-4">
            <div className="space-y-2">
              <Label>Round name</Label>
              <Input
                value={roundForm.title}
                onChange={(event) => setRoundForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. First family harambee"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Goal amount (KES)</Label>
                <Input
                  type="number"
                  value={roundForm.goalAmount}
                  onChange={(event) => setRoundForm((current) => ({ ...current, goalAmount: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={roundForm.isActive ? 'active' : 'closed'}
                  onValueChange={(value) => setRoundForm((current) => ({ ...current, isActive: value === 'active' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Starts on</Label>
                <Input
                  type="date"
                  value={roundForm.startsOn}
                  onChange={(event) => setRoundForm((current) => ({ ...current, startsOn: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends on</Label>
                <Input
                  type="date"
                  value={roundForm.endsOn}
                  onChange={(event) => setRoundForm((current) => ({ ...current, endsOn: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={roundForm.notes}
                onChange={(event) => setRoundForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Anything the committee should remember about this round."
              />
            </div>
            <Button type="submit" disabled={savingRound} className="w-full">
              {savingRound ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save round
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={contributionDialogOpen} onOpenChange={setContributionDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editingContributionId ? 'Edit contribution' : 'Add contribution'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveContribution} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Contributor name</Label>
                <Input
                  value={contributionForm.contributorName}
                  onChange={(event) => setContributionForm((current) => ({ ...current, contributorName: event.target.value }))}
                  placeholder="e.g. Auntie Mary"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone number</Label>
                <Input
                  value={contributionForm.contributorPhone}
                  onChange={(event) => setContributionForm((current) => ({ ...current, contributorPhone: event.target.value }))}
                  placeholder="+2547..."
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Group</Label>
                <Select
                  value={contributionForm.contributorGroup || 'none'}
                  onValueChange={(value) => setContributionForm((current) => ({ ...current, contributorGroup: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {CONTRIBUTOR_GROUP_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Round</Label>
                <Select
                  value={contributionForm.roundId}
                  onValueChange={(value) => setContributionForm((current) => ({ ...current, roundId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign round" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No round</SelectItem>
                    {rounds.map((round) => (
                      <SelectItem key={round.id} value={round.id}>{round.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={contributionForm.contributionType}
                  onValueChange={(value) => {
                    const nextType = value as ContributionFormState['contributionType'];
                    setContributionForm((current) => ({
                      ...current,
                      contributionType: nextType,
                      paymentMethod: nextType === 'in_kind' ? 'in_kind' : current.paymentMethod === 'in_kind' ? 'mpesa' : current.paymentMethod,
                      status: nextType === 'in_kind' ? 'in_kind' : current.status === 'in_kind' ? 'pledged' : current.status,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contributionTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {contributionTypeLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={contributionForm.status}
                  onValueChange={(value) => setContributionForm((current) => ({ ...current, status: value as ContributionFormState['status'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contributionStatusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {contributionStatusLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select
                  value={contributionForm.paymentMethod}
                  onValueChange={(value) => setContributionForm((current) => ({ ...current, paymentMethod: value as ContributionFormState['paymentMethod'] }))}
                  disabled={contributionForm.contributionType === 'in_kind'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contributionPaymentMethodOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {contributionPaymentMethodLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Pledged amount (KES)</Label>
                <Input
                  type="number"
                  value={contributionForm.pledgedAmount}
                  onChange={(event) => setContributionForm((current) => ({ ...current, pledgedAmount: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Paid amount (KES)</Label>
                <Input
                  type="number"
                  value={contributionForm.paidAmount}
                  onChange={(event) => setContributionForm((current) => ({ ...current, paidAmount: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>In-kind value (KES)</Label>
                <Input
                  type="number"
                  value={contributionForm.inKindValue}
                  onChange={(event) => setContributionForm((current) => ({ ...current, inKindValue: event.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>In-kind item</Label>
                <Input
                  value={contributionForm.inKindItem}
                  onChange={(event) => setContributionForm((current) => ({ ...current, inKindItem: event.target.value }))}
                  placeholder="e.g. Goat, chairs, cake sponsorship"
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Input
                  value={contributionForm.purpose}
                  onChange={(event) => setContributionForm((current) => ({ ...current, purpose: event.target.value }))}
                  placeholder="e.g. Catering, transport, general fund"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date received</Label>
              <Input
                type="date"
                value={contributionForm.paidOn}
                onChange={(event) => setContributionForm((current) => ({ ...current, paidOn: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={contributionForm.notes}
                onChange={(event) => setContributionForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Add context from the committee meeting or contributor promise."
              />
            </div>
            <Button type="submit" disabled={savingContribution} className="w-full">
              {savingContribution ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingContributionId ? 'Save changes' : 'Save contribution'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
