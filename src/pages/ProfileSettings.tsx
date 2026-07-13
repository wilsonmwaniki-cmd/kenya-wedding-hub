import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Plus, Copy, ExternalLink, ShieldCheck, CreditCard, LockKeyhole, AlertTriangle, UserCog, Phone, BriefcaseBusiness, Store, CheckCircle2 } from 'lucide-react';
import AvatarUpload from '@/components/AvatarUpload';
import { committeeResponsibilityOptions } from '@/lib/committeeRoles';
import { isCommitteePlanner, plannerAccessMessage, plannerHasActiveSubscription, plannerHasFullAccess } from '@/lib/plannerAccess';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { getEntitlementDecision } from '@/lib/entitlements';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import InfoTip from '@/components/InfoTip';
import { normalizeExternalUrl } from '@/lib/security';
import {
  archiveWeddingWorkspace,
  completePendingWeddingSetup,
  deleteWeddingWorkspace,
  getMyWeddingOwnershipSummary,
  getMyWeddingOwnershipSummaryFromTables,
  getPendingWeddingSetup,
  getWeddingInviteDeliveryFailureMessage,
  getSuggestedReferenceCurrencyForPlanningCountry,
  getSuggestedTimezoneForPlanningCountry,
  getTimezoneOptions,
  persistPendingWeddingSetup,
  planningCountryOptions,
  sendWeddingInviteEmail,
  type MyWeddingOwnershipSummary,
  type WeddingPlanningMode,
  type WeddingOwnerRole,
  type WeddingReferenceCurrency,
  weddingReferenceCurrencyLabels,
  weddingReferenceCurrencies,
} from '@/lib/weddingWorkspace';
import KenyaLocationFields from '@/components/KenyaLocationFields';
import { kenyaCounties, travelScopeOptions, formatBudgetBand, buildKenyaLocationLabel } from '@/lib/kenyaLocations';
import { getHomeRouteForRole, isProfessionalSetupPending } from '@/lib/roles';
import { clearPendingProfessionalSetup } from '@/lib/professionalSetupState';
import { hasActiveBetaTrial } from '@/lib/betaTrial';
import { readPendingVendorClaim } from '@/lib/vendorClaimState';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { normalizeHumanName } from '@/lib/names';

type CommitteeMember = Tables<'wedding_committee_members'>;
type AccountPurpose = 'planning_my_own_wedding' | 'helping_family_or_friend' | 'professional_planner' | 'vendor' | 'other';

interface OwnedWeddingWorkspace extends MyWeddingOwnershipSummary {}

const committeePermissionOptions = ['chair', 'member', 'viewer'] as const;
const accountPurposeOptions: Array<{ value: AccountPurpose; label: string }> = [
  { value: 'planning_my_own_wedding', label: 'I am planning my own wedding' },
  { value: 'helping_family_or_friend', label: 'I am helping a family member or friend' },
  { value: 'professional_planner', label: 'I am a professional wedding planner' },
  { value: 'vendor', label: 'I am a wedding vendor' },
  { value: 'other', label: 'Other' },
];
export default function ProfileSettings() {
  const { user, profile, updateProfile, signOut, deviceSessions, signOutOtherDevices } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [committeeLoading, setCommitteeLoading] = useState(false);
  const [savingCommitteeMember, setSavingCommitteeMember] = useState(false);
  const [committeeFormErrors, setCommitteeFormErrors] = useState<Record<string, string>>({});
  const [committeeSubmitError, setCommitteeSubmitError] = useState<string | null>(null);
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
  const [archivingWedding, setArchivingWedding] = useState(false);
  const [deletingWedding, setDeletingWedding] = useState(false);
  const [weddingDeletionReason, setWeddingDeletionReason] = useState('');
  const [setupWeddingName, setSetupWeddingName] = useState('');
  const [setupWeddingOwnerRole, setSetupWeddingOwnerRole] = useState<WeddingOwnerRole | null>(null);
  const [professionalSetupRole, setProfessionalSetupRole] = useState<'planner' | 'vendor' | null>(null);
  const [completingProfessionalSetup, setCompletingProfessionalSetup] = useState(false);
  const [privacyAction, setPrivacyAction] = useState<'marketing' | 'directory' | 'delete' | null>(null);
  const [deletePrivacyConfirm, setDeletePrivacyConfirm] = useState('');
  const [signingOutOtherDevices, setSigningOutOtherDevices] = useState(false);

  const isPlanner = profile?.role === 'planner';
  const isVendor = profile?.role === 'vendor';
  const isAdmin = profile?.role === 'admin';
  const isCommittee = isCommitteePlanner(profile);
  const isProfessionalPlanner = isPlanner && !isCommittee;
  const professionalSetupPending = isProfessionalSetupPending(user?.user_metadata, profile?.role, user?.email ?? null);
  const isCouple = profile?.role === 'couple' && !professionalSetupPending;
  const isProfessionalWorkspace = professionalSetupPending || isPlanner || isVendor || isCommittee;
  const canOptOutOfDirectory = isProfessionalPlanner || isVendor;
  const setupMode = searchParams.get('setup');
  const plannerProfileSetupMode = setupMode === 'planner-profile';
  const pendingWeddingSetup = user ? getPendingWeddingSetup(user.user_metadata, user.email ?? null) : null;
  const metadataPartnerEmail =
    typeof user?.user_metadata?.partner_email === 'string' ? user.user_metadata.partner_email : null;
  const metadataPlanningMode: WeddingPlanningMode =
    user?.user_metadata?.planning_mode === 'diaspora' ? 'diaspora' : 'local';
  const metadataPlanningCountry =
    typeof user?.user_metadata?.planning_country === 'string' ? user.user_metadata.planning_country : '';
  const metadataReferenceCurrency =
    user?.user_metadata?.reference_currency === 'GBP'
    || user?.user_metadata?.reference_currency === 'USD'
    || user?.user_metadata?.reference_currency === 'EUR'
    || user?.user_metadata?.reference_currency === 'CAD'
    || user?.user_metadata?.reference_currency === 'AUD'
      ? (user.user_metadata.reference_currency as WeddingReferenceCurrency)
      : '';
  const metadataOwnerTimezone =
    typeof user?.user_metadata?.owner_timezone === 'string' ? user.user_metadata.owner_timezone : '';
  const timezoneOptions = getTimezoneOptions();
  const pendingVendorClaim = readPendingVendorClaim();

  useEffect(() => {
    if (!professionalSetupPending || !pendingVendorClaim) return;
    setProfessionalSetupRole((current) => current ?? 'vendor');
  }, [pendingVendorClaim, professionalSetupPending]);

  useEffect(() => {
    if (!professionalSetupPending) return;

    const metadataRole =
      user?.user_metadata?.role === 'planner' || user?.user_metadata?.role === 'vendor'
        ? user.user_metadata.role
        : null;
    const fallbackRole = metadataRole ?? (profile?.role === 'planner' || profile?.role === 'vendor' ? profile.role : null);

    if (!fallbackRole) return;
    setProfessionalSetupRole((current) => current ?? fallbackRole);
  }, [professionalSetupPending, profile?.role, user?.user_metadata?.role]);

  const buildSuggestedWeddingName = (name: string) => {
    const firstName = name.trim().split(/\s+/)[0];
    return firstName ? `${firstName}'s Wedding` : 'Our Wedding';
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 6000, message = 'Request timed out') => {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  };

  const [form, setForm] = useState({
    account_purpose: 'planning_my_own_wedding' as AccountPurpose,
    full_name: '',
    partner_name: '',
    wedding_date: '',
    wedding_location: '',
    wedding_county: '',
    wedding_town: '',
    planning_mode: 'local' as WeddingPlanningMode,
    planning_country: '',
    reference_currency: '' as WeddingReferenceCurrency | '',
    owner_timezone: '',
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

  const ownershipPartnerEmail = useMemo(
    () => ownedWedding?.partnerEmail ?? pendingWeddingSetup?.partnerEmail ?? metadataPartnerEmail ?? '',
    [metadataPartnerEmail, ownedWedding?.partnerEmail, pendingWeddingSetup?.partnerEmail],
  );

  const resolvedPartnerEmail = useMemo(
    () => partnerEmailInput || ownershipPartnerEmail,
    [ownershipPartnerEmail, partnerEmailInput],
  );

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
        account_purpose: (profile.account_purpose as AccountPurpose | null) ?? 'planning_my_own_wedding',
        full_name: profile.full_name || '',
        partner_name: profile.partner_name || '',
        wedding_date: profile.wedding_date || '',
        wedding_location: profile.wedding_location || '',
        wedding_county: profile.wedding_county || '',
        wedding_town: profile.wedding_town || '',
        planning_mode: pendingWeddingSetup?.planningMode ?? metadataPlanningMode,
        planning_country: pendingWeddingSetup?.planningCountry ?? metadataPlanningCountry,
        reference_currency: pendingWeddingSetup?.referenceCurrency ?? metadataReferenceCurrency,
        owner_timezone: pendingWeddingSetup?.ownerTimezone ?? metadataOwnerTimezone,
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

  useEffect(() => {
    const metadataWeddingName =
      typeof user?.user_metadata?.wedding_name === 'string' ? user.user_metadata.wedding_name : '';
    const metadataWeddingOwnerRole =
      user?.user_metadata?.wedding_owner_role === 'bride' || user?.user_metadata?.wedding_owner_role === 'groom'
        ? (user.user_metadata.wedding_owner_role as WeddingOwnerRole)
        : null;

    setSetupWeddingName(
      pendingWeddingSetup?.weddingName
        || metadataWeddingName
        || buildSuggestedWeddingName(form.full_name || profile?.full_name || ''),
    );
    setSetupWeddingOwnerRole(pendingWeddingSetup?.weddingOwnerRole ?? metadataWeddingOwnerRole);
  }, [pendingWeddingSetup?.weddingName, pendingWeddingSetup?.weddingOwnerRole, form.full_name, profile?.full_name, user?.user_metadata]);

  useEffect(() => {
    if (form.planning_mode !== 'diaspora') return;
    const suggestedTimezone = getSuggestedTimezoneForPlanningCountry(form.planning_country);
    const suggestedCurrency = getSuggestedReferenceCurrencyForPlanningCountry(form.planning_country);
    if (
      (!suggestedTimezone || form.owner_timezone === suggestedTimezone) &&
      (!suggestedCurrency || form.reference_currency === suggestedCurrency)
    ) {
      return;
    }
    setForm((current) => ({
      ...current,
      owner_timezone: suggestedTimezone ?? current.owner_timezone,
      reference_currency: suggestedCurrency ?? current.reference_currency,
    }));
  }, [form.owner_timezone, form.planning_country, form.planning_mode, form.reference_currency]);

  const loadWeddingPlanningSettings = async (weddingId: string) => {
    const { data, error } = await (supabase as any)
      .from('weddings')
      .select('planning_mode, planning_country, reference_currency, owner_timezone')
      .eq('id', weddingId)
      .maybeSingle();

    if (error) throw error;

    return {
      planningMode: data?.planning_mode === 'diaspora' ? 'diaspora' : 'local',
      planningCountry: typeof data?.planning_country === 'string' ? data.planning_country : '',
      referenceCurrency:
        data?.reference_currency === 'GBP'
        || data?.reference_currency === 'USD'
        || data?.reference_currency === 'EUR'
        || data?.reference_currency === 'CAD'
        || data?.reference_currency === 'AUD'
          ? (data.reference_currency as WeddingReferenceCurrency)
          : '',
      ownerTimezone: typeof data?.owner_timezone === 'string' ? data.owner_timezone : '',
    };
  };

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

      const resolvedOwnershipPartnerEmail =
        summary.partnerEmail
        ?? pendingWeddingSetup?.partnerEmail
        ?? metadataPartnerEmail
        ?? '';

      setOwnedWedding(summary);
      setPartnerEmailInput(resolvedOwnershipPartnerEmail);
      const planningSettings = summary.weddingId ? await loadWeddingPlanningSettings(summary.weddingId) : null;
      setForm((prev) => ({
        ...prev,
        wedding_date: summary.weddingDate || prev.wedding_date || '',
        wedding_county: summary.locationCounty || prev.wedding_county || '',
        wedding_town: summary.locationTown || prev.wedding_town || '',
        wedding_location: buildKenyaLocationLabel(summary.locationCounty || prev.wedding_county || '', summary.locationTown || prev.wedding_town || ''),
        planning_mode: planningSettings?.planningMode ?? prev.planning_mode,
        planning_country: planningSettings?.planningCountry ?? prev.planning_country,
        reference_currency: planningSettings?.referenceCurrency ?? prev.reference_currency,
        owner_timezone: planningSettings?.ownerTimezone ?? prev.owner_timezone,
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
    const nextErrors: Record<string, string> = {};
    const minimumBudget = form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null;
    const maximumBudget = form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null;

    if (isProfessionalPlanner) {
      if (!form.full_name.trim()) nextErrors.full_name = 'Add your full name before saving your planner profile.';
      if (!form.company_name.trim()) nextErrors.company_name = 'Add your business name before saving your planner profile.';
      if (!form.company_email.trim()) nextErrors.company_email = 'Add your business email before saving your planner profile.';
      else if (!/\S+@\S+\.\S+/.test(form.company_email.trim())) nextErrors.company_email = 'Enter a valid business email.';
      if (!form.company_phone.trim()) nextErrors.company_phone = 'Add your business phone before saving your planner profile.';
      if (!form.bio.trim()) nextErrors.bio = 'Add a short bio so couples can understand your experience.';
      if (form.specialties.length === 0) nextErrors.specialties = 'Add at least one specialty before saving your planner profile.';
      if (!form.primary_county.trim()) nextErrors.primary_county = 'Choose your primary county before saving your planner profile.';
      if (form.service_areas.length === 0) nextErrors.service_areas = 'Add at least one service area before saving your planner profile.';
      if (minimumBudget === null || Number.isNaN(minimumBudget)) nextErrors.minimum_budget_kes = 'Add your minimum budget before saving your planner profile.';
      if (maximumBudget === null || Number.isNaN(maximumBudget)) nextErrors.maximum_budget_kes = 'Add your maximum budget before saving your planner profile.';
      else if (minimumBudget !== null && !Number.isNaN(minimumBudget) && maximumBudget < minimumBudget) {
        nextErrors.maximum_budget_kes = 'Maximum budget must be greater than or equal to minimum budget.';
      }
    }

    if (isCouple && form.planning_mode === 'diaspora') {
      if (!form.planning_country.trim()) nextErrors.planning_country = 'Add the country you are planning from before saving diaspora mode.';
      if (!form.reference_currency) nextErrors.reference_currency = 'Choose a reference currency before saving diaspora mode.';
      if (!form.owner_timezone.trim()) nextErrors.owner_timezone = 'Add your timezone before saving diaspora mode.';
    }

    setFormErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const updates: Record<string, any> = { full_name: form.full_name, account_purpose: form.account_purpose };
      if (isProfessionalPlanner) {
        updates.company_name = form.company_name;
        updates.company_email = form.company_email;
        updates.company_phone = form.company_phone;
        updates.company_website = normalizeExternalUrl(form.company_website);
        updates.bio = form.bio;
        updates.specialties = form.specialties;
        updates.primary_county = form.primary_county || null;
        updates.primary_town = form.primary_town || null;
        updates.service_areas = form.service_areas;
        updates.travel_scope = form.travel_scope;
        updates.minimum_budget_kes = minimumBudget;
        updates.maximum_budget_kes = maximumBudget;
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
              planning_mode: form.planning_mode,
              planning_country: form.planning_mode === 'diaspora' ? form.planning_country || null : null,
              reference_currency: form.planning_mode === 'diaspora' ? form.reference_currency || null : null,
              owner_timezone: form.planning_mode === 'diaspora' ? form.owner_timezone || null : null,
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

      if (isProfessionalPlanner && plannerProfileSetupMode) {
        searchParams.delete('setup');
        setSearchParams(searchParams, { replace: true });
        navigate('/clients', { replace: true });
      }
    } catch (err: any) {
      setSubmitError(err.message || 'We could not save your settings right now.');
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

      if (pendingVendorClaim) {
        window.location.assign('/vendor-claim');
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

  const handleArchiveWedding = async () => {
    if (!ownedWedding?.weddingId) return;
    if (!window.confirm('Archive this wedding workspace? You can keep its history without showing it in the active dashboard.')) {
      return;
    }

    setArchivingWedding(true);
    try {
      await archiveWeddingWorkspace(ownedWedding.weddingId);
      await loadOwnedWeddingWorkspace();
      toast({
        title: 'Wedding archived',
        description: 'The workspace is hidden from the active dashboard and can be restored later by support or admin review.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not archive wedding',
        description: error.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setArchivingWedding(false);
    }
  };

  const handleDeleteWedding = async () => {
    if (!ownedWedding?.weddingId) return;
    if (!window.confirm('Delete this wedding workspace? Zania will soft-delete it and preserve limited lifecycle history for support review and abuse prevention.')) {
      return;
    }

    setDeletingWedding(true);
    try {
      await deleteWeddingWorkspace(ownedWedding.weddingId, weddingDeletionReason.trim() || null);
      setWeddingDeletionReason('');
      await loadOwnedWeddingWorkspace();
      toast({
        title: 'Wedding deleted',
        description: 'The workspace is no longer active, but its replacement eligibility and lifecycle history were preserved.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not delete wedding',
        description: error.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingWedding(false);
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
  const betaTrialActive = hasActiveBetaTrial(profile);
  const coupleExportDecision = !isPlanner && !isVendor && !isAdmin
    ? getEntitlementDecision('couple.export_progress', { profile, weddingEntitlements, couplePlanTier })
    : null;
  const committeeExportDecision = isCommittee
    ? getEntitlementDecision('committee.export_progress', { profile })
    : null;

  const addCommitteeMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.user_id) return;
    const nextErrors: Record<string, string> = {};
    if (!committeeMemberForm.full_name.trim()) nextErrors.full_name = 'Enter the committee member name.';
    if (!committeeMemberForm.phone.trim()) nextErrors.phone = 'Enter the committee member phone number.';
    else if (!/^[\d+\s()-]{7,}$/.test(committeeMemberForm.phone.trim())) nextErrors.phone = 'Enter a valid phone number.';
    if (committeeMemberForm.email.trim() && !/\S+@\S+\.\S+/.test(committeeMemberForm.email.trim())) {
      nextErrors.email = 'Enter a valid email address or leave it blank.';
    }
    setCommitteeFormErrors(nextErrors);
    setCommitteeSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

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
      setCommitteeSubmitError(err.message || 'We could not add this committee member right now.');
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
      if (pendingWeddingSetup.intent === 'create_wedding') {
        if (!setupWeddingOwnerRole) {
          throw new Error('Choose whether you are starting this wedding as the bride or the groom.');
        }

        if (!partnerEmailInput.trim()) {
          throw new Error('Add your spouse email before finishing wedding setup.');
        }

        if (form.planning_mode === 'diaspora') {
          if (!form.planning_country.trim()) {
            throw new Error('Choose the country you are planning from before saving diaspora mode.');
          }

          if (!form.reference_currency) {
            throw new Error('Choose a reference currency before saving diaspora mode.');
          }

          if (!form.owner_timezone.trim()) {
            throw new Error('Choose your timezone before saving diaspora mode.');
          }
        }

        persistPendingWeddingSetup({
          ...pendingWeddingSetup,
          intent: 'create_wedding',
          email: user.email ?? pendingWeddingSetup.email ?? null,
          weddingOwnerRole: setupWeddingOwnerRole,
          partnerEmail: partnerEmailInput.trim().toLowerCase(),
          weddingName: setupWeddingName.trim() || buildSuggestedWeddingName(form.full_name || profile?.full_name || ''),
          weddingCounty: form.wedding_county || null,
          weddingTown: form.wedding_town || null,
          weddingDate: form.wedding_date || null,
          planningMode: form.planning_mode,
          planningCountry: form.planning_mode === 'diaspora' ? form.planning_country.trim() || null : null,
          referenceCurrency: form.planning_mode === 'diaspora' ? form.reference_currency || null : null,
          ownerTimezone: form.planning_mode === 'diaspora' ? form.owner_timezone.trim() || null : null,
        });
      }

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
          description = getWeddingInviteDeliveryFailureMessage(
            inviteError,
            'The partner invite was created, but the email could not be delivered right now.',
          );
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

  const handleMarketingOptOutUpdate = async (nextOptOut: boolean) => {
    setPrivacyAction('marketing');

    try {
      const { error } = await (supabase as any).rpc('set_self_marketing_opt_out', {
        new_opt_out: nextOptOut,
      });
      if (error) throw error;

      await updateProfile({
        marketing_opt_out: nextOptOut,
        marketing_opt_out_at: nextOptOut ? new Date().toISOString() : null,
      });

      toast({
        title: nextOptOut ? 'Emails unsubscribed' : 'Emails resumed',
        description: nextOptOut
          ? 'You will no longer receive Zania marketing emails.'
          : 'Zania email updates have been turned back on.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not update email preference',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPrivacyAction(null);
    }
  };

  const handleDirectoryOptOutUpdate = async (nextOptOut: boolean) => {
    setPrivacyAction('directory');

    try {
      const { error } = await (supabase as any).rpc('set_self_directory_opt_out', {
        new_opt_out: nextOptOut,
      });
      if (error) throw error;

      await updateProfile({
        directory_opt_out: nextOptOut,
        directory_opt_out_at: nextOptOut ? new Date().toISOString() : null,
      });

      toast({
        title: nextOptOut ? 'Public profile hidden' : 'Public profile restored',
        description: nextOptOut
          ? 'Your planner or vendor profile is now hidden from the public directory.'
          : 'Your planner or vendor profile can appear publicly again.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not update directory visibility',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPrivacyAction(null);
    }
  };

  const handleDeleteProfileData = async () => {
    if (deletePrivacyConfirm.trim().toUpperCase() !== 'DELETE') {
      toast({
        title: 'Confirmation required',
        description: 'Type DELETE before removing your Zania profile information.',
        variant: 'destructive',
      });
      return;
    }

    setPrivacyAction('delete');

    try {
      const { error } = await (supabase as any).rpc('delete_my_zania_profile_data');
      if (error) throw error;

      toast({
        title: 'Your information has been removed',
        description: 'Your Zania profile-facing information was deleted and your account has been opted out.',
      });

      await signOut();
      navigate('/sign-in', { replace: true });
    } catch (error: any) {
      toast({
        title: 'Could not remove your information',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPrivacyAction(null);
    }
  };

  const handleSignOutOtherDevices = async () => {
    setSigningOutOtherDevices(true);

    try {
      const signedOutCount = await signOutOtherDevices();
      toast({
        title: signedOutCount > 0 ? 'Other devices signed out' : 'No other active devices',
        description: signedOutCount > 0
          ? `Signed out ${signedOutCount} other device${signedOutCount === 1 ? '' : 's'}.`
          : 'This looks like your only active trusted device right now.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not sign out other devices',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSigningOutOtherDevices(false);
    }
  };

  return (
    <div
      className={
        isCouple
          ? 'max-w-6xl space-y-6'
          : isProfessionalWorkspace
            ? 'max-w-4xl space-y-6'
            : 'max-w-xl space-y-6'
      }
    >
      <div>
        <h1 className="workspace-h1">Settings</h1>
        <p className="text-muted-foreground">
          {professionalSetupPending
            ? 'Choose your account type and finish your business profile.'
            : isProfessionalPlanner
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
        <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(180deg,rgba(241,115,64,0.08),rgba(255,255,255,0.96)_48%)] shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" className="border border-primary/20 bg-background/80 text-foreground">
                Professional onboarding
              </Badge>
              <Badge variant="outline" className="border-primary/25 bg-background/65 text-muted-foreground">
                1 step left
              </Badge>
            </div>
            <div className="max-w-3xl space-y-2">
              <CardTitle className="font-display text-4xl leading-tight sm:text-[2.7rem]">
                Finish Your Professional Setup
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
                Choose whether this account will operate as a planner or a vendor. Once you save this choice, we tailor the rest of your workspace around it and it cannot be changed later.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {(['planner', 'vendor'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProfessionalSetupRole(value)}
                  className={`rounded-2xl border px-5 py-5 text-left transition-all ${
                    professionalSetupRole === value
                      ? 'border-primary bg-background shadow-[0_14px_36px_rgba(241,115,64,0.12)]'
                      : 'border-border/60 bg-background/80 text-muted-foreground hover:border-primary/40 hover:bg-background'
                  }`}
                  aria-pressed={professionalSetupRole === value}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`grid h-11 w-11 place-items-center rounded-2xl ${
                      professionalSetupRole === value ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {value === 'planner' ? <BriefcaseBusiness className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                    </div>
                    {professionalSetupRole === value ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : null}
                  </div>
                  <p className="mt-5 text-2xl font-semibold capitalize text-foreground">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {value === 'planner'
                      ? 'Use this if you will manage clients and planning workspaces.'
                      : 'Use this if you will list and manage a wedding business.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(value === 'planner'
                      ? ['Client workspaces', 'Planning operations', 'Business profile']
                      : ['Vendor listing', 'Packages & offers', 'Business profile']
                    ).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-border/60 bg-muted/35 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="rounded-2xl border border-border/60 bg-background/90 p-5 text-sm text-muted-foreground shadow-sm">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">What happens next</p>
                  <InfoTip
                    content={professionalSetupRole === 'planner'
                      ? 'Planner accounts stay here first so you can finish your business profile, location, specialties, and service areas without leaving settings.'
                      : professionalSetupRole === 'vendor'
                        ? 'Vendor accounts move into the listing flow so you can add business details and storefront information without repeating work.'
                        : 'Choose the account type that best matches how you plan to use Zania, then the app will guide you into the right business setup flow.'}
                  />
                </div>
                <p className="mt-2 leading-7">
                  {professionalSetupRole
                    ? 'You’ll continue into the right business setup flow.'
                    : 'Choose the account type that matches your work.'}
                </p>
              </div>

              <Button
                type="button"
                onClick={completeProfessionalSetup}
                disabled={completingProfessionalSetup || !professionalSetupRole}
                className="w-full lg:min-w-[280px]"
              >
                {completingProfessionalSetup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {professionalSetupRole
                  ? `Continue as ${professionalSetupRole}`
                  : 'Choose an account type first'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPlanner && (
        <Card className="semantic-surface-info shadow-card">
          <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center">
            <ExternalLink className="h-4 w-4 shrink-0 text-info" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{isCommittee ? 'Workspace Link' : 'Public Profile'}</p>
              <p className="text-xs text-muted-foreground truncate">{isCommittee ? 'Committee accounts are not listed publicly. This link is private to your workspace.' : profileUrl}</p>
            </div>
            {!isCommittee && (
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={copyProfileLink}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isPlanner && profile && (
        <Card className={plannerFullAccess ? 'semantic-surface-success' : 'semantic-surface-warning'}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {plannerFullAccess ? <ShieldCheck className="h-5 w-5 text-success" /> : <LockKeyhole className="h-5 w-5 text-warning" />}
              Planner Access
            </CardTitle>
            <CardDescription>
              Full planner access unlocks only after active subscription and verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={plannerSubscriptionActive ? 'success' : 'outline'}>
                <CreditCard className="mr-1 h-3 w-3" />
                {betaTrialActive && profile.planner_subscription_status === 'inactive' ? 'trial' : profile.planner_subscription_status}
              </Badge>
              <Badge variant={profile.planner_verified ? 'success' : 'outline'}>
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
                <div className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--warning-soft-border))] bg-[hsl(var(--warning-soft))] px-3 py-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {isCommittee ? 'Committee subscription must be activated by admin before verification can be requested.' : 'Subscription must be activated by admin before verification can be requested.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isCommittee && profile && committeeExportDecision && (
        <Card className={committeeExportDecision.allowed ? 'semantic-surface-success' : 'semantic-surface-warning'}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {committeeExportDecision.allowed ? <ShieldCheck className="h-5 w-5 text-success" /> : <LockKeyhole className="h-5 w-5 text-warning" />}
              Committee Pass & Exports
            </CardTitle>
            <CardDescription>
              Committee exports and calendar sync are tied to your Committee Pass, which is controlled through subscription and verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={plannerSubscriptionActive ? 'success' : 'outline'}>
                <CreditCard className="mr-1 h-3 w-3" />
                {betaTrialActive && profile.planner_subscription_status === 'inactive' ? 'trial' : profile.planner_subscription_status}
              </Badge>
              <Badge variant={profile.planner_verified ? 'success' : 'outline'}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {profile.planner_verified ? 'Verified' : 'Verification pending'}
              </Badge>
              <Badge variant={committeeExportDecision.allowed ? 'success' : 'outline'}>
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:items-start">
          {profile && coupleExportDecision ? (
            <Card className={`h-full shadow-card ${coupleExportDecision?.allowed ? 'semantic-surface-success' : 'semantic-surface-warning'}`}>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  {coupleExportDecision?.allowed ? <ShieldCheck className="h-5 w-5 text-success" /> : <LockKeyhole className="h-5 w-5 text-warning" />}
                  Wedding Plan & Exports
                </CardTitle>
                <CardDescription>
                  Your wedding plan controls exports, collaboration, and the active coordination tools inside your wedding workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={coupleExportDecision?.allowed ? 'info' : 'outline'}>
                    <CreditCard className="mr-1 h-3 w-3" />
                    {couplePlanTier ? couplePlanTier.charAt(0).toUpperCase() + couplePlanTier.slice(1) : 'Free'}
                  </Badge>
                  <Badge variant={coupleExportDecision?.allowed ? 'success' : 'outline'}>
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
          ) : null}

          <Card className="semantic-surface-info h-full shadow-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="font-display">Wedding Ownership</CardTitle>
                <InfoTip content="Use this section to manage your partner invite, wedding code, and who has shared ownership of the wedding workspace." />
              </div>
              <CardDescription>Partner invite, code, and shared ownership.</CardDescription>
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
                      <Badge
                        variant={
                          ownedWedding.partnerStatus === 'active'
                            ? 'success'
                            : ownedWedding.partnerStatus === 'pending'
                              ? 'warning'
                              : 'outline'
                        }
                      >
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

                  <div className="space-y-2 rounded-xl border border-border/70 bg-background px-4 py-4">
                    <p className="text-sm font-medium text-foreground">Wedding lifecycle</p>
                    <p className="text-xs text-muted-foreground">
                      If this wedding was created by mistake, you can archive it or delete it. Deletion is soft-deleted and does not automatically reset free-plan eligibility.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="wedding-deletion-reason">Reason (optional)</Label>
                      <Input
                        id="wedding-deletion-reason"
                        value={weddingDeletionReason}
                        onChange={(e) => setWeddingDeletionReason(e.target.value)}
                        placeholder="Created by mistake, date changed, wedding cancelled..."
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={handleArchiveWedding} disabled={archivingWedding || deletingWedding}>
                        {archivingWedding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Archive wedding
                      </Button>
                      <Button type="button" variant="destructive" onClick={handleDeleteWedding} disabled={archivingWedding || deletingWedding}>
                        {deletingWedding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete test wedding
                      </Button>
                    </div>
                  </div>
                </>
              ) : pendingWeddingSetup?.intent === 'create_wedding' ? (
                <>
                  <div className="rounded-lg border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground">
                    Your account is ready. Finish the wedding details here and we’ll create the shared wedding workspace for both of you.
                  </div>
                  <div className="space-y-2">
                    <Label>Wedding name</Label>
                    <Input
                      value={setupWeddingName}
                      onChange={(e) => setSetupWeddingName(e.target.value)}
                      placeholder="e.g. Mary & James Wedding"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>I am starting this wedding as</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        { value: 'bride', title: 'I am the bride', copy: 'We’ll invite the groom as the second owner.' },
                        { value: 'groom', title: 'I am the groom', copy: 'We’ll invite the bride as the second owner.' },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSetupWeddingOwnerRole(option.value)}
                          className={`rounded-xl border px-4 py-3 text-left transition-all ${
                            setupWeddingOwnerRole === option.value
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          <p className="font-medium">{option.title}</p>
                          <p className="mt-1 text-xs">{option.copy}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Partner email</Label>
                    <Input
                      type="email"
                      value={partnerEmailInput}
                      onChange={(e) => setPartnerEmailInput(e.target.value)}
                      placeholder={setupWeddingOwnerRole === 'bride' ? 'groom@example.com' : 'bride@example.com'}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the email your spouse will sign in with.
                    </p>
                  </div>
                  <Button type="button" onClick={repairWeddingSetup} disabled={repairingWeddingSetup}>
                    {repairingWeddingSetup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create wedding workspace
                  </Button>
                </>
              ) : pendingWeddingSetup ? (
                <>
                  <div className="rounded-lg border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground">
                    Your signup details were saved, but the shared wedding workspace has not finished setting up yet.
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
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <FormSubmitError message={submitError} />
        {/* Personal Details */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Personal Details</CardTitle>
            <CardDescription>Your name and contact information</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {isPlanner && (
              <div className="space-y-2 md:col-span-2">
                <Label>Profile Photo / Logo</Label>
                <AvatarUpload />
              </div>
            )}
            <div className="space-y-2">
              <Label>Full Name{isProfessionalPlanner ? ' *' : ''}</Label>
              <Input value={form.full_name} onChange={e => {
                setForm(f => ({ ...f, full_name: e.target.value }));
                setFormErrors((current) => ({ ...current, full_name: '' }));
                setSubmitError(null);
              }} onBlur={() => {
                if (!form.full_name.trim()) return;
                setForm((current) => ({ ...current, full_name: normalizeHumanName(current.full_name) }));
              }} required={isProfessionalPlanner} />
              <FormFieldError message={formErrors.full_name} />
            </div>
            <div className="space-y-2">
              <Label>Account purpose</Label>
              <Select value={form.account_purpose} onValueChange={(value: AccountPurpose) => setForm((current) => ({ ...current, account_purpose: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose how you use Zania" />
                </SelectTrigger>
                <SelectContent>
                  {accountPurposeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This helps Zania guide you into the right workspace and collaboration plan.
              </p>
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

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Device Sessions</CardTitle>
            <CardDescription>See where your account is active and sign out old devices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Current trusted devices</p>
                <p className="text-xs text-muted-foreground">
                  Free Intimate accounts stay limited to one active trusted device at a time.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleSignOutOtherDevices} disabled={signingOutOtherDevices}>
                {signingOutOtherDevices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign out other devices
              </Button>
            </div>

            <div className="space-y-3">
              {deviceSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No device sessions have been recorded yet.</p>
              ) : deviceSessions.map((device) => (
                <div key={device.id} className="rounded-lg border border-border/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{device.device_name || `${device.browser || 'Browser'} on ${device.platform || 'device'}`}</p>
                      <p className="text-xs text-muted-foreground">
                        Last active {new Date(device.last_seen_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {device.is_current && !device.revoked_at ? <Badge variant="secondary">Current</Badge> : null}
                      {device.trusted_at && !device.revoked_at ? <Badge variant="outline">Trusted</Badge> : null}
                      {device.revoked_at ? <Badge variant="destructive">Signed out</Badge> : null}
                    </div>
                  </div>
                </div>
              ))}
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
                  <Label>Company Name *</Label>
                  <Input value={form.company_name} onChange={e => {
                    setForm(f => ({ ...f, company_name: e.target.value }));
                    setFormErrors((current) => ({ ...current, company_name: '' }));
                    setSubmitError(null);
                  }} placeholder="e.g. Dream Weddings Kenya" required />
                  <FormFieldError message={formErrors.company_name} />
                </div>
                <div className="space-y-2">
                  <Label>Business Email *</Label>
                  <Input type="email" value={form.company_email} onChange={e => {
                    setForm(f => ({ ...f, company_email: e.target.value }));
                    setFormErrors((current) => ({ ...current, company_email: '' }));
                    setSubmitError(null);
                  }} placeholder="info@yourcompany.com" required />
                  <FormFieldError message={formErrors.company_email} />
                  <p className="text-xs text-muted-foreground">
                    This is the public business email couples will see. Your sign-in email is shown above.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Business Phone *</Label>
                    <Input value={form.company_phone} onChange={e => {
                      setForm(f => ({ ...f, company_phone: e.target.value }));
                      setFormErrors((current) => ({ ...current, company_phone: '' }));
                      setSubmitError(null);
                    }} placeholder="+254 7XX XXX XXX" required />
                    <FormFieldError message={formErrors.company_phone} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={form.company_website} onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))} placeholder="https://yourcompany.com" />
                  </div>
                </div>
                <KenyaLocationFields
                  county={form.primary_county}
                  town={form.primary_town}
                  onCountyChange={(value) => {
                    setForm((f) => ({ ...f, primary_county: value }));
                    setFormErrors((current) => ({ ...current, primary_county: '' }));
                    setSubmitError(null);
                  }}
                  onTownChange={(value) => setForm((f) => ({ ...f, primary_town: value }))}
                  countyLabel="Primary county *"
                  townLabel="Primary town / area"
                />
                <FormFieldError message={formErrors.primary_county} />
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
                  <Label>Bio *</Label>
                  <Textarea
                    value={form.bio}
                    onChange={e => {
                      setForm(f => ({ ...f, bio: e.target.value }));
                      setFormErrors((current) => ({ ...current, bio: '' }));
                      setSubmitError(null);
                    }}
                    placeholder="Share your experience, approach, and what makes your service special..."
                    rows={4}
                    required
                  />
                  <FormFieldError message={formErrors.bio} />
                </div>
                <div className="space-y-2">
                  <Label>Specialties *</Label>
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
                        <Badge key={s} variant="info" className="gap-1 pr-1">
                          {s}
                          <button type="button" onClick={() => removeSpecialty(s)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormFieldError message={formErrors.specialties} />
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-4">
                  <div className="space-y-1">
                    <Label>Service Areas *</Label>
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
                        <Badge key={county} variant="info" className="gap-1 pr-1">
                          {county}
                          <button type="button" onClick={() => removeServiceArea(county)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormFieldError message={formErrors.service_areas} />
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Travel Scope *</Label>
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
                      <Label>Minimum Budget (KES) *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.minimum_budget_kes}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, minimum_budget_kes: e.target.value }));
                          setFormErrors((current) => ({ ...current, minimum_budget_kes: '' }));
                          setSubmitError(null);
                        }}
                        placeholder="e.g. 150000"
                        required
                      />
                      <FormFieldError message={formErrors.minimum_budget_kes} />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Budget (KES) *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.maximum_budget_kes}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, maximum_budget_kes: e.target.value }));
                          setFormErrors((current) => ({ ...current, maximum_budget_kes: '' }));
                          setSubmitError(null);
                        }}
                        placeholder="e.g. 800000"
                        required
                      />
                      <FormFieldError message={formErrors.maximum_budget_kes} />
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
                <CardTitle>Committee Members</CardTitle>
                <CardDescription>
                  Add members, assign wedding responsibilities, and store the phone numbers attached to each role.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={addCommitteeMember} className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <FormSubmitError message={committeeSubmitError} />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={committeeMemberForm.full_name}
                      onChange={(e) => {
                        setCommitteeMemberForm((prev) => ({ ...prev, full_name: e.target.value }));
                        setCommitteeFormErrors((current) => ({ ...current, full_name: '' }));
                        setCommitteeSubmitError(null);
                      }}
                      onBlur={() => {
                        if (!committeeMemberForm.full_name.trim()) return;
                        setCommitteeMemberForm((current) => ({
                          ...current,
                          full_name: normalizeHumanName(current.full_name),
                        }));
                      }}
                      placeholder="Committee member name"
                      required
                    />
                    <FormFieldError message={committeeFormErrors.full_name} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={committeeMemberForm.phone}
                      onChange={(e) => {
                        setCommitteeMemberForm((prev) => ({ ...prev, phone: e.target.value }));
                        setCommitteeFormErrors((current) => ({ ...current, phone: '' }));
                        setCommitteeSubmitError(null);
                      }}
                      placeholder="+254..."
                      required
                    />
                    <FormFieldError message={committeeFormErrors.phone} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (optional)</Label>
                    <Input
                      type="email"
                      value={committeeMemberForm.email}
                      onChange={(e) => {
                        setCommitteeMemberForm((prev) => ({ ...prev, email: e.target.value }));
                        setCommitteeFormErrors((current) => ({ ...current, email: '' }));
                        setCommitteeSubmitError(null);
                      }}
                      placeholder="member@example.com"
                    />
                    <FormFieldError message={committeeFormErrors.email} />
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
                          <Badge variant="info">{member.permission_level}</Badge>
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
                <Input value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} onBlur={() => {
                  if (!form.partner_name.trim()) return;
                  setForm((current) => ({ ...current, partner_name: normalizeHumanName(current.partner_name) }));
                }} placeholder="Partner's name" />
              </div>
              <div className="space-y-2">
                <Label>Spouse Email</Label>
                <Input value={resolvedPartnerEmail} readOnly />
                <p className="text-xs text-muted-foreground">
                  This is the same partner email used in Wedding Ownership above.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Wedding Date</Label>
                <Input type="date" value={form.wedding_date} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
              </div>
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Planning mode</p>
                  <p className="text-xs text-muted-foreground">
                    Tell Zania whether this wedding is being managed locally or from abroad.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    { value: 'local', title: 'Planning from Kenya', copy: 'Use the standard local planning view.' },
                    { value: 'diaspora', title: 'Planning from abroad', copy: 'Keep diaspora settings like timezone and reference currency.' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, planning_mode: option.value }))}
                      className={`rounded-xl border px-4 py-3 text-left transition-all ${
                        form.planning_mode === option.value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <p className="font-medium">{option.title}</p>
                      <p className="mt-1 text-xs">{option.copy}</p>
                    </button>
                  ))}
                </div>

                {form.planning_mode === 'diaspora' && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Planning country</Label>
                      <Select
                        value={form.planning_country}
                        onValueChange={(value) => {
                          setForm((current) => ({ ...current, planning_country: value }));
                          setFormErrors((current) => ({ ...current, planning_country: '' }));
                          setSubmitError(null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose country" />
                        </SelectTrigger>
                        <SelectContent>
                          {planningCountryOptions.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError message={formErrors.planning_country} />
                    </div>
                    <div className="space-y-2">
                      <Label>Reference currency</Label>
                      <Select
                        value={form.reference_currency}
                        onValueChange={(value) => {
                          setForm((current) => ({ ...current, reference_currency: value as WeddingReferenceCurrency }));
                          setFormErrors((current) => ({ ...current, reference_currency: '' }));
                          setSubmitError(null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {weddingReferenceCurrencies.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {weddingReferenceCurrencyLabels[currency]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError message={formErrors.reference_currency} />
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select
                        value={form.owner_timezone}
                        onValueChange={(value) => {
                          setForm((current) => ({ ...current, owner_timezone: value }));
                          setFormErrors((current) => ({ ...current, owner_timezone: '' }));
                          setSubmitError(null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {timezoneOptions.map((timezone) => (
                            <SelectItem key={timezone} value={timezone}>
                              {timezone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError message={formErrors.owner_timezone} />
                    </div>
                  </div>
                )}
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

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="w-full sm:min-w-[240px] sm:w-auto">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>

      <Card className="shadow-card border-border/70">
        <CardHeader>
          <CardTitle>Privacy &amp; Communications</CardTitle>
          <CardDescription>
            Control how Zania contacts you, whether your public business profile is visible, and whether your own profile-facing information stays on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Email unsubscribe</p>
                <p className="text-sm text-muted-foreground">
                  Stop receiving Zania marketing and update emails. This does not remove your account.
                </p>
              </div>
              <Button
                type="button"
                variant={profile?.marketing_opt_out ? 'outline' : 'default'}
                disabled={privacyAction === 'marketing'}
                onClick={() => void handleMarketingOptOutUpdate(!(profile?.marketing_opt_out ?? false))}
                className="w-full md:w-auto"
              >
                {privacyAction === 'marketing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {profile?.marketing_opt_out ? 'Resume Zania emails' : 'Unsubscribe from emails'}
              </Button>
            </div>
            {profile?.marketing_opt_out_at ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Last updated on {new Date(profile.marketing_opt_out_at).toLocaleDateString()}.
              </p>
            ) : null}
          </div>

          {canOptOutOfDirectory ? (
            <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Public directory visibility</p>
                  <p className="text-sm text-muted-foreground">
                    Hide only your own planner or vendor profile from public Zania directory pages.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={profile?.directory_opt_out ? 'outline' : 'default'}
                  disabled={privacyAction === 'directory'}
                  onClick={() => void handleDirectoryOptOutUpdate(!(profile?.directory_opt_out ?? false))}
                  className="w-full md:w-auto"
                >
                  {privacyAction === 'directory' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {profile?.directory_opt_out ? 'Show public profile again' : 'Hide public profile'}
                </Button>
              </div>
              {profile?.directory_opt_out_at ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Public visibility changed on {new Date(profile.directory_opt_out_at).toLocaleDateString()}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Delete my own Zania information</p>
                  <p className="text-sm text-muted-foreground">
                    This removes your own profile-facing information from Zania, opts you out of emails, and hides any public listing tied to your account.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    It does not delete shared wedding or client workspace records that affect other people, and it does not remove minimal security or billing history we must retain.
                  </p>
                </div>
                <div className="max-w-xs space-y-2">
                  <Label htmlFor="privacy-delete-confirm">Type DELETE to confirm</Label>
                  <Input
                    id="privacy-delete-confirm"
                    value={deletePrivacyConfirm}
                    onChange={(e) => setDeletePrivacyConfirm(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={privacyAction === 'delete'}
                  onClick={() => void handleDeleteProfileData()}
                  className="w-full sm:w-auto"
                >
                  {privacyAction === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Delete my Zania information
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
