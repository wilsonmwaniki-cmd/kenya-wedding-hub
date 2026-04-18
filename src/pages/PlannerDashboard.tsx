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
import { Plus, Users, Calendar, MapPin, ArrowRight, Trash2, LinkIcon, CheckCircle2, XCircle, LockKeyhole, CreditCard, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import MyConnections from '@/components/MyConnections';
import { isCommitteePlanner } from '@/lib/plannerAccess';
import { requestPlannerLinkByCode } from '@/lib/collaborationCodes';
import { getEntitlementDecision } from '@/lib/entitlements';
import { InlineUpgradePrompt, UpgradePromptDialog } from '@/components/UpgradePrompt';
import { useProfessionalEntitlements } from '@/hooks/useProfessionalEntitlements';

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

  const incomingLinkRequests = linkRequests.filter((req) => req.request_source !== 'planner_code');
  const outgoingCodeRequests = linkRequests.filter((req) => req.request_source === 'planner_code');

  const approveRequest = async (req: LinkRequest) => {
    // Create a planner_client record linked to the couple's user id
    if (!user) return;
    const { error: clientError } = await supabase.from('planner_clients').insert({
      planner_user_id: user.id,
      client_name: req.couple_name || 'Client',
      linked_user_id: req.couple_user_id,
    });
    if (clientError) {
      toast({ title: 'Error', description: clientError.message, variant: 'destructive' });
      return;
    }
    // Update request status
    await supabase.from('planner_link_requests').update({ status: 'approved' }).eq('id', req.id);
    toast({ title: 'Request approved!', description: `${req.couple_name} is now linked.` });
    loadLinkRequests();
    loadClients();
  };

  const rejectRequest = async (req: LinkRequest) => {
    await supabase.from('planner_link_requests').update({ status: 'rejected' }).eq('id', req.id);
    toast({ title: 'Request rejected' });
    loadLinkRequests();
  };

  const submitCodeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabCode.trim()) {
      toast({ title: 'Add a collaboration code', description: 'Ask the couple to share their Zania collaboration code first.', variant: 'destructive' });
      return;
    }

    setSubmittingCode(true);
    try {
      const result = await requestPlannerLinkByCode(collabCode, collabNote);
      if (result.status === 'already_linked') {
        toast({ title: 'Already linked', description: `${result.couple_name || 'This couple'} is already in your workspace.` });
      } else if (result.status === 'already_pending') {
        toast({ title: 'Request already sent', description: `We’re still waiting for ${result.couple_name || 'the couple'} to approve it.` });
      } else {
        toast({ title: 'Request sent', description: `${result.couple_name || 'The couple'} can now approve you from their account.` });
      }
      setCodeDialogOpen(false);
      setCollabCode('');
      setCollabNote('');
      await loadLinkRequests();
    } catch (error: any) {
      toast({ title: 'Could not send request', description: error.message, variant: 'destructive' });
    } finally {
      setSubmittingCode(false);
    }
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('planner_clients').insert({
      planner_user_id: user.id,
      client_name: form.client_name,
      partner_name: form.partner_name || null,
      wedding_date: form.wedding_date || null,
      wedding_location: form.wedding_location || null,
      email: form.email || null,
      phone: form.phone || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setForm({ client_name: '', partner_name: '', wedding_date: '', wedding_location: '', email: '', phone: '' });
    setOpen(false);
    loadClients();
    toast({ title: 'Client added!' });
  };

  const deleteClient = async (id: string) => {
    await supabase.from('planner_clients').delete().eq('id', id);
    loadClients();
    toast({ title: 'Client removed' });
  };

  const openClientDashboard = (client: PlannerClient) => {
    selectClient(client);
    navigate('/dashboard');
  };

  const plannerPreviewMode = isSuperAdmin && (rolePreview === 'planner' || rolePreview === 'committee');
  const isCommittee = isCommitteePlanner(profile);
  const { entitlements: professionalEntitlements, teamSeatLimit: professionalTeamSeatLimit } = useProfessionalEntitlements(
    isCommittee ? null : 'planner',
  );
  const workspaceDecision = getEntitlementDecision(isCommittee ? 'committee.connect_couples' : 'planner.full_workspace', {
    profile,
    activeWeddingCount: clients.length,
    bypass: plannerPreviewMode,
  });
  const addWeddingDecision = getEntitlementDecision('planner.additional_weddings', {
    profile,
    activeWeddingCount: clients.length,
    bypass: plannerPreviewMode,
  });
  const fullPlannerAccess = workspaceDecision.allowed;
  const workspaceLabel = isCommittee ? 'committee workspace' : 'planner workspace';
  const collectionHeading = isCommittee ? 'Committee Weddings' : 'My Clients';
  const addLabel = isCommittee ? 'Add Wedding' : 'Add Client';
  const committeeAtCapacity = isCommittee && clients.length >= 1;
  const mediaAddonDecision = !isCommittee
    ? getEntitlementDecision('planner.media_portfolio', {
        profile,
        professionalAudience: 'planner',
        professionalEntitlements,
        professionalTeamSeatLimit,
        bypass: plannerPreviewMode,
      })
    : null;
  const advertisingAddonDecision = !isCommittee
    ? getEntitlementDecision('planner.advertising', {
        profile,
        professionalAudience: 'planner',
        professionalEntitlements,
        professionalTeamSeatLimit,
        bypass: plannerPreviewMode,
      })
    : null;
  const teamAddonDecision = !isCommittee
    ? getEntitlementDecision('planner.team_workspace', {
        profile,
        professionalAudience: 'planner',
        professionalEntitlements,
        professionalTeamSeatLimit,
        bypass: plannerPreviewMode,
      })
    : null;

  return (
    <div className="space-y-6">
      {!fullPlannerAccess && (
        <InlineUpgradePrompt decision={workspaceDecision} />
      )}

      {plannerPreviewMode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            You are previewing the {isCommittee ? 'committee' : 'planner'} workspace with admin bypass enabled. Any weddings
            or linked records you create here will be saved against your current account for testing.
          </CardContent>
        </Card>
      )}

      {/* Pending Link Requests */}
      {fullPlannerAccess && incomingLinkRequests.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Pending Link Requests
            </CardTitle>
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

      {fullPlannerAccess && outgoingCodeRequests.length > 0 && (
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

      {/* Planner's vendor connections */}
      {fullPlannerAccess && <MyConnections />}

      {!isCommittee && (
        <Card className="border-border/70 bg-muted/20">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Professional Growth Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            {[
              {
                key: 'media',
                title: 'Media portfolio',
                description: mediaAddonDecision?.allowed
                  ? 'Richer visual presentation is active for this planner workspace.'
                  : 'Upgrade to showcase richer portfolio photos and videos on your planner profile.',
                decision: mediaAddonDecision,
                activeLabel: 'Active',
              },
              {
                key: 'advertising',
                title: 'Advertising',
                description: advertisingAddonDecision?.allowed
                  ? 'Advertising access is active for this planner workspace.'
                  : 'Upgrade to unlock promoted placement and stronger directory visibility.',
                decision: advertisingAddonDecision,
                activeLabel: 'Active',
              },
              {
                key: 'team',
                title: 'Team workspace',
                description: teamAddonDecision?.allowed
                  ? `Team collaboration is active with up to ${professionalTeamSeatLimit || 0} seats available.`
                  : 'Upgrade to add bundled colleague seats inside your planner workspace.',
                decision: teamAddonDecision,
                activeLabel: professionalTeamSeatLimit > 0 ? `${professionalTeamSeatLimit} seats` : 'Active',
              },
            ].map((item) => (
              <div key={item.key} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-card-foreground">{item.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Badge variant={item.decision?.allowed ? 'default' : 'secondary'}>
                    {item.decision?.allowed ? item.activeLabel : 'Add-on'}
                  </Badge>
                </div>
                {item.decision && !item.decision.allowed && (
                  <Button asChild variant="outline" className="mt-4 w-full gap-2">
                    <Link to={item.decision.pricingHref}>
                      {item.decision.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">{collectionHeading}</h1>
          <p className="text-muted-foreground">{clients.length} wedding{clients.length !== 1 ? 's' : ''} in this {workspaceLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
            <Button
              variant="outline"
              className="gap-2"
              disabled={committeeAtCapacity}
              onClick={() => (addWeddingDecision.allowed ? setCodeDialogOpen(true) : setUpgradeDialogOpen(true))}
            >
              <LinkIcon className="h-4 w-4" />
              Link by Code
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Link an Existing Couple Workspace</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitCodeRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label>Couple Collaboration Code</Label>
                  <Input
                    value={collabCode}
                    onChange={(e) => setCollabCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ZN-4K7P2Q"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Ask the couple to share the code from their dashboard. Once they approve, their wedding appears here automatically.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Message (optional)</Label>
                  <Textarea
                    value={collabNote}
                    onChange={(e) => setCollabNote(e.target.value)}
                    placeholder="Add a short note so the couple knows why you're requesting access."
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submittingCode}>
                  {submittingCode ? 'Sending request...' : 'Send link request'}
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
              <DialogHeader><DialogTitle className="font-display">{isCommittee ? 'New Wedding Workspace' : 'New Client'}</DialogTitle></DialogHeader>
              <form onSubmit={addClient} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. Jane Wanjiku" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner Name</Label>
                    <Input value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} placeholder="e.g. John Kamau" />
                  </div>
                </div>
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
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254..." />
                  </div>
                </div>
                <Button type="submit" className="w-full">{addLabel}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((c, i) => {
          const weddingDate = c.wedding_date ? new Date(c.wedding_date) : null;
          const daysUntil = weddingDate ? Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000)) : null;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="shadow-card hover:shadow-warm transition-shadow cursor-pointer group">
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
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
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
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => openClientDashboard(c)}
                  >
                    Open Dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {clients.length === 0 && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isCommittee
              ? 'No wedding workspace yet. Add your wedding to start assigning committee roles and managing vendors.'
              : 'No clients yet. Add your first client to start managing their wedding!'}
          </p>
        </div>
      )}
    </div>
  );
}
