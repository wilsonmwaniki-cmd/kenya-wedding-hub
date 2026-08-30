import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner, PlannerClient } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Users,
  Calendar,
  MapPin,
  ArrowRight,
  Trash2,
  LinkIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock3,
  ListTodo,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { isCommitteePlanner, plannerCanCollaborate } from '@/lib/plannerAccess';
import { approvePlannerCodeLinkRequest, requestPlannerLinkByCode } from '@/lib/collaborationCodes';
import { getEntitlementDecision } from '@/lib/entitlements';
import { InlineUpgradePrompt, UpgradePromptDialog } from '@/components/UpgradePrompt';
import { usePlannerFreeWeddingStatus } from '@/hooks/usePlannerFreeWeddingStatus';
import AttentionInbox from '@/components/AttentionInbox';
import type { AttentionItem } from '@/lib/attention';
import {
  TonalCard,
  TonalCardBody,
  TonalCardDescription,
  TonalCardHeader,
  TonalCardTitle,
} from '@/components/ui/tonal-card';
import ProfessionalLeadInbox from '@/components/leads/ProfessionalLeadInbox';

interface PlannerTaskPulse {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  client_id: string | null;
  user_id: string;
  priority_level: number | null;
  client: PlannerClient;
}

type PlannerTaskPulseRow = Omit<PlannerTaskPulse, 'client'>;

interface PlannerWeddingOverview {
  client: PlannerClient;
  open: number;
  overdue: number;
  dueSoon: number;
  recent: number;
  nextTask: PlannerTaskPulse | null;
  latestTask: PlannerTaskPulse | null;
}

const DAY_MS = 86400000;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

interface LinkRequest {
  id: string;
  couple_user_id: string;
  status: string;
  created_at: string;
  message?: string | null;
  couple_name?: string;
  couple_email?: string;
  request_source?: string;
}

export default function PlannerDashboard() {
  const { user, profile, isSuperAdmin, rolePreview } = useAuth();
  const { clients, loadClients, selectClient } = usePlanner();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [collabCode, setCollabCode] = useState('');
  const [collabNote, setCollabNote] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [taskPulse, setTaskPulse] = useState<PlannerTaskPulse[]>([]);
  const [taskPulseLoading, setTaskPulseLoading] = useState(true);
  const [codeFormErrors, setCodeFormErrors] = useState<{ collabCode?: string }>({});
  const [codeSubmitError, setCodeSubmitError] = useState<string | null>(null);
  const [clientFormErrors, setClientFormErrors] = useState<{ client_name?: string; email?: string; phone?: string }>({});
  const [clientSubmitError, setClientSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_name: '', partner_name: '', wedding_date: '', wedding_location: '', email: '', phone: '',
  });

  const loadLinkRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('planner_link_requests')
      .select('*')
      .eq('planner_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!data) return;

    // Fetch couple names
    const coupleIds = data.map(r => r.couple_user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', coupleIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
    setLinkRequests(data.map(r => ({
      ...r,
      couple_name: profileMap.get(r.couple_user_id) || 'Unknown',
    })));
  };

  useEffect(() => { if (user) loadLinkRequests(); }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadTaskPulse = async () => {
      if (!user || clients.length === 0) {
        if (!cancelled) {
          setTaskPulse([]);
          setTaskPulseLoading(false);
        }
        return;
      }

      setTaskPulseLoading(true);
      const clientIds = clients.map((client) => client.id);
      const linkedUserIds = clients
        .map((client) => client.linked_user_id)
        .filter((id): id is string => Boolean(id));
      const fields = 'id,title,due_date,completed,created_at,client_id,user_id,priority_level' as const;

      const { data: clientTasks } = await supabase
        .from('tasks')
        .select(fields)
        .in('client_id', clientIds);
      let linkedTasks: PlannerTaskPulseRow[] = [];
      if (linkedUserIds.length > 0) {
        const { data } = await supabase
          .from('tasks')
          .select(fields)
          .in('user_id', linkedUserIds);
        linkedTasks = data ?? [];
      }

      if (cancelled) return;

      const clientsById = new Map(clients.map((client) => [client.id, client]));
      const clientsByUserId = new Map(
        clients
          .filter((client) => client.linked_user_id)
          .map((client) => [client.linked_user_id as string, client]),
      );
      const rows: PlannerTaskPulseRow[] = [...(clientTasks ?? []), ...linkedTasks];
      const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());

      setTaskPulse(uniqueRows.flatMap((row) => {
        const client = (row.client_id ? clientsById.get(row.client_id) : null)
          ?? clientsByUserId.get(row.user_id);
        return client ? [{ ...row, client } as PlannerTaskPulse] : [];
      }));
      setTaskPulseLoading(false);
    };

    void loadTaskPulse();
    return () => {
      cancelled = true;
    };
  }, [clients, user]);

  const incomingLinkRequests = linkRequests.filter((req) => req.request_source !== 'planner_code');
  const outgoingCodeRequests = linkRequests.filter((req) => req.request_source === 'planner_code');

  const approveRequest = async (req: LinkRequest) => {
    try {
      await approvePlannerCodeLinkRequest(req.id);
      toast({ title: 'Request approved!', description: `${req.couple_name} is now linked.` });
      await loadLinkRequests();
      await loadClients();
    } catch (error: any) {
      toast({
        title: 'Could not approve request',
        description: error.message || 'The planner workspace could not be linked right now.',
        variant: 'destructive',
      });
    }
  };

  const rejectRequest = async (req: LinkRequest) => {
    await supabase.from('planner_link_requests').update({ status: 'rejected' }).eq('id', req.id);
    toast({ title: 'Request rejected' });
    loadLinkRequests();
  };

  const submitCodeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { collabCode?: string } = {};
    if (!collabCode.trim()) {
      nextErrors.collabCode = 'Ask the couple to share their Zania collaboration code first.';
    }
    setCodeFormErrors(nextErrors);
    setCodeSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmittingCode(true);
    try {
      const result = await requestPlannerLinkByCode(collabCode, collabNote);
      if (result.status === 'already_linked') {
        toast({ title: 'Already linked', description: `${result.couple_name || 'This couple'} is already in your workspace.`, variant: 'info' });
      } else if (result.status === 'already_pending') {
        toast({ title: 'Request already sent', description: `We’re still waiting for ${result.couple_name || 'the couple'} to approve it.`, variant: 'warning' });
      } else {
        toast({ title: 'Request sent', description: `${result.couple_name || 'The couple'} can now approve you from their account.`, variant: 'success' });
      }
      setCodeDialogOpen(false);
      setCollabCode('');
      setCollabNote('');
      await loadLinkRequests();
    } catch (error: any) {
      setCodeSubmitError(error.message || 'Could not send request right now.');
      toast({ title: 'Could not send request', description: error.message, variant: 'destructive' });
    } finally {
      setSubmittingCode(false);
    }
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const nextErrors: { client_name?: string; email?: string; phone?: string } = {};
    if (!form.client_name.trim()) {
      nextErrors.client_name = 'Add a client name.';
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (form.phone.trim() && form.phone.trim().length < 7) {
      nextErrors.phone = 'Enter a valid phone number.';
    }
    setClientFormErrors(nextErrors);
    setClientSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setAddingClient(true);
    const db = supabase as any;
    const { error } = await db.rpc('create_planner_client_guarded', {
      client_name_input: form.client_name.trim(),
      partner_name_input: form.partner_name.trim() || null,
      wedding_date_input: form.wedding_date || null,
      wedding_location_input: form.wedding_location.trim() || null,
      email_input: form.email.trim() || null,
      phone_input: form.phone.trim() || null,
    });
    if (error) {
      setClientSubmitError(error.message || 'Could not save this wedding workspace right now.');
      setAddingClient(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setForm({ client_name: '', partner_name: '', wedding_date: '', wedding_location: '', email: '', phone: '' });
    setOpen(false);
    loadClients();
    toast({
      title: 'Client added',
      description: 'The wedding workspace is ready in your client list.',
      variant: 'success',
    });
    setAddingClient(false);
  };

  const deleteClient = async (id: string) => {
    const db = supabase as any;
    const { data, error } = await db.rpc('archive_planner_client_guarded', {
      target_client_id: id,
    });

    if (error) {
      toast({ title: 'Could not archive client', description: error.message, variant: 'destructive' });
      return;
    }

    await loadClients();
    const released = Boolean(data?.released_free_tier_slot);
    toast({
      title: released ? 'Client archived and free slot reopened' : 'Client archived',
      description: released
        ? 'That unused test workspace released your one free-tier replacement.'
        : 'This planner workspace is now archived and kept in history.',
      variant: 'success',
    });
  };

  const plannerPreviewMode = isSuperAdmin && (rolePreview === 'planner' || rolePreview === 'committee');
  const isCommittee = isCommitteePlanner(profile);
  const { status: plannerFreeWeddingStatus } = usePlannerFreeWeddingStatus(!isCommittee);
  const workspaceDecision = getEntitlementDecision(isCommittee ? 'committee.connect_couples' : 'planner.full_workspace', {
    profile,
    activeWeddingCount: !isCommittee ? plannerFreeWeddingStatus.meaningfulClientCount : clients.length,
    bypass: plannerPreviewMode,
  });
  const addWeddingDecision = getEntitlementDecision('planner.additional_weddings', {
    profile,
    activeWeddingCount: !isCommittee ? plannerFreeWeddingStatus.meaningfulClientCount : clients.length,
    plannerFreeWeddingEligible: isCommittee ? clients.length < 1 : plannerFreeWeddingStatus.canAddWedding,
    plannerFreeWeddingReason: plannerFreeWeddingStatus.gatingReason,
    bypass: plannerPreviewMode,
  });
  const fullPlannerAccess = workspaceDecision.allowed;
  const collectionHeading = 'Weddings';
  const addLabel = isCommittee ? 'Add wedding' : 'Add client';
  const committeeAtCapacity = isCommittee && clients.length >= 1;
  const today = startOfToday();
  const dueSoonLimit = new Date(today.getTime() + (14 * DAY_MS));
  const recentLimit = new Date(Date.now() - (7 * DAY_MS));

  const weddingOverviews: PlannerWeddingOverview[] = clients.map((client) => {
    const tasks = taskPulse.filter((task) => task.client.id === client.id);
    const openTasks = tasks.filter((task) => !task.completed);
    const scheduledOpenTasks = openTasks
      .filter((task) => task.due_date)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const overdue = scheduledOpenTasks.filter(
      (task) => new Date(`${task.due_date}T00:00:00`) < today,
    ).length;
    const dueSoon = scheduledOpenTasks.filter((task) => {
      const dueDate = new Date(`${task.due_date}T00:00:00`);
      return dueDate >= today && dueDate <= dueSoonLimit;
    }).length;
    const recentTasks = tasks.filter((task) => new Date(task.created_at) >= recentLimit);
    const latestTask = [...tasks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0] ?? null;

    return {
      client,
      open: openTasks.length,
      overdue,
      dueSoon,
      recent: recentTasks.length,
      nextTask: scheduledOpenTasks[0] ?? openTasks[0] ?? null,
      latestTask,
    };
  });

  const attentionTasks = taskPulse
    .filter((task) => {
      if (task.completed || !task.due_date) return false;
      return new Date(`${task.due_date}T00:00:00`) <= dueSoonLimit;
    })
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const recentChanges = [...taskPulse]
    .filter((task) => new Date(task.created_at) >= recentLimit)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  const totalOpen = weddingOverviews.reduce((total, overview) => total + overview.open, 0);
  const totalOverdue = weddingOverviews.reduce((total, overview) => total + overview.overdue, 0);
  const totalDueSoon = weddingOverviews.reduce((total, overview) => total + overview.dueSoon, 0);
  const plannerTaskAttentionItems: AttentionItem[] = attentionTasks.map((task) => {
    const overdue = new Date(`${task.due_date}T00:00:00`) < today;
    const weddingName = `${task.client.client_name}${task.client.partner_name ? ` & ${task.client.partner_name}` : ''}`;

    return {
      id: `planner-task:${task.id}`,
      createdAt: task.created_at,
      updatedAt: task.created_at,
      recipientRole: 'planner',
      weddingId: null,
      sourceType: 'task',
      sourceId: task.id,
      kind: 'action',
      priority: overdue ? 'urgent' : 'action',
      status: 'read',
      title: task.title,
      summary: overdue ? 'This task is overdue.' : 'This task is due soon.',
      actionLabel: 'Open task',
      actionPath: null,
      dueAt: task.due_date ? `${task.due_date}T00:00:00` : null,
      metadata: {
        wedding_name: weddingName,
        planner_client_id: task.client.id,
      },
    };
  });

  const openClientRoute = (client: PlannerClient, path: string) => {
    selectClient(client);
    navigate(path);
  };

  return (
    <div className="space-y-6">
      {!fullPlannerAccess && (
        <InlineUpgradePrompt decision={workspaceDecision} />
      )}

      {plannerPreviewMode && (
        <Card className="semantic-surface-info">
          <CardContent className="py-4 text-sm text-muted-foreground">
            You are previewing the {isCommittee ? 'committee' : 'planner'} workspace with admin bypass enabled. Any weddings
            or linked records you create here will be saved against your current account for testing.
          </CardContent>
        </Card>
      )}

      <ProfessionalLeadInbox />

      {/* Pending Link Requests */}
      {(plannerPreviewMode || plannerCanCollaborate(profile)) && incomingLinkRequests.length > 0 && (
        <Card className="semantic-surface-warning">
          <CardHeader>
            <CardTitle className="font-display text-base">Pending Link Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomingLinkRequests.map(req => (
              <div key={req.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-card-foreground">{req.couple_name}</p>
                  <p className="text-xs text-muted-foreground">Wants to link their wedding account</p>
                  {req.message && (
                    <p className="mt-1.5 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                      "{req.message}"
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 pt-0.5">
                  <Button size="sm" variant="outline" onClick={() => rejectRequest(req)} className="gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Decline
                  </Button>
                  <Button size="sm" onClick={() => approveRequest(req)} className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(plannerPreviewMode || plannerCanCollaborate(profile)) && outgoingCodeRequests.length > 0 && (
        <Card className="border-border/70 bg-muted/20">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Waiting for Couple Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outgoingCodeRequests.map((req) => (
              <div key={req.id} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-medium text-card-foreground">{req.couple_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Code-based link request sent. The couple needs to approve it from their Zania account before they appear in your client list.
                </p>
                {req.message && (
                  <p className="mt-2 text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">
                    "{req.message}"
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">{collectionHeading}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
            <Button
              variant="outline"
              className="gap-2"
              disabled={committeeAtCapacity}
              onClick={() => (addWeddingDecision.allowed ? setCodeDialogOpen(true) : setUpgradeDialogOpen(true))}
            >
              <LinkIcon className="h-4 w-4" />
              Link wedding
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Link wedding</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitCodeRequest} className="space-y-4">
                <FormSubmitError message={codeSubmitError} />
                <div className="space-y-2">
                  <Label>Wedding code</Label>
                  <Input
                    value={collabCode}
                    onChange={(e) => {
                      setCollabCode(e.target.value.toUpperCase());
                      setCodeFormErrors((current) => ({ ...current, collabCode: undefined }));
                      setCodeSubmitError(null);
                    }}
                    placeholder="e.g. ZN-4K7P2Q"
                    required
                    aria-invalid={!!codeFormErrors.collabCode}
                  />
                  <FormFieldError message={codeFormErrors.collabCode} />
                  <p className="text-xs text-muted-foreground">
                    Ask the couple for the code from their dashboard.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={collabNote}
                    onChange={(e) => setCollabNote(e.target.value)}
                    placeholder="Optional note"
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submittingCode}>
                  {submittingCode ? 'Sending…' : 'Send request'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              className="gap-2"
              disabled={committeeAtCapacity}
              onClick={() => (addWeddingDecision.allowed ? setOpen(true) : setUpgradeDialogOpen(true))}
            >
              <Plus className="h-4 w-4" /> {addLabel}
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader><DialogTitle className="font-display">{addLabel}</DialogTitle></DialogHeader>
              <form onSubmit={addClient} className="space-y-4">
                <FormSubmitError message={clientSubmitError} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input value={form.client_name} onChange={e => { setForm(f => ({ ...f, client_name: e.target.value })); setClientFormErrors((current) => ({ ...current, client_name: undefined })); setClientSubmitError(null); }} placeholder="e.g. Jane Wanjiku" required aria-invalid={!!clientFormErrors.client_name} />
                    <FormFieldError message={clientFormErrors.client_name} />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner Name</Label>
                    <Input value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} placeholder="e.g. John Kamau" />
                  </div>
                </div>
                <details className="rounded-2xl border border-border/70">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none">More details</summary>
                  <div className="grid gap-4 border-t border-border/70 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Wedding Date</Label>
                    <Input type="date" value={form.wedding_date} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={form.wedding_location} onChange={e => setForm(f => ({ ...f, wedding_location: e.target.value }))} placeholder="Nairobi" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setClientFormErrors((current) => ({ ...current, email: undefined })); setClientSubmitError(null); }} placeholder="client@email.com" aria-invalid={!!clientFormErrors.email} />
                    <FormFieldError message={clientFormErrors.email} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setClientFormErrors((current) => ({ ...current, phone: undefined })); setClientSubmitError(null); }} placeholder="+254..." aria-invalid={!!clientFormErrors.phone} />
                    <FormFieldError message={clientFormErrors.phone} />
                  </div>
                </div>
                  </div>
                </details>
                <Button type="submit" className="w-full" disabled={addingClient}>
                  {addingClient ? 'Saving…' : addLabel}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionInbox
          showEmpty={false}
          maxItems={3}
          supplementaryItems={plannerTaskAttentionItems}
          onSupplementaryAction={(item) => {
            const clientId = typeof item.metadata.planner_client_id === 'string'
              ? item.metadata.planner_client_id
              : null;
            const client = clients.find((candidate) => candidate.id === clientId);
            if (client && item.sourceId) openClientRoute(client, `/tasks?task=${item.sourceId}`);
          }}
        />

        {clients.length > 0 && (
          <details className="rounded-2xl border border-border/70 bg-card">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground marker:content-none">Recent changes</summary>
          <TonalCard tone="oat" className="rounded-t-none border-x-0 border-b-0 shadow-none">
            <TonalCardHeader>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-current/50">Client activity</p>
              <TonalCardTitle className="text-xl">Recent changes</TonalCardTitle>
              <TonalCardDescription>Tasks added in the last seven days.</TonalCardDescription>
            </TonalCardHeader>
            <TonalCardBody className="px-0 pb-0">
              <div className="border-t border-current/10">
              {recentChanges.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openClientRoute(task.client, `/tasks?task=${task.id}`)}
                  className="flex min-h-14 w-full items-center gap-3 border-b border-current/10 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-white/30 sm:px-7"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-current">{task.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-current/55">
                      Added for {task.client.client_name}{task.client.partner_name ? ` & ${task.client.partner_name}` : ''}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-current/45" />
                </button>
              ))}
              </div>
              {!taskPulseLoading && recentChanges.length === 0 && (
                <p className="border-t border-current/10 px-5 py-5 text-sm text-current/60 sm:px-7">
                  No new tasks were added this week.
                </p>
              )}
            </TonalCardBody>
          </TonalCard>
          </details>
        )}
      </div>

      <UpgradePromptDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        decision={addWeddingDecision.allowed ? null : addWeddingDecision}
      />

      {committeeAtCapacity && (
        <Card className="border-border/70 bg-muted/20">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Committee accounts are currently scoped to one wedding workspace. Manage committee members and assignments from Settings.
          </CardContent>
        </Card>
      )}

      {clients.length > 0 && (
        <>
          <details className="rounded-2xl border border-border/70 bg-card">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground marker:content-none">Workload details</summary>
          <section aria-label="Wedding workload overview" className="space-y-4 border-t border-border/70 p-4">
            <div className="grid overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card sm:grid-cols-3">
              <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 sm:border-b-0 sm:border-r">
                <span className="rounded-full bg-muted p-2 text-muted-foreground">
                  <ListTodo className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Open tasks</p>
                  <p className="text-xl font-semibold text-foreground">{taskPulseLoading ? '...' : totalOpen}</p>
                </div>
              </div>
              <div className={`flex items-center gap-3 border-b border-border/70 px-4 py-3 sm:border-b-0 sm:border-r ${totalOverdue > 0 ? 'semantic-surface-danger' : ''}`}>
                <span className="rounded-full bg-background/70 p-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-xl font-semibold text-foreground">{taskPulseLoading ? '...' : totalOverdue}</p>
                </div>
              </div>
              <div className={`flex items-center gap-3 px-4 py-3 ${totalDueSoon > 0 ? 'semantic-surface-warning' : ''}`}>
                <span className="rounded-full bg-background/70 p-2 text-warning">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Due in 14 days</p>
                  <p className="text-xl font-semibold text-foreground">{taskPulseLoading ? '...' : totalDueSoon}</p>
                </div>
              </div>
            </div>
          </section>
          </details>

          <section aria-labelledby="planner-weddings-heading" className="space-y-3">
            <div>
              <h2 id="planner-weddings-heading" className="font-display text-2xl font-semibold text-foreground">Your weddings</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {weddingOverviews.map((overview, i) => {
          const c = overview.client;
          const weddingDate = c.wedding_date ? new Date(`${c.wedding_date}T00:00:00`) : null;
          const daysUntil = weddingDate ? Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000)) : null;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`group overflow-hidden shadow-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/35 ${
                overview.overdue > 0 ? 'border-destructive/30' : overview.dueSoon > 0 ? 'border-warning/30' : ''
              }`}>
                <div className={`h-1 ${overview.overdue > 0 ? 'bg-destructive' : overview.dueSoon > 0 ? 'bg-warning' : 'bg-success'}`} />
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-display">
                      {c.client_name}{c.partner_name ? ` & ${c.partner_name}` : ''}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {c.wedding_location && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {c.wedding_location}
                        </p>
                      )}
                      {c.linked_user_id && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <LinkIcon className="h-3 w-3" /> Linked
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteClient(c.id); }}
                    aria-label={`Archive ${c.client_name}'s wedding`}
                    className="rounded-md p-2 text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {weddingDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        {weddingDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {daysUntil !== null && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          {daysUntil === 0 ? 'Today!' : `${daysUntil}d`}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/70 bg-muted/20 text-center">
                    <div className="px-2 py-2.5">
                      <p className="text-lg font-semibold text-foreground">{overview.open}</p>
                      <p className="text-[11px] text-muted-foreground">Open</p>
                    </div>
                    <div className={`border-x border-border/70 px-2 py-2.5 ${overview.overdue > 0 ? 'semantic-surface-danger' : ''}`}>
                      <p className="text-lg font-semibold text-foreground">{overview.overdue}</p>
                      <p className="text-[11px] text-muted-foreground">Overdue</p>
                    </div>
                    <div className="px-2 py-2.5">
                      <p className="text-lg font-semibold text-foreground">{overview.dueSoon}</p>
                      <p className="text-[11px] text-muted-foreground">Due soon</p>
                    </div>
                  </div>
                  <div className="min-h-11 rounded-xl bg-muted/30 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {overview.latestTask ? 'Latest change' : 'Next step'}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-foreground">
                      {overview.latestTask?.title ?? overview.nextTask?.title ?? 'Add the first wedding task'}
                    </p>
                  </div>
                  <Button
                    variant={overview.overdue > 0 ? 'default' : 'outline'}
                    className="w-full gap-2"
                    onClick={() => openClientRoute(c, '/dashboard')}
                  >
                    Open wedding <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
            </div>
          </section>
        </>
      )}

      {clients.length === 0 && (
        <Card className="border-border/70 bg-muted/10 shadow-card">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <h3 className="font-display text-2xl text-foreground">
              {plannerPreviewMode ? 'No test weddings yet.' : 'No weddings yet.'}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isCommittee
                ? 'Add the wedding your committee is planning.'
                : plannerPreviewMode
                  ? 'Add a test wedding or link one with a code.'
                  : 'Add your first client wedding.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {addLabel}
              </Button>
              {!isCommittee && (
                <Button variant="outline" onClick={() => setCodeDialogOpen(true)} className="gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Link wedding
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
