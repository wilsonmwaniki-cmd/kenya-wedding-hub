import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Clock, CheckCircle2, XCircle, Store, Users, X, Loader2, Copy, Link2, HeartHandshake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getEntitlementDecision } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { UpgradePromptDialog } from '@/components/UpgradePrompt';
import { sendWeddingInviteEmail } from '@/lib/weddingWorkspace';
import {
  approvePlannerCodeLinkRequest,
  ensureMyCollaborationCode,
  rejectPlannerCodeLinkRequest,
} from '@/lib/collaborationCodes';

interface PlannerConnection {
  type: 'planner';
  id: string;
  name: string;
  status: string;
  created_at: string;
  request_source?: string;
}

interface VendorConnection {
  type: 'vendor';
  id: string;
  name: string;
  category: string;
  status: string;
  created_at: string;
}

type Connection = PlannerConnection | VendorConnection;

interface OwnedWeddingWorkspace {
  weddingId: string;
  weddingName: string;
  weddingCode: string;
  ownerRole: 'bride' | 'groom';
  partnerEmail: string | null;
  partnerRole: 'bride' | 'groom' | null;
  partnerStatus: 'active' | 'pending' | 'not_invited';
  partnerInviteExpiresAt: string | null;
}

type CommitteeInviteRole = 'committee_member' | 'committee_chair';

interface CommitteeMembershipRecord {
  id: string;
  email: string;
  role: CommitteeInviteRole;
  membership_status: 'invited' | 'active' | 'revoked';
}

interface CommitteeInviteRecord {
  id: string;
  email: string;
  proposed_role: CommitteeInviteRole;
  expires_at: string | null;
}

interface CommitteeWorkspaceAccess {
  enabled: boolean;
  seatsRemaining: number;
  seatLimit: number | null;
  members: CommitteeMembershipRecord[];
  pendingInvites: CommitteeInviteRecord[];
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'text-muted-foreground' },
  approved: { label: 'Connected', icon: CheckCircle2, className: 'text-primary' },
  accepted: { label: 'Connected', icon: CheckCircle2, className: 'text-primary' },
  rejected: { label: 'Declined', icon: XCircle, className: 'text-destructive' },
  declined: { label: 'Declined', icon: XCircle, className: 'text-destructive' },
};

export default function MyConnections() {
  const { user, profile, rolePreview, isSuperAdmin } = useAuth();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const { loadLinkedPlanner } = usePlanner();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [collaborationCode, setCollaborationCode] = useState<string | null>(profile?.collaboration_code ?? null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [ownedWedding, setOwnedWedding] = useState<OwnedWeddingWorkspace | null>(null);
  const [partnerEmailInput, setPartnerEmailInput] = useState('');
  const [partnerInviteSubmitting, setPartnerInviteSubmitting] = useState(false);
  const [committeeWorkspace, setCommitteeWorkspace] = useState<CommitteeWorkspaceAccess | null>(null);
  const [committeeEmailInput, setCommitteeEmailInput] = useState('');
  const [committeeInviteRole, setCommitteeInviteRole] = useState<CommitteeInviteRole>('committee_member');
  const [committeeInviteSubmitting, setCommitteeInviteSubmitting] = useState(false);

  const effectiveCoupleView = profile?.role === 'couple' || (isSuperAdmin && rolePreview === 'couple');
  const plannerConnectDecision = getEntitlementDecision('couple.connect_planners', { profile, weddingEntitlements, couplePlanTier, bypass: isSuperAdmin && rolePreview === 'couple' });

  const loadCommitteeWorkspaceAccess = async (weddingId: string) => {
    const db = supabase as any;

    const [
      entitlementResult,
      bundleResult,
      seatsResult,
      membershipResult,
      inviteResult,
    ] = await Promise.all([
      db
        .from('wedding_entitlements')
        .select('id, effective_from, effective_to, status')
        .eq('wedding_id', weddingId)
        .eq('feature_key', 'committee_collaboration')
        .eq('status', 'active')
        .order('effective_from', { ascending: false }),
      db
        .from('wedding_subscription_bundles')
        .select('seat_limit')
        .eq('wedding_id', weddingId)
        .eq('bundle_type', 'committee_bundle')
        .in('status', ['active', 'grace'])
        .order('seat_limit', { ascending: false })
        .limit(1),
      db.rpc('available_committee_seats', { target_wedding_id: weddingId }),
      db
        .from('wedding_memberships')
        .select('id, email, role, membership_status')
        .eq('wedding_id', weddingId)
        .in('role', ['committee_member', 'committee_chair'])
        .in('membership_status', ['invited', 'active'])
        .order('created_at', { ascending: true }),
      db
        .from('wedding_invites')
        .select('id, email, proposed_role, expires_at')
        .eq('wedding_id', weddingId)
        .eq('invite_type', 'committee')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    const now = Date.now();
    const enabled = Boolean(
      (entitlementResult.data ?? []).find((row: { effective_from: string; effective_to: string | null }) => {
        const effectiveFrom = new Date(row.effective_from).getTime();
        const effectiveTo = row.effective_to ? new Date(row.effective_to).getTime() : null;
        return effectiveFrom <= now && (effectiveTo == null || effectiveTo > now);
      }),
    );
    const seatLimit = bundleResult.data?.[0]?.seat_limit ?? null;
    const seatsRemaining = typeof seatsResult.data === 'number' ? seatsResult.data : 0;

    setCommitteeWorkspace({
      enabled,
      seatLimit,
      seatsRemaining,
      members: (membershipResult.data ?? []) as CommitteeMembershipRecord[],
      pendingInvites: (inviteResult.data ?? []) as CommitteeInviteRecord[],
    });
  };

  const loadOwnedWeddingWorkspace = async () => {
    if (!user || !effectiveCoupleView) {
      setOwnedWedding(null);
      return;
    }

    const db = supabase as any;

    const { data: ownerMemberships, error: ownerMembershipError } = await db
      .from('wedding_memberships')
      .select('id, wedding_id, role, email')
      .eq('user_id', user.id)
      .eq('is_owner', true)
      .eq('membership_status', 'active')
      .in('role', ['bride', 'groom'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (ownerMembershipError) {
      console.error('Could not load owned wedding workspace:', ownerMembershipError);
      setOwnedWedding(null);
      return;
    }

    const ownerMembership = ownerMemberships?.[0];
    if (!ownerMembership) {
      setOwnedWedding(null);
      return;
    }

    const { data: weddings, error: weddingError } = await db
      .from('weddings')
      .select('id, name, wedding_code')
      .eq('id', ownerMembership.wedding_id)
      .limit(1);

    if (weddingError || !weddings?.[0]) {
      console.error('Could not load owned wedding record:', weddingError);
      setOwnedWedding(null);
      return;
    }

    const wedding = weddings[0];

    const { data: partnerMemberships, error: partnerMembershipError } = await db
      .from('wedding_memberships')
      .select('id, email, role, membership_status, user_id')
      .eq('wedding_id', ownerMembership.wedding_id)
      .eq('is_owner', true)
      .neq('id', ownerMembership.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (partnerMembershipError) {
      console.error('Could not load partner membership state:', partnerMembershipError);
    }

    const { data: partnerInvites, error: inviteError } = await db
      .from('wedding_invites')
      .select('id, email, proposed_role, expires_at, status')
      .eq('wedding_id', ownerMembership.wedding_id)
      .eq('invite_type', 'partner')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (inviteError) {
      console.error('Could not load partner invite state:', inviteError);
    }

    const partnerMembership = partnerMemberships?.[0] ?? null;
    const pendingInvite = partnerInvites?.[0] ?? null;
    const partnerStatus: OwnedWeddingWorkspace['partnerStatus'] = partnerMembership?.membership_status === 'active'
      ? 'active'
      : pendingInvite || partnerMembership?.membership_status === 'invited'
        ? 'pending'
        : 'not_invited';

    const partnerRecord = {
      weddingId: wedding.id,
      weddingName: wedding.name ?? 'Your wedding',
      weddingCode: wedding.wedding_code,
      ownerRole: ownerMembership.role as OwnedWeddingWorkspace['ownerRole'],
      partnerEmail: partnerMembership?.email ?? pendingInvite?.email ?? null,
      partnerRole: (partnerMembership?.role ?? pendingInvite?.proposed_role ?? null) as OwnedWeddingWorkspace['partnerRole'],
      partnerStatus,
      partnerInviteExpiresAt: pendingInvite?.expires_at ?? null,
    };

    setOwnedWedding(partnerRecord);
    setPartnerEmailInput(partnerRecord.partnerEmail ?? '');
  };

  const loadConnections = async () => {
    if (!user) return;

    const [plannerRes, vendorRes] = await Promise.all([
      supabase
        .from('planner_link_requests')
        .select('id, planner_user_id, status, created_at, request_source')
        .eq('couple_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('vendor_connection_requests')
        .select('id, vendor_listing_id, status, created_at')
        .eq('requester_user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const plannerConns: Connection[] = [];
    const vendorConns: Connection[] = [];

    if (plannerRes.data?.length) {
      const plannerIds = plannerRes.data.map((r) => r.planner_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, company_name')
        .in('user_id', plannerIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.company_name || p.full_name || 'Planner']) || []);

      for (const r of plannerRes.data) {
        plannerConns.push({
          type: 'planner',
          id: r.id,
          name: profileMap.get(r.planner_user_id) || 'Planner',
          status: r.status,
          created_at: r.created_at,
          request_source: r.request_source ?? 'couple_interest',
        });
      }
    }

    if (vendorRes.data?.length) {
      const listingIds = vendorRes.data.map((r) => r.vendor_listing_id);
      const { data: listings } = await supabase
        .from('vendor_listings')
        .select('id, business_name, category')
        .in('id', listingIds);
      const listingMap = new Map(listings?.map((l) => [l.id, l]) || []);

      for (const r of vendorRes.data) {
        const listing = listingMap.get(r.vendor_listing_id);
        vendorConns.push({
          type: 'vendor',
          id: r.id,
          name: listing?.business_name || 'Vendor',
          category: listing?.category || '',
          status: r.status,
          created_at: r.created_at,
        });
      }
    }

    setConnections([...plannerConns, ...vendorConns].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadConnections();
  }, [user]);

  useEffect(() => {
    if (!user || !effectiveCoupleView) return;
    void loadOwnedWeddingWorkspace();

    if (profile?.collaboration_code) {
      setCollaborationCode(profile.collaboration_code);
      return;
    }

    ensureMyCollaborationCode()
      .then((code) => setCollaborationCode(code))
      .catch((error) => {
        console.error('Failed to ensure collaboration code:', error);
      });
  }, [user, effectiveCoupleView, profile?.collaboration_code]);

  useEffect(() => {
    if (!ownedWedding) {
      setCommitteeWorkspace(null);
      return;
    }

    void loadCommitteeWorkspaceAccess(ownedWedding.weddingId);
  }, [ownedWedding?.weddingId]);

  if (loading) return null;
  if (connections.length === 0 && !(effectiveCoupleView && (collaborationCode || ownedWedding))) return null;

  const cancelRequest = async (conn: Connection) => {
    setCancelling(conn.id);
    const table = conn.type === 'planner' ? 'planner_link_requests' : 'vendor_connection_requests';
    const { error } = await supabase.from(table).delete().eq('id', conn.id);
    setCancelling(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setConnections(prev => prev.filter(c => c.id !== conn.id));
    toast({ title: 'Request cancelled' });
  };

  const approvePlannerRequest = async (requestId: string) => {
    setCancelling(requestId);
    try {
      await approvePlannerCodeLinkRequest(requestId);
      await Promise.all([loadConnections(), loadLinkedPlanner()]);
      toast({
        title: 'Planner linked',
        description: 'Their workspace now opens your existing wedding progress automatically.',
      });
    } catch (error: any) {
      toast({ title: 'Could not approve request', description: error.message, variant: 'destructive' });
    } finally {
      setCancelling(null);
    }
  };

  const declinePlannerRequest = async (requestId: string) => {
    setCancelling(requestId);
    try {
      await rejectPlannerCodeLinkRequest(requestId);
      await loadConnections();
      toast({ title: 'Request declined' });
    } catch (error: any) {
      toast({ title: 'Could not decline request', description: error.message, variant: 'destructive' });
    } finally {
      setCancelling(null);
    }
  };

  const copyCode = async () => {
    if (!collaborationCode) return;
    await navigator.clipboard.writeText(collaborationCode);
    toast({ title: 'Code copied', description: `${collaborationCode} is ready to share with your planner.` });
  };

  const sendPartnerInvite = async () => {
    if (!ownedWedding) return;
    setPartnerInviteSubmitting(true);

    try {
      const { data, error } = await (supabase as any).rpc('upsert_partner_invite', {
        target_wedding_id: ownedWedding.weddingId,
        partner_email_input: partnerEmailInput.trim().toLowerCase(),
      });

      if (error) throw error;

      const inviteRow = Array.isArray(data) ? data[0] : data;
      let deliveryDescription = 'Your wedding co-owner can join using the invite email or the wedding code.';
      if (inviteRow?.invite_id) {
        try {
          await sendWeddingInviteEmail(inviteRow.invite_id);
          deliveryDescription = 'The partner invite email has been sent and they can also use the wedding code.';
        } catch (inviteError: any) {
          deliveryDescription = 'The invite was created, but the email could not be delivered. You can resend it from here.';
          console.error('Partner invite email delivery failed:', inviteError);
        }
      }

      await loadOwnedWeddingWorkspace();
      toast({
        title: ownedWedding.partnerStatus === 'pending' ? 'Partner invite refreshed' : 'Partner invite sent',
        description: deliveryDescription,
      });
    } catch (error: any) {
      toast({
        title: 'Could not send partner invite',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPartnerInviteSubmitting(false);
    }
  };

  const sendCommitteeInvite = async () => {
    if (!ownedWedding) return;
    setCommitteeInviteSubmitting(true);

    try {
      const { data, error } = await (supabase as any).rpc('upsert_committee_invite', {
        target_wedding_id: ownedWedding.weddingId,
        committee_email_input: committeeEmailInput.trim().toLowerCase(),
        committee_role_input: committeeInviteRole,
      });

      if (error) throw error;

      const inviteRow = Array.isArray(data) ? data[0] : data;
      let description = 'Committee seat reserved and invite stored in the wedding workspace.';
      if (inviteRow?.invite_id) {
        try {
          await sendWeddingInviteEmail(inviteRow.invite_id);
          description = 'Committee invite email sent successfully.';
        } catch (inviteError: any) {
          description = 'Committee seat reserved, but the email delivery failed. You can resend later once email is configured.';
          console.error('Committee invite email delivery failed:', inviteError);
        }
      }

      setCommitteeEmailInput('');
      await loadCommitteeWorkspaceAccess(ownedWedding.weddingId);
      toast({
        title: committeeInviteRole === 'committee_chair' ? 'Committee chair invited' : 'Committee member invited',
        description,
      });
    } catch (error: any) {
      toast({
        title: 'Could not send committee invite',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCommitteeInviteSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {effectiveCoupleView && ownedWedding && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-primary" />
              Wedding Ownership
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{ownedWedding.weddingName}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {ownedWedding.ownerRole}
                  </Badge>
                  <Badge variant={ownedWedding.partnerStatus === 'active' ? 'default' : 'secondary'}>
                    {ownedWedding.partnerStatus === 'active'
                      ? 'Partner connected'
                      : ownedWedding.partnerStatus === 'pending'
                        ? 'Partner invite pending'
                        : 'Partner not invited'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Wedding code: <span className="font-medium tracking-[0.16em] text-foreground">{ownedWedding.weddingCode}</span>
                </p>
                {ownedWedding.partnerInviteExpiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Current partner invite expires on {new Date(ownedWedding.partnerInviteExpiresAt).toLocaleDateString()}.
                  </p>
                )}
              </div>
              <div className="w-full max-w-md space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="partner-email-input">Partner email</Label>
                  <Input
                    id="partner-email-input"
                    type="email"
                    value={partnerEmailInput}
                    onChange={(event) => setPartnerEmailInput(event.target.value)}
                    placeholder={ownedWedding.partnerRole === 'groom' ? 'groom@example.com' : 'bride@example.com'}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    className="sm:w-auto"
                    disabled={partnerInviteSubmitting || !partnerEmailInput.trim()}
                    onClick={sendPartnerInvite}
                  >
                    {partnerInviteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {ownedWedding.partnerStatus === 'pending' ? 'Resend partner invite' : 'Send partner invite'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Owners share the wedding and can invite committee members or planners from the workspace.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/80 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Committee collaboration</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={committeeWorkspace?.enabled ? 'default' : 'secondary'}>
                      {committeeWorkspace?.enabled ? 'Committee bundle active' : 'Committee bundle not active'}
                    </Badge>
                    <Badge variant="outline">
                      {committeeWorkspace?.seatLimit == null ? 'No seats configured' : `${committeeWorkspace.seatsRemaining}/${committeeWorkspace.seatLimit} seats left`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Invite your chair and committee members using the same wedding workspace. Seat limits come from the wedding-level committee bundle.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="committee-email-input">Committee email</Label>
                  <Input
                    id="committee-email-input"
                    type="email"
                    placeholder="committee.member@example.com"
                    value={committeeEmailInput}
                    onChange={(event) => setCommitteeEmailInput(event.target.value)}
                    disabled={!committeeWorkspace?.enabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={committeeInviteRole}
                    onValueChange={(value) => setCommitteeInviteRole(value as CommitteeInviteRole)}
                    disabled={!committeeWorkspace?.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="committee_member">Committee member</SelectItem>
                      <SelectItem value="committee_chair">Committee chair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full lg:w-auto"
                    disabled={
                      committeeInviteSubmitting ||
                      !committeeWorkspace?.enabled ||
                      !committeeEmailInput.trim() ||
                      committeeWorkspace.seatsRemaining <= 0
                    }
                    onClick={sendCommitteeInvite}
                  >
                    {committeeInviteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send committee invite
                  </Button>
                </div>
              </div>

              {!committeeWorkspace?.enabled && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Committee invites unlock when this wedding has an active committee collaboration entitlement and a committee bundle.
                </p>
              )}

              {committeeWorkspace && (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Active committee roster</p>
                    <div className="space-y-2">
                      {committeeWorkspace.members.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                          No committee seats are filled yet.
                        </div>
                      ) : (
                        committeeWorkspace.members.map((member) => (
                          <div key={member.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{member.email}</span>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="capitalize">
                                  {member.role.replace('_', ' ')}
                                </Badge>
                                <Badge variant={member.membership_status === 'active' ? 'default' : 'secondary'}>
                                  {member.membership_status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Pending committee invites</p>
                    <div className="space-y-2">
                      {committeeWorkspace.pendingInvites.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                          No pending committee invites right now.
                        </div>
                      ) : (
                        committeeWorkspace.pendingInvites.map((invite) => (
                          <div key={invite.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{invite.email}</span>
                              <Badge variant="secondary" className="capitalize">
                                {invite.proposed_role.replace('_', ' ')}
                              </Badge>
                            </div>
                            {invite.expires_at && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Expires on {new Date(invite.expires_at).toLocaleDateString()}.
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {effectiveCoupleView && collaborationCode && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Couple Collaboration Code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Share this code with your planner so they can request access to your existing wedding workspace.
              </p>
              <p className="mt-2 font-display text-2xl tracking-[0.2em] text-foreground">{collaborationCode}</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={copyCode}>
              <Copy className="h-4 w-4" />
              Copy code
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            My Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
        {connections.map(conn => {
          const config = statusConfig[conn.status] || statusConfig.pending;
          const StatusIcon = config.icon;
          const plannerConn = conn.type === 'planner' ? conn as PlannerConnection : null;
          const plannerNeedsApproval = plannerConn?.request_source === 'planner_code' && plannerConn.status === 'pending';
          return (
            <div key={conn.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {conn.type === 'planner' ? (
                  <Users className="h-4 w-4 text-primary" />
                ) : (
                  <Store className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{conn.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {conn.type === 'planner' ? 'Planner' : (conn as VendorConnection).category}
                  </Badge>
                  {plannerConn?.request_source === 'planner_code' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Planner requested access
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`flex items-center gap-1 text-xs ${config.className}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {config.label}
                </div>
                {plannerNeedsApproval ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => declinePlannerRequest(conn.id)}
                      disabled={cancelling === conn.id}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => (plannerConnectDecision.allowed ? approvePlannerRequest(conn.id) : setUpgradeOpen(true))}
                      disabled={cancelling === conn.id}
                    >
                      {cancelling === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
                    </Button>
                  </div>
                ) : conn.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => cancelRequest(conn)}
                    disabled={cancelling === conn.id}
                  >
                    {cancelling === conn.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        </CardContent>
      </Card>
      <UpgradePromptDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        decision={plannerConnectDecision.allowed ? null : plannerConnectDecision}
      />
    </div>
  );
}
