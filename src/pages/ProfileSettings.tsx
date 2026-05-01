import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Plus, Copy, ExternalLink, ShieldCheck, CreditCard, LockKeyhole, AlertTriangle, UserCog, Phone } from 'lucide-react';
import AvatarUpload from '@/components/AvatarUpload';
import { committeeResponsibilityOptions } from '@/lib/committeeRoles';
import { isCommitteePlanner, plannerAccessMessage, plannerHasActiveSubscription, plannerHasFullAccess } from '@/lib/plannerAccess';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { getEntitlementDecision } from '@/lib/entitlements';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import {
  completePendingWeddingSetup,
  getMyWeddingOwnershipSummary,
  getMyWeddingOwnershipSummaryFromTables,
  getPendingWeddingSetup,
  sendWeddingInviteEmail,
  type MyWeddingOwnershipSummary,
} from '@/lib/weddingWorkspace';
import KenyaLocationFields from '@/components/KenyaLocationFields';
import { kenyaCounties, travelScopeOptions, formatBudgetBand, buildKenyaLocationLabel } from '@/lib/kenyaLocations';
import { getHomeRouteForRole, isProfessionalSetupPending } from '@/lib/roles';
import { clearPendingProfessionalSetup } from '@/lib/professionalSetupState';

type CommitteeMember = Tables<'wedding_committee_members'>;

interface OwnedWeddingWorkspace extends MyWeddingOwnershipSummary {}

const committeePermissionOptions = ['chair', 'member', 'viewer'] as const;
export default function ProfileSettings() {
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const [saving, setSaving] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [committeeLoading, setCommitteeLoading] = useState(false);
  const [savingCommitteeMember, setSavingCommitteeMember] = useState(false);
  const [deletingCommitteeMemberId, setDeletingCommitteeMemberId] = useState<string | null>(null);
  const [committeeMemberForm, setCommitteeMemberForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    responsibility: committeeResponsibilityOptions[0],
    permission_level: 'member' as CommitteeMember['permission_level'],
  });
  const [serviceAreaDraft, setServiceAreaDraft] = useState('');
  const [ownedWedding, setOwnedWedding] = useState<OwnedWeddingWorkspace | null>(null);
  const [partnerEmailInput, setPartnerEmailInput] = useState('');
  const [partnerInviteSubmitting, setPartnerInviteSubmitting] = useState(false);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [repairingWeddingSetup, setRepairingWeddingSetup] = useState(false);
  const [professionalSetupRole, setProfessionalSetupRole] = useState<'planner' | 'vendor' | null>(null);
  const [completingProfessionalSetup, setCompletingProfessionalSetup] = useState(false);

  const isPlanner = profile?.role === 'planner';
  const isVendor = profile?.role === 'vendor';
  const isAdmin = profile?.role === 'admin';
  const isCommittee = isCommitteePlanner(profile);
  const isProfessionalPlanner = isPlanner && !isCommittee;
  const professionalSetupPending = isProfessionalSetupPending(user?.user_metadata, profile?.role, user?.email ?? null);
  const isCouple = profile?.role === 'couple' && !professionalSetupPending;
  const pendingWeddingSetup = user ? getPendingWeddingSetup(user.user_metadata, user.email ?? null) : null;
  const metadataPartnerEmail =
    typeof user?.user_metadata?.partner_email === 'string' ? user.user_metadata.partner_email : null;

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 6000, message = 'Request timed out') => {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  };

  const [form, setForm] = useState({
    full_name: '',
    partner_name: '',
    wedding_date: '',
    wedding_location: '',
    wedding_county: '',
    wedding_town: '',
    company_name: '',
    company_email: '',
    company_phone: '',
    company_website: '',
    bio: '',
    specialties: [] as string[],
    committee_name: '',
    primary_county: '',
    primary_town: '',
    service_areas: [] as string[],
    travel_scope: 'selected_counties',
    minimum_budget_kes: '',
    maximum_budget_kes: '',
  });

  const buildFallbackOwnershipSummary = (): OwnedWeddingWorkspace | null => {
    const fallbackPartnerEmail = pendingWeddingSetup?.partnerEmail ?? metadataPartnerEmail ?? null;
    const fallbackWeddingCode =
      profile?.collaboration_code ||
      (typeof user?.user_metadata?.wedding_code === 'string' ? user.user_metadata.wedding_code : '') ||
      '';
    const fallbackWeddingName =
      pendingWeddingSetup?.weddingName ||
      (typeof user?.user_metadata?.wedding_name === 'string' ? user.user_metadata.wedding_name : null) ||
      profile?.full_name ||
      'Your wedding';
    const fallbackOwnerRole =
      pendingWeddingSetup?.weddingOwnerRole ||
      (user?.user_metadata?.wedding_owner_role === 'groom' ? 'groom' : 'bride');
    const fallbackWeddingDate =
      form.wedding_date ||
      pendingWeddingSetup?.weddingDate ||
      (typeof user?.user_metadata?.wedding_date === 'string' ? user.user_metadata.wedding_date : null) ||
      null;
    const fallbackCounty =
      form.wedding_county ||
      pendingWeddingSetup?.weddingCounty ||
      (typeof user?.user_metadata?.wedding_county === 'string' ? user.user_metadata.wedding_county : null) ||
      null;
    const fallbackTown =
      form.wedding_town ||
      pendingWeddingSetup?.weddingTown ||
      (typeof user?.user_metadata?.wedding_town === 'string' ? user.user_metadata.wedding_town : null) ||
      null;

    if (!fallbackPartnerEmail && !fallbackWeddingCode && !fallbackWeddingDate && !fallbackCounty && !fallbackTown) {
      return null;
    }

    return {
      weddingId: '',
      weddingName: fallbackWeddingName,
      weddingCode: fallbackWeddingCode,
      weddingDate: fallbackWeddingDate,
      locationCounty: fallbackCounty,
      locationTown: fallbackTown,
      ownerRole: fallbackOwnerRole,
      partnerEmail: fallbackPartnerEmail,
      partnerRole: fallbackOwnerRole === 'groom' ? 'bride' : 'groom',
      partnerStatus: fallbackPartnerEmail ? 'pending' : 'not_invited',
      partnerInviteExpiresAt: null,
    };
  };

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        partner_name: profile.partner_name || '',
        wedding_date: profile.wedding_date || '',
        wedding_location: profile.wedding_location || '',
        wedding_county: profile.wedding_county || '',
        wedding_town: profile.wedding_town || '',
        company_name: profile.company_name || '',
        company_email: profile.company_email || '',
        company_phone: profile.company_phone || '',
        company_website: profile.company_website || '',
        bio: profile.bio || '',
        specialties: profile.specialties || [],
        committee_name: profile.committee_name || '',
        primary_county: profile.primary_county || '',
        primary_town: profile.primary_town || '',
        service_areas: profile.service_areas || [],
        travel_scope: profile.travel_scope || 'selected_counties',
        minimum_budget_kes: profile.minimum_budget_kes != null ? String(profile.minimum_budget_kes) : '',
        maximum_budget_kes: profile.maximum_budget_kes != null ? String(profile.maximum_budget_kes) : '',
      });
    }
  }, [profile]);

  const loadCommitteeMembers = async () => {
    if (!profile?.user_id || !isCommittee) {
      setCommitteeMembers([]);
      return;
    }
    setCommitteeLoading(true);
    try {
      const { data, error } = await supabase
        .from('wedding_committee_members')
        .select('*')
        .eq('chair_user_id', profile.user_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setCommitteeMembers((data ?? []) as CommitteeMember[]);
    } catch (err: any) {
      toast({ title: 'Failed to load committee members', description: err.message, variant: 'destructive' });
    } finally {
      setCommitteeLoading(false);
    }
  };

  useEffect(() => {
    void loadCommitteeMembers();
  }, [profile?.user_id, isCommittee]);

  const loadOwnedWeddingWorkspace = async () => {
    if (!user || !profile || !isCouple) {
      setOwnedWedding(null);
      setOwnershipError(null);
      setOwnershipLoading(false);
      return;
    }

    setOwnershipLoading(true);
    setOwnershipError(null);
    try {
      let summary = await withTimeout(
        getMyWeddingOwnershipSummary(),
        3500,
        'Loading wedding ownership details took too long.',
      );

      if (!summary) {
        summary = await withTimeout(
          getMyWeddingOwnershipSummaryFromTables(user.id, user.email ?? null),
          2500,
          'Loading wedding ownership details took too long.',
        );
      }

      if (!summary) {
        const fallbackSummary = buildFallbackOwnershipSummary();
        setOwnedWedding(fallbackSummary);
        setPartnerEmailInput(fallbackSummary?.partnerEmail ?? pendingWeddingSetup?.partnerEmail ?? metadataPartnerEmail ?? '');
        return;
      }

      setOwnedWedding(summary);
      setPartnerEmailInput(summary.partnerEmail ?? '');
      setForm((prev) => ({
        ...prev,
        wedding_date: summary.weddingDate || prev.wedding_date || '',
        wedding_county: summary.locationCounty || prev.wedding_county || '',
        wedding_town: summary.locationTown || prev.wedding_town || '',
        wedding_location: buildKenyaLocationLabel(summary.locationCounty || prev.wedding_county || '', summary.locationTown || prev.wedding_town || ''),
      }));
    } catch (error: any) {
      console.error('Could not load wedding ownership state:', error);
      const fallbackSummary = buildFallbackOwnershipSummary();
      if (fallbackSummary) {
        setOwnedWedding(fallbackSummary);
        setPartnerEmailInput(fallbackSummary.partnerEmail ?? '');
        setOwnershipError(null);
      } else {
        setOwnedWedding(null);
        setOwnershipError(error?.message || 'Could not load wedding ownership details right now.');
        setPartnerEmailInput(pendingWeddingSetup?.partnerEmail ?? metadataPartnerEmail ?? '');
      }
    } finally {
      setOwnershipLoading(false);
    }
  };

  useEffect(() => {
    void loadOwnedWeddingWorkspace();
  }, [user?.id, profile?.role]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Record<string, any> = { full_name: form.full_name };
      if (isProfessionalPlanner) {
        updates.company_name = form.company_name;
        updates.company_email = form.company_email;
        updates.company_phone = form.company_phone;
        updates.company_website = form.company_website;
        updates.bio = form.bio;
        updates.specialties = form.specialties;
        updates.primary_county = form.primary_county || null;
        updates.primary_town = form.primary_town || null;
        updates.service_areas = form.service_areas;
        updates.travel_scope = form.travel_scope;
        updates.minimum_budget_kes = form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null;
        updates.maximum_budget_kes = form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null;
      } else if (isCommittee) {
        updates.committee_name = form.committee_name;
        updates.wedding_county = form.wedding_county || null;
        updates.wedding_town = form.wedding_town || null;
        updates.wedding_location = buildKenyaLocationLabel(form.wedding_county, form.wedding_town);
      } else if (isCouple) {
        if (ownedWedding?.weddingId) {
          const { error: weddingError } = await supabase
            .from('weddings')
            .update({
              wedding_date: form.wedding_date || null,
              location_county: form.wedding_county || null,
              location_town: form.wedding_town || null,
            })
            .eq('id', ownedWedding.weddingId);

          if (weddingError) throw weddingError;
        }

        updates.partner_name = form.partner_name;
        updates.wedding_date = form.wedding_date;
        updates.wedding_county = form.wedding_county || null;
        updates.wedding_town = form.wedding_town || null;
        updates.wedding_location = buildKenyaLocationLabel(form.wedding_county, form.wedding_town);
      }
      await updateProfile(updates);
      if (isCouple) {
        await loadOwnedWeddingWorkspace();
      }
      toast({ title: 'Profile updated!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addSpecialty = () => {
    const trimmed = newSpecialty.trim();
    if (trimmed && !form.specialties.includes(trimmed)) {
      setForm(f => ({ ...f, specialties: [...f.specialties, trimmed] }));
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (s: string) => {
    setForm(f => ({ ...f, specialties: f.specialties.filter(x => x !== s) }));
  };

  const addServiceArea = () => {
    if (!serviceAreaDraft || form.service_areas.includes(serviceAreaDraft)) return;
    setForm((prev) => ({ ...prev, service_areas: [...prev.service_areas, serviceAreaDraft] }));
    setServiceAreaDraft('');
  };

  const removeServiceArea = (county: string) => {
    setForm((prev) => ({ ...prev, service_areas: prev.service_areas.filter((area) => area !== county) }));
  };

  const completeProfessionalSetup = async () => {
    if (!user || !profile) return;
    if (!professionalSetupRole) {
      toast({ title: 'Choose your account type', description: 'Pick Planner or Vendor before continuing.', variant: 'destructive' });
      return;
    }

    setCompletingProfessionalSetup(true);
    const plannerType = professionalSetupRole === 'planner' ? 'professional' : null;

    try {
      const nextMetadata = {
        ...(user.user_metadata ?? {}),
        role: professionalSetupRole,
        planner_type: plannerType,
        signup_intent: 'professional',
        professional_role_locked: true,
        wedding_setup_completed: true,
      };

      const { error: metadataError } = await supabase.auth.updateUser({ data: nextMetadata });
      if (metadataError) throw metadataError;

      await supabase.auth.refreshSession();

      const { error: applyError } = await (supabase as any).rpc('apply_current_user_signup_target', {
        target_role_text: professionalSetupRole,
        target_planner_type_text: plannerType,
        target_full_name: form.full_name || null,
        target_committee_name: null,
      });
      if (applyError) throw applyError;

      clearPendingProfessionalSetup();

      toast({
        title: 'Professional setup complete',
        description:
          professionalSetupRole === 'planner'
            ? 'Your planner account is ready. Finish your planner profile below.'
            : 'Your vendor account is now ready.',
      });

      if (professionalSetupRole === 'planner') {
        window.location.assign('/settings?setup=planner-profile');
        return;
      }

      window.location.assign(getHomeRouteForRole(professionalSetupRole, plannerType));
    } catch (error: any) {
      toast({
        title: 'Could not finish setup',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCompletingProfessionalSetup(false);
    }
  };

  const profileUrl = profile ? `${window.location.origin}/planner/${profile.id}` : '';

  const copyProfileLink = () => {
    navigator.clipboard.writeText(profileUrl);
    toast({ title: 'Link copied!', description: 'Share this link with potential clients.' });
  };

  const handleRequestPlannerVerification = async () => {
    setRequestingVerification(true);
    try {
      const { error } = await supabase.rpc('request_planner_verification' as any);
      if (error) throw error;
      toast({ title: 'Verification requested', description: 'Your planner verification request has been sent to admin.' });
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Verification request failed', description: err.message, variant: 'destructive' });
    } finally {
      setRequestingVerification(false);
    }
  };

  const plannerSubscriptionActive = plannerHasActiveSubscription(profile);
  const plannerFullAccess = plannerHasFullAccess(profile);
  const coupleExportDecision = !isPlanner && !isVendor && !isAdmin
    ? getEntitlementDecision('couple.export_progress', { profile, weddingEntitlements, couplePlanTier })
    : null;
  const committeeExportDecision = isCommittee
    ? getEntitlementDecision('committee.export_progress', { profile })
    : null;

  const addCommitteeMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.user_id) return;
    setSavingCommitteeMember(true);
    try {
      const { error } = await supabase.from('wedding_committee_members').insert({
        chair_user_id: profile.user_id,
        full_name: committeeMemberForm.full_name,
        phone: committeeMemberForm.phone,
        email: committeeMemberForm.email || null,
        responsibility: committeeMemberForm.responsibility,
        permission_level: committeeMemberForm.permission_level,
      });
      if (error) throw error;
      setCommitteeMemberForm({
        full_name: '',
        phone: '',
        email: '',
        responsibility: committeeResponsibilityOptions[0],
        permission_level: 'member',
      });
      await loadCommitteeMembers();
      toast({ title: 'Committee member added' });
    } catch (err: any) {
      toast({ title: 'Failed to add committee member', description: err.message, variant: 'destructive' });
    } finally {
      setSavingCommitteeMember(false);
    }
  };

  const removeCommitteeMember = async (memberId: string) => {
    setDeletingCommitteeMemberId(memberId);
    try {
      const { error } = await supabase.from('wedding_committee_members').delete().eq('id', memberId);
      if (error) throw error;
      await loadCommitteeMembers();
      toast({ title: 'Committee member removed' });
    } catch (err: any) {
      toast({ title: 'Failed to remove committee member', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingCommitteeMemberId(null);
    }
  };

  const repairWeddingSetup = async () => {
    if (!user || !pendingWeddingSetup) return;
    setRepairingWeddingSetup(true);

    try {
      const completion = await completePendingWeddingSetup(user);
      toast({
        title: completion.action === 'created' ? 'Wedding setup completed' : 'Wedding setup refreshed',
        description: completion.partnerInviteSent
          ? 'Your wedding is ready and the partner invite email has been sent.'
          : completion.partnerInviteQueued
            ? 'Your wedding is ready. The partner invite is stored and can be resent from Settings.'
            : 'Your wedding is ready.',
      });
      await loadOwnedWeddingWorkspace();
      window.location.replace(completion.route);
    } catch (error: any) {
      toast({
        title: 'Could not finish wedding setup',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRepairingWeddingSetup(false);
    }
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
      let description = 'Your wedding co-owner can join using the invite email or the wedding code.';

      if (inviteRow?.invite_id) {
        try {
          await sendWeddingInviteEmail(inviteRow.invite_id);
          description = 'The partner invite email has been sent and they can also use the wedding code.';
        } catch (inviteError: any) {
          description = 'The partner invite was created, but the email could not be delivered. You can resend it from here.';
          console.error('Partner invite email delivery failed from settings:', inviteError);
        }
      }

      await loadOwnedWeddingWorkspace();
      toast({
        title: ownedWedding.partnerStatus === 'pending' ? 'Partner invite refreshed' : 'Partner invite sent',
        description,
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

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          {isProfessionalPlanner
            ? 'Manage your planner profile & company details'
            : isCommittee
              ? 'Manage your committee profile, members, and access'
              : isVendor
                ? 'Manage your account settings'
                : isAdmin
                  ? 'Manage your owner profile'
                  : 'Manage your wedding profile'}
        </p>
      </div>

      {professionalSetupPending && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="font-display">Finish Your Professional Setup</CardTitle>
          <CardDescription>
            Choose whether this account is a planner or vendor account. Once saved, this cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {(['planner', 'vendor'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProfessionalSetupRole(value)}
                  className={`rounded-xl border px-4 py-4 text-left transition-all ${
                    professionalSetupRole === value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <p className="font-medium capitalize">{value}</p>
                  <p className="mt-1 text-xs">
                    {value === 'planner'
                      ? 'Use this if you will manage clients and planning workspaces.'
                      : 'Use this if you will list and manage a wedding business.'}
                  </p>
                </button>
              ))}
            </div>

            {professionalSetupRole === 'planner' && (
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                Next, we will keep you here and open your planner profile fields so you can add your business location,
                specialties, service areas, and other planner details in one place.
              </div>
            )}

            {professionalSetupRole === 'vendor' && (
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                You will add your business location on the next screen when you complete your vendor listing, so we do not ask for it twice here.
              </div>
            )}

            <Button type="button" onClick={completeProfessionalSetup} disabled={completingProfessionalSetup}>
              {completingProfessionalSetup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete professional setup
            </Button>
          </CardContent>
        </Card>
      )}

      {isPlanner && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <ExternalLink className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{isCommittee ? 'Workspace Link' : 'Public Profile'}</p>
              <p className="text-xs text-muted-foreground truncate">{isCommittee ? 'Committee accounts are not listed publicly. This link is private to your workspace.' : profileUrl}</p>
            </div>
            {!isCommittee && (
              <Button type="button" variant="outline" size="sm" onClick={copyProfileLink}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isPlanner && profile && (
        <Card className={plannerFullAccess ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-muted/20'}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {plannerFullAccess ? <ShieldCheck className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-5 w-5 text-primary" />}
              Planner Access
            </CardTitle>
            <CardDescription>
              Full planner access unlocks only after active subscription and verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={plannerSubscriptionActive ? 'secondary' : 'outline'}>
                <CreditCard className="mr-1 h-3 w-3" />
                {profile.planner_subscription_status}
              </Badge>
              <Badge variant={profile.planner_verified ? 'secondary' : 'outline'}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {profile.planner_verified ? 'Verified' : profile.planner_verification_requested ? 'Verification requested' : 'Unverified'}
              </Badge>
            </div>

            <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Current access status</p>
              <p className="mt-1">{plannerAccessMessage(profile)}</p>
              {isCommittee && profile.committee_name && (
                <p className="mt-1 text-xs">Committee: {profile.committee_name}</p>
              )}
              {profile.planner_subscription_expires_at && (
                <p className="mt-1 text-xs">
                  Subscription expiry: {new Date(profile.planner_subscription_expires_at).toLocaleDateString()}
                </p>
              )}
              {profile.planner_verification_requested_at && !profile.planner_verified && (
                <p className="mt-1 text-xs">
                  Verification requested on {new Date(profile.planner_verification_requested_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleRequestPlannerVerification}
                disabled={!plannerSubscriptionActive || profile.planner_verified || profile.planner_verification_requested || requestingVerification}
              >
                {requestingVerification ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {profile.planner_verified ? 'Already Verified' : profile.planner_verification_requested ? 'Verification Requested' : 'Request Verification'}
              </Button>
              {!plannerSubscriptionActive && (
                <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  {isCommittee ? 'Committee subscription must be activated by admin before verification can be requested.' : 'Subscription must be activated by admin before verification can be requested.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isCouple && profile && coupleExportDecision && (
        <Card className={coupleExportDecision?.allowed ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-muted/20'}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {coupleExportDecision?.allowed ? <ShieldCheck className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-5 w-5 text-primary" />}
              Wedding Plan & Exports
            </CardTitle>
            <CardDescription>
              Your wedding plan controls exports, collaboration, and the active coordination tools inside your wedding workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={coupleExportDecision?.allowed ? 'secondary' : 'outline'}>
                <CreditCard className="mr-1 h-3 w-3" />
                {couplePlanTier ? couplePlanTier.charAt(0).toUpperCase() + couplePlanTier.slice(1) : 'Free'}
              </Badge>
              <Badge variant={coupleExportDecision?.allowed ? 'secondary' : 'outline'}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {coupleExportDecision?.allowed ? 'Exports enabled' : 'Exports locked'}
              </Badge>
            </div>

            <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Current access status</p>
              <p className="mt-1">
                {coupleExportDecision?.allowed
                  ? 'Your current wedding plan includes exports. Budget, task, and vendor progress exports are available across your workspace.'
                  : 'You are still on the free plan. Exports, planner/vendor collaboration, and richer coordination tools unlock with Basic or Premium.'}
              </p>
              {profile.planning_pass_expires_at && (
                <p className="mt-1 text-xs">
                  Plan expiry: {new Date(profile.planning_pass_expires_at).toLocaleDateString()}
                </p>
              )}
              <p className="mt-1 text-xs">Admins can still manage legacy billing records from the admin portal while the wedding plan model rolls out.</p>
            </div>

            {!coupleExportDecision?.allowed ? (
              <InlineUpgradePrompt decision={coupleExportDecision} />
            ) : (
              <Button asChild variant="outline">
                <Link to={coupleExportDecision.pricingHref}>View plan details</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isCommittee && profile && committeeExportDecision && (
        <Card className={committeeExportDecision.allowed ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-muted/20'}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {committeeExportDecision.allowed ? <ShieldCheck className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-5 w-5 text-primary" />}
              Committee Pass & Exports
            </CardTitle>
            <CardDescription>
              Committee exports and calendar sync are tied to your Committee Pass, which is controlled through subscription and verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={plannerSubscriptionActive ? 'secondary' : 'outline'}>
                <CreditCard className="mr-1 h-3 w-3" />
                {profile.planner_subscription_status}
              </Badge>
              <Badge variant={profile.planner_verified ? 'secondary' : 'outline'}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {profile.planner_verified ? 'Verified' : 'Verification pending'}
              </Badge>
              <Badge variant={committeeExportDecision.allowed ? 'secondary' : 'outline'}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {committeeExportDecision.allowed ? 'Exports enabled' : 'Exports locked'}
              </Badge>
            </div>

            <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Current access status</p>
              <p className="mt-1">
                {committeeExportDecision.allowed
                  ? 'Committee exports and shared execution tools are active. You can export progress and sync schedules from the main workspace.'
                  : 'Exports stay locked until your Committee Pass is active and the workspace is verified.'}
              </p>
              {profile.planner_subscription_expires_at && (
                <p className="mt-1 text-xs">
                  Plan expiry: {new Date(profile.planner_subscription_expires_at).toLocaleDateString()}
                </p>
              )}
              <p className="mt-1 text-xs">Admin manages committee pass status from planner access controls.</p>
            </div>

            {!committeeExportDecision.allowed ? (
              <InlineUpgradePrompt decision={committeeExportDecision} />
            ) : (
              <Button asChild variant="outline">
                <Link to={committeeExportDecision.pricingHref}>View plan details</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isCouple && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-display">Wedding Ownership</CardTitle>
            <CardDescription>
              Manage your partner invite, wedding code, and the shared ownership of this wedding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ownershipLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading wedding ownership details...
              </div>
            ) : ownershipError ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{ownershipError}</p>
                <Button type="button" variant="outline" onClick={() => void loadOwnedWeddingWorkspace()}>
                  Try again
                </Button>
              </div>
            ) : ownedWedding ? (
              <>
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

                <div className="space-y-2">
                  <Label htmlFor="settings-partner-email">Partner email</Label>
                  <Input
                    id="settings-partner-email"
                    type="email"
                    value={partnerEmailInput}
                    onChange={(e) => setPartnerEmailInput(e.target.value)}
                    placeholder={ownedWedding.partnerRole === 'groom' ? 'groom@example.com' : 'bride@example.com'}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    disabled={partnerInviteSubmitting || !partnerEmailInput.trim() || !ownedWedding.weddingId}
                    onClick={sendPartnerInvite}
                  >
                    {partnerInviteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {ownedWedding.partnerStatus === 'pending' ? 'Resend partner invite' : 'Send partner invite'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This is the email your co-owner will use to join the wedding.
                  </p>
                </div>
              </>
            ) : pendingWeddingSetup ? (
              <>
                <div className="rounded-lg border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground">
                  Your wedding signup details were saved, but the wedding workspace has not finished setting up yet.
                </div>
                <div className="space-y-2">
                  <Label>Partner email</Label>
                  <Input value={pendingWeddingSetup.partnerEmail ?? ''} readOnly />
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Wedding name: <span className="font-medium text-foreground">{pendingWeddingSetup.weddingName ?? 'Not set'}</span></p>
                  <p>Owner role: <span className="font-medium capitalize text-foreground">{pendingWeddingSetup.weddingOwnerRole ?? 'Not set'}</span></p>
                </div>
                <Button type="button" onClick={repairWeddingSetup} disabled={repairingWeddingSetup}>
                  {repairingWeddingSetup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Finish wedding setup
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No wedding ownership details are available yet. If you expected a partner invite here, sign out and complete the create-wedding flow again.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Details */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Personal Details</CardTitle>
            <CardDescription>Your name and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPlanner && (
              <div className="space-y-2">
                <Label>Profile Photo / Logo</Label>
                <AvatarUpload />
              </div>
            )}
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Sign-in Email</Label>
              <Input value={user?.email || ''} readOnly />
              <p className="text-xs text-muted-foreground">
                This is the email currently tied to your account sign-in.
              </p>
            </div>
          </CardContent>
        </Card>

        {isProfessionalPlanner ? (
          <>
            {/* Company Details */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">Company Details</CardTitle>
                <CardDescription>Your wedding planning business information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Dream Weddings Kenya" />
                </div>
                <div className="space-y-2">
                  <Label>Business Email</Label>
                  <Input type="email" value={form.company_email} onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))} placeholder="info@yourcompany.com" />
                  <p className="text-xs text-muted-foreground">
                    This is the public business email couples will see. Your sign-in email is shown above.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Business Phone</Label>
                    <Input value={form.company_phone} onChange={e => setForm(f => ({ ...f, company_phone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={form.company_website} onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))} placeholder="https://yourcompany.com" />
                  </div>
                </div>
                <KenyaLocationFields
                  county={form.primary_county}
                  town={form.primary_town}
                  onCountyChange={(value) => setForm((f) => ({ ...f, primary_county: value }))}
                  onTownChange={(value) => setForm((f) => ({ ...f, primary_town: value }))}
                  countyLabel="Primary county"
                  townLabel="Primary town / area"
                />
              </CardContent>
            </Card>

            {/* Bio & Specialties */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">About You</CardTitle>
                <CardDescription>Tell clients about your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Textarea
                    value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    placeholder="Share your experience, approach, and what makes your service special..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Specialties</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newSpecialty}
                      onChange={e => setNewSpecialty(e.target.value)}
                      placeholder="e.g. Destination Weddings"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addSpecialty}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {form.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.specialties.map(s => (
                        <Badge key={s} variant="secondary" className="gap-1 pr-1">
                          {s}
                          <button type="button" onClick={() => removeSpecialty(s)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-4">
                  <div className="space-y-1">
                    <Label>Service Areas</Label>
                    <p className="text-xs text-muted-foreground">Choose counties where you are willing to take weddings.</p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={serviceAreaDraft}
                      onChange={(e) => setServiceAreaDraft(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select county</option>
                      {kenyaCounties
                        .filter((county) => !form.service_areas.includes(county))
                        .map((county) => (
                          <option key={county} value={county}>{county}</option>
                        ))}
                    </select>
                    <Button type="button" variant="outline" onClick={addServiceArea} disabled={!serviceAreaDraft}>
                      Add
                    </Button>
                  </div>
                  {form.service_areas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.service_areas.map((county) => (
                        <Badge key={county} variant="secondary" className="gap-1 pr-1">
                          {county}
                          <button type="button" onClick={() => removeServiceArea(county)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Travel Scope</Label>
                      <select
                        value={form.travel_scope}
                        onChange={(e) => setForm((prev) => ({ ...prev, travel_scope: e.target.value }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {travelScopeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Budget (KES)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.minimum_budget_kes}
                        onChange={(e) => setForm((prev) => ({ ...prev, minimum_budget_kes: e.target.value }))}
                        placeholder="e.g. 150000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Budget (KES)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.maximum_budget_kes}
                        onChange={(e) => setForm((prev) => ({ ...prev, maximum_budget_kes: e.target.value }))}
                        placeholder="e.g. 800000"
                      />
                    </div>
                  </div>
                  {formatBudgetBand(
                    form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null,
                    form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null,
                  ) && (
                    <p className="text-xs text-muted-foreground">
                      Public budget band: {formatBudgetBand(
                        form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null,
                        form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null,
                      )}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : isCommittee ? (
          <>
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display">Committee Details</CardTitle>
                <CardDescription>Set the committee name used across this wedding workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Committee Name</Label>
                  <Input
                    value={form.committee_name}
                    onChange={e => setForm(f => ({ ...f, committee_name: e.target.value }))}
                    placeholder="e.g. Mary & James Wedding Committee"
                  />
                </div>
                <KenyaLocationFields
                  county={form.wedding_county}
                  town={form.wedding_town}
                  onCountyChange={(value) => setForm((f) => ({ ...f, wedding_county: value }))}
                  onTownChange={(value) => setForm((f) => ({ ...f, wedding_town: value }))}
                  countyLabel="Wedding county"
                  townLabel="Wedding town / area"
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-primary" />
                  Committee Members
                </CardTitle>
                <CardDescription>
                  Add members, assign wedding responsibilities, and store the phone numbers attached to each role.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={addCommitteeMember} className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={committeeMemberForm.full_name}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Committee member name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={committeeMemberForm.phone}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+254..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (optional)</Label>
                    <Input
                      type="email"
                      value={committeeMemberForm.email}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="member@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsibility</Label>
                    <select
                      value={committeeMemberForm.responsibility}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, responsibility: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {committeeResponsibilityOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Permission</Label>
                    <select
                      value={committeeMemberForm.permission_level}
                      onChange={(e) => setCommitteeMemberForm((prev) => ({ ...prev, permission_level: e.target.value as CommitteeMember['permission_level'] }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {committeePermissionOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={savingCommitteeMember}>
                      {savingCommitteeMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Add Committee Member
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  {committeeLoading && <p className="text-sm text-muted-foreground">Loading committee members...</p>}
                  {!committeeLoading && committeeMembers.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                      No committee members added yet.
                    </div>
                  )}
                  {committeeMembers.map((member) => (
                    <div key={member.id} className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-background px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {member.phone}</span>
                          {member.email && <span>{member.email}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{member.responsibility}</Badge>
                          <Badge variant="secondary">{member.permission_level}</Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCommitteeMember(member.id)}
                        disabled={deletingCommitteeMemberId === member.id}
                      >
                        {deletingCommitteeMemberId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : isCouple ? (
          /* Couple: Wedding Details */
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display">Wedding Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Partner's Name</Label>
                <Input value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} placeholder="Partner's name" />
              </div>
              <div className="space-y-2">
                <Label>Spouse Email</Label>
                <Input value={partnerEmailInput || ownedWedding?.partnerEmail || pendingWeddingSetup?.partnerEmail || metadataPartnerEmail || ''} readOnly />
                <p className="text-xs text-muted-foreground">
                  This comes from your wedding ownership record and partner invite.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Wedding Date</Label>
                <Input type="date" value={form.wedding_date} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
              </div>
              <KenyaLocationFields
                county={form.wedding_county}
                town={form.wedding_town}
                onCountyChange={(value) => setForm((f) => ({ ...f, wedding_county: value }))}
                onTownChange={(value) => setForm((f) => ({ ...f, wedding_town: value }))}
                countyLabel="Wedding county"
                townLabel="Wedding town / area"
              />
            </CardContent>
          </Card>
        ) : null}

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
