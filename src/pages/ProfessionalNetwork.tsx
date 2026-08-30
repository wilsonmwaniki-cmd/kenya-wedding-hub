import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Send,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import ProfessionalExchangeTab from '@/components/professional-network/ProfessionalExchangeTab';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  buildProfessionalNetworkChecklist,
  getRecommendationRequestKindsForRole,
  professionalRelationshipMeta,
  professionalThreadContextMeta,
  type ProfessionalNetworkRole,
  type ProfessionalRelationshipKind,
  type ProfessionalThreadContext,
} from '@/lib/professionalNetwork';

interface VendorPeer {
  id: string;
  user_id: string | null;
  business_name: string;
  category: string;
  location_county: string | null;
  profile_kind: 'claimed' | 'curated' | 'featured';
  is_verified: boolean;
}

interface PlannerPeer {
  id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  primary_county: string | null;
  founding_planner_contributor: boolean;
}

interface VendorListingSummary {
  id: string;
  business_name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  location_county: string | null;
  service_areas: string[];
  services: string[] | null;
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
}

interface NetworkRelationship {
  id: string;
  source_user_id: string;
  target_user_id: string | null;
  target_vendor_listing_id: string | null;
  relationship_type: ProfessionalRelationshipKind;
  note: string | null;
  is_public: boolean;
  active: boolean;
  target_acknowledged: boolean;
  target_acknowledged_at: string | null;
  created_at: string;
}

interface NetworkRecommendationRequest {
  id: string;
  requester_user_id: string;
  requester_role: 'planner' | 'vendor' | 'admin';
  requester_vendor_listing_id: string | null;
  recipient_user_id: string;
  recipient_vendor_listing_id: string | null;
  requested_relationship_type: ProfessionalRelationshipKind;
  request_message: string | null;
  response_note: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  responded_at: string | null;
}

interface NetworkThread {
  id: string;
  planner_user_id: string;
  vendor_user_id: string;
  vendor_listing_id: string;
  subject: string;
  context_type: ProfessionalThreadContext;
  last_message_at: string;
  archived_by_planner: boolean;
  archived_by_vendor: boolean;
}

interface NetworkMessage {
  id: string;
  thread_id: string;
  sender_user_id: string;
  sender_role: 'planner' | 'vendor' | 'admin';
  body: string;
  created_at: string;
}

const relationshipKindOptions = Object.entries(professionalRelationshipMeta) as Array<
  [ProfessionalRelationshipKind, (typeof professionalRelationshipMeta)[ProfessionalRelationshipKind]]
>;

const threadContextOptions = Object.entries(professionalThreadContextMeta) as Array<
  [ProfessionalThreadContext, (typeof professionalThreadContextMeta)[ProfessionalThreadContext]]
>;

export default function ProfessionalNetwork() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const db = supabase as any;

  const role = profile?.role === 'planner' ? 'planner' : 'vendor';
  const [loading, setLoading] = useState(true);
  const [vendorListing, setVendorListing] = useState<VendorListingSummary | null>(null);
  const [vendorPeers, setVendorPeers] = useState<VendorPeer[]>([]);
  const [plannerPeers, setPlannerPeers] = useState<PlannerPeer[]>([]);
  const [authoredRelationships, setAuthoredRelationships] = useState<NetworkRelationship[]>([]);
  const [receivedRelationships, setReceivedRelationships] = useState<NetworkRelationship[]>([]);
  const [sentRecommendationRequests, setSentRecommendationRequests] = useState<NetworkRecommendationRequest[]>([]);
  const [receivedRecommendationRequests, setReceivedRecommendationRequests] = useState<NetworkRecommendationRequest[]>([]);
  const [threads, setThreads] = useState<NetworkThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NetworkMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'exchange' | 'inbox'>('overview');
  const [relationshipFormOpen, setRelationshipFormOpen] = useState(false);
  const [messageFormOpen, setMessageFormOpen] = useState(false);

  const [relationshipTargetId, setRelationshipTargetId] = useState('');
  const [relationshipKind, setRelationshipKind] = useState<ProfessionalRelationshipKind>('worked_with');
  const [relationshipNote, setRelationshipNote] = useState('');
  const [relationshipVisibility, setRelationshipVisibility] = useState<'public' | 'private'>('public');
  const [relationshipSubmitting, setRelationshipSubmitting] = useState(false);
  const [relationshipErrors, setRelationshipErrors] = useState<{ target?: string; note?: string }>({});
  const [relationshipSubmitError, setRelationshipSubmitError] = useState<string | null>(null);

  const [recommendationTargetId, setRecommendationTargetId] = useState('');
  const [recommendationKind, setRecommendationKind] = useState<ProfessionalRelationshipKind>('recommended');
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const [recommendationSubmitting, setRecommendationSubmitting] = useState(false);
  const [recommendationErrors, setRecommendationErrors] = useState<{ target?: string; message?: string }>({});
  const [recommendationSubmitError, setRecommendationSubmitError] = useState<string | null>(null);
  const [recommendationResponseDrafts, setRecommendationResponseDrafts] = useState<Record<string, string>>({});
  const [respondingRecommendationId, setRespondingRecommendationId] = useState<string | null>(null);

  const [threadTargetId, setThreadTargetId] = useState('');
  const [threadSubject, setThreadSubject] = useState('');
  const [threadContext, setThreadContext] = useState<ProfessionalThreadContext>('introduction');
  const [threadMessage, setThreadMessage] = useState('');
  const [threadSubmitting, setThreadSubmitting] = useState(false);
  const [threadErrors, setThreadErrors] = useState<{ target?: string; subject?: string; message?: string }>({});
  const [threadSubmitError, setThreadSubmitError] = useState<string | null>(null);

  const [messageDraft, setMessageDraft] = useState('');
  const [messageSubmitting, setMessageSubmitting] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [acknowledgingRelationshipId, setAcknowledgingRelationshipId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || (role !== 'planner' && role !== 'vendor')) return;

    const load = async () => {
      setLoading(true);

      const [listingRes, plannersRes, vendorsRes, threadsRes] = await Promise.all([
        role === 'vendor'
          ? db
              .from('vendor_listings')
              .select('id, business_name, description, email, phone, website, location_county, service_areas, services, minimum_budget_kes, maximum_budget_kes')
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
        db
          .from('public_planner_profiles')
          .select('id, user_id, full_name, company_name, primary_county, founding_planner_contributor')
          .order('founding_planner_contributor', { ascending: false }),
        db
          .from('vendor_listings')
          .select('id, user_id, business_name, category, location_county, profile_kind, is_verified')
          .eq('is_approved', true)
          .eq('directory_opt_out', false)
          .order('featured_rank', { ascending: false })
          .order('is_verified', { ascending: false }),
        db
          .from('professional_network_threads')
          .select('*')
          .or(`planner_user_id.eq.${user.id},vendor_user_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false }),
      ]);

      const nextVendorListing = (listingRes.data as VendorListingSummary | null) ?? null;
      const nextPlannerPeers = ((plannersRes.data as PlannerPeer[] | null) ?? []).filter((item) => item.user_id !== user.id);
      const nextVendorPeers = ((vendorsRes.data as VendorPeer[] | null) ?? []).filter((item) => item.user_id !== user.id);
      const nextThreads = (threadsRes.data as NetworkThread[] | null) ?? [];

      setVendorListing(nextVendorListing);
      setPlannerPeers(nextPlannerPeers);
      setVendorPeers(nextVendorPeers);
      setThreads(nextThreads);
      setSelectedThreadId((current) => current ?? nextThreads[0]?.id ?? null);

      const authoredQuery = db
        .from('professional_network_relationships')
        .select('*')
        .eq('source_user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false });

      const receivedFilter =
        role === 'planner'
          ? `target_user_id.eq.${user.id}`
          : nextVendorListing?.id
            ? `target_vendor_listing_id.eq.${nextVendorListing.id},target_user_id.eq.${user.id}`
            : `target_user_id.eq.${user.id}`;

      const [authoredRes, receivedRes] = await Promise.all([
        authoredQuery,
        db
          .from('professional_network_relationships')
          .select('*')
          .or(receivedFilter)
          .eq('active', true)
          .order('created_at', { ascending: false }),
      ]);

      const sentRecommendationQuery = db
        .from('professional_network_recommendation_requests')
        .select('*')
        .eq('requester_user_id', user.id)
        .order('created_at', { ascending: false });

      const receivedRecommendationFilter =
        role === 'planner'
          ? `recipient_user_id.eq.${user.id}`
          : nextVendorListing?.id
            ? `recipient_user_id.eq.${user.id},recipient_vendor_listing_id.eq.${nextVendorListing.id}`
            : `recipient_user_id.eq.${user.id}`;

      const [sentRecommendationRes, receivedRecommendationRes] = await Promise.all([
        sentRecommendationQuery,
        db
          .from('professional_network_recommendation_requests')
          .select('*')
          .or(receivedRecommendationFilter)
          .order('created_at', { ascending: false }),
      ]);

      setAuthoredRelationships((authoredRes.data as NetworkRelationship[] | null) ?? []);
      setReceivedRelationships((receivedRes.data as NetworkRelationship[] | null) ?? []);
      setSentRecommendationRequests((sentRecommendationRes.data as NetworkRecommendationRequest[] | null) ?? []);
      setReceivedRecommendationRequests((receivedRecommendationRes.data as NetworkRecommendationRequest[] | null) ?? []);
      setLoading(false);
    };

    void load();
  }, [db, role, user, profile?.role]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setMessagesLoading(true);
      const { data, error } = await db
        .from('professional_network_messages')
        .select('*')
        .eq('thread_id', selectedThreadId)
        .order('created_at', { ascending: true });

      if (error) {
        setMessages([]);
      } else {
        setMessages((data as NetworkMessage[] | null) ?? []);
      }
      setMessagesLoading(false);
    };

    void loadMessages();
  }, [db, selectedThreadId]);

  const onboarding = useMemo(
    () =>
      buildProfessionalNetworkChecklist(
        role as ProfessionalNetworkRole,
        profile ?? {},
        vendorListing,
      ),
    [profile, role, vendorListing],
  );

  const plannerPeerMap = useMemo(
    () => Object.fromEntries(plannerPeers.map((planner) => [planner.user_id, planner])),
    [plannerPeers],
  );
  const vendorPeerMap = useMemo(
    () => Object.fromEntries(vendorPeers.map((vendor) => [vendor.id, vendor])),
    [vendorPeers],
  );
  const vendorPeerByUserId = useMemo(
    () => Object.fromEntries(vendorPeers.filter((vendor) => vendor.user_id).map((vendor) => [vendor.user_id as string, vendor])),
    [vendorPeers],
  );

  const messageEligibleTargets = useMemo(() => {
    if (role === 'planner') {
      return vendorPeers.filter((vendor) => Boolean(vendor.user_id));
    }
    return plannerPeers;
  }, [plannerPeers, role, vendorPeers]);

  const currentThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const recommendationKindOptions = useMemo(
    () => getRecommendationRequestKindsForRole(role as ProfessionalNetworkRole).map((value) => [value, professionalRelationshipMeta[value]] as const),
    [role],
  );

  const recommendationTargets = useMemo(
    () => (role === 'planner' ? vendorPeers.filter((vendor) => Boolean(vendor.user_id)) : plannerPeers),
    [plannerPeers, role, vendorPeers],
  );

  const currentThreadCounterparty = useMemo(() => {
    if (!currentThread) return null;
    if (role === 'planner') {
      return vendorPeerByUserId[currentThread.vendor_user_id] ?? vendorPeerMap[currentThread.vendor_listing_id] ?? null;
    }
    return plannerPeerMap[currentThread.planner_user_id] ?? null;
  }, [currentThread, plannerPeerMap, role, vendorPeerByUserId, vendorPeerMap]);

  const suggestedProfessionals = useMemo(() => {
    if (role === 'planner') {
      const plannerCounty = profile?.primary_county?.toLowerCase() ?? null;
      return vendorPeers
        .filter((vendor) => Boolean(vendor.user_id))
        .map((vendor) => ({
          ...vendor,
          score:
            (plannerCounty && vendor.location_county?.toLowerCase() === plannerCounty ? 2 : 0)
            + (vendor.is_verified ? 1 : 0)
            + (vendor.profile_kind === 'featured' ? 1 : 0),
        }))
        .sort((left, right) => right.score - left.score || left.business_name.localeCompare(right.business_name))
        .slice(0, 4);
    }

    const vendorCounty = vendorListing?.location_county?.toLowerCase() ?? null;
    return plannerPeers
      .map((planner) => ({
        ...planner,
        score:
          (vendorCounty && planner.primary_county?.toLowerCase() === vendorCounty ? 2 : 0)
          + (planner.founding_planner_contributor ? 1 : 0),
      }))
      .sort((left, right) => right.score - left.score || (left.company_name || left.full_name || '').localeCompare(right.company_name || right.full_name || ''))
      .slice(0, 4);
  }, [plannerPeers, profile?.primary_county, role, vendorListing?.location_county, vendorPeers]);

  const handleCreateRelationship = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const nextErrors: { target?: string; note?: string } = {};
    if (!relationshipTargetId) nextErrors.target = 'Choose the professional you want to recognise.';
    if (!relationshipNote.trim()) nextErrors.note = 'Add a short note so the signal feels real and useful.';
    setRelationshipErrors(nextErrors);
    setRelationshipSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setRelationshipSubmitting(true);

    const payload =
      role === 'planner'
        ? {
            source_user_id: user.id,
            source_role: 'planner',
            target_vendor_listing_id: relationshipTargetId,
            target_user_id: null,
            relationship_type: relationshipKind,
            note: relationshipNote.trim(),
            is_public: relationshipVisibility === 'public',
            active: true,
            target_acknowledged: false,
          }
        : {
            source_user_id: user.id,
            source_role: 'vendor',
            target_user_id: relationshipTargetId,
            target_vendor_listing_id: null,
            relationship_type: relationshipKind,
            note: relationshipNote.trim(),
            is_public: relationshipVisibility === 'public',
            active: true,
            target_acknowledged: false,
          };

    const { data, error } = await db
      .from('professional_network_relationships')
      .insert(payload)
      .select('*')
      .single();

    setRelationshipSubmitting(false);
    if (error) {
      setRelationshipSubmitError(error.message || 'Could not save that relationship right now.');
      return;
    }

    const saved = data as NetworkRelationship;
    setAuthoredRelationships((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    if (
      (saved.target_user_id && saved.target_user_id === user.id)
      || (saved.target_vendor_listing_id && saved.target_vendor_listing_id === vendorListing?.id)
    ) {
      setReceivedRelationships((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    }
    setRelationshipTargetId('');
    setRelationshipKind('worked_with');
    setRelationshipNote('');
    setRelationshipVisibility('public');
    setRelationshipFormOpen(false);
    toast({
      title: 'Recommendation saved',
      description: 'Your recommendation is now saved.',
    });
  };

  const handleAcknowledgeRelationship = async (relationship: NetworkRelationship) => {
    setAcknowledgingRelationshipId(relationship.id);
    const { data, error } = await db
      .from('professional_network_relationships')
      .update({
        target_acknowledged: true,
        target_acknowledged_at: new Date().toISOString(),
      })
      .eq('id', relationship.id)
      .select('*')
      .single();

    setAcknowledgingRelationshipId(null);
    if (error) {
      toast({
        title: 'Could not confirm signal',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const saved = data as NetworkRelationship;
    setReceivedRelationships((current) => current.map((item) => item.id === saved.id ? saved : item));
    setAuthoredRelationships((current) => current.map((item) => item.id === saved.id ? saved : item));
    toast({
      title: 'Signal acknowledged',
      description: 'That professional relationship now reads as a mutual trust marker.',
    });
  };

  const handleCreateRecommendationRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const nextErrors: { target?: string; message?: string } = {};
    if (!recommendationTargetId) nextErrors.target = 'Choose who should receive this request.';
    if (!recommendationMessage.trim()) nextErrors.message = 'Add context so the recipient knows why this request is deserved.';
    setRecommendationErrors(nextErrors);
    setRecommendationSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const targetVendor = role === 'planner'
      ? vendorPeers.find((vendor) => vendor.id === recommendationTargetId)
      : null;
    const targetPlanner = role === 'vendor'
      ? plannerPeers.find((planner) => planner.user_id === recommendationTargetId)
      : null;

    if (role === 'planner' && !targetVendor?.user_id) {
      setRecommendationSubmitError('Recommendation requests can only go to claimed vendor profiles for now.');
      return;
    }

    if (role === 'vendor' && !vendorListing) {
      setRecommendationSubmitError('Finish your vendor listing first so planners can recommend a real profile.');
      return;
    }

    setRecommendationSubmitting(true);

    const payload = role === 'planner'
      ? {
          requester_user_id: user.id,
          requester_role: 'planner',
          requester_vendor_listing_id: null,
          recipient_user_id: targetVendor!.user_id,
          recipient_vendor_listing_id: targetVendor!.id,
          requested_relationship_type: recommendationKind,
          request_message: recommendationMessage.trim(),
          status: 'pending',
        }
      : {
          requester_user_id: user.id,
          requester_role: 'vendor',
          requester_vendor_listing_id: vendorListing!.id,
          recipient_user_id: targetPlanner!.user_id,
          recipient_vendor_listing_id: null,
          requested_relationship_type: recommendationKind,
          request_message: recommendationMessage.trim(),
          status: 'pending',
        };

    const { data, error } = await db
      .from('professional_network_recommendation_requests')
      .insert(payload)
      .select('*')
      .single();

    setRecommendationSubmitting(false);
    if (error) {
      setRecommendationSubmitError(error.message || 'Could not send that recommendation request right now.');
      return;
    }

    const saved = data as NetworkRecommendationRequest;
    setSentRecommendationRequests((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setRecommendationTargetId('');
    setRecommendationKind('recommended');
    setRecommendationMessage('');
    toast({
      title: 'Recommendation request sent',
      description: 'The recipient can now approve or decline it from their network workspace.',
    });
  };

  const handleRecommendationResponseDraftChange = (requestId: string, value: string) => {
    setRecommendationResponseDrafts((current) => ({ ...current, [requestId]: value }));
  };

  const handleRespondToRecommendationRequest = async (
    request: NetworkRecommendationRequest,
    status: 'accepted' | 'declined',
  ) => {
    if (!user) return;

    const responseNote = recommendationResponseDrafts[request.id]?.trim() || '';
    if (status === 'accepted' && !responseNote) {
      toast({
        title: 'Add your trust note first',
        description: 'Accepted recommendation requests need a real note so the signal feels credible.',
        variant: 'destructive',
      });
      return;
    }

    setRespondingRecommendationId(request.id);

    if (status === 'accepted') {
      const relationshipPayload =
        request.requester_role === 'vendor'
          ? {
              source_user_id: user.id,
              source_role: role,
              target_user_id: null,
              target_vendor_listing_id: request.requester_vendor_listing_id,
              relationship_type: request.requested_relationship_type,
              note: responseNote,
              is_public: true,
              active: true,
              target_acknowledged: true,
              target_acknowledged_at: new Date().toISOString(),
            }
          : {
              source_user_id: user.id,
              source_role: role,
              target_user_id: request.requester_user_id,
              target_vendor_listing_id: null,
              relationship_type: request.requested_relationship_type,
              note: responseNote,
              is_public: true,
              active: true,
              target_acknowledged: true,
              target_acknowledged_at: new Date().toISOString(),
            };

      let relationshipData: NetworkRelationship | null = null;
      const insertedRelationship = await db
        .from('professional_network_relationships')
        .insert(relationshipPayload)
        .select('*')
        .single();

      if (insertedRelationship.error?.code === '23505') {
        let updateQuery = db
          .from('professional_network_relationships')
          .update({
            note: responseNote,
            is_public: true,
            active: true,
            target_acknowledged: true,
            target_acknowledged_at: new Date().toISOString(),
          })
          .eq('source_user_id', user.id)
          .eq('relationship_type', request.requested_relationship_type);

        updateQuery = request.requester_role === 'vendor'
          ? updateQuery.eq('target_vendor_listing_id', request.requester_vendor_listing_id).is('target_user_id', null)
          : updateQuery.eq('target_user_id', request.requester_user_id).is('target_vendor_listing_id', null);

        const updatedRelationship = await updateQuery.select('*').single();
        if (updatedRelationship.error) {
          setRespondingRecommendationId(null);
          toast({
            title: 'Could not publish recommendation',
            description: updatedRelationship.error.message,
            variant: 'destructive',
          });
          return;
        }
        relationshipData = updatedRelationship.data as NetworkRelationship;
      } else if (insertedRelationship.error) {
        setRespondingRecommendationId(null);
        toast({
          title: 'Could not publish recommendation',
          description: insertedRelationship.error.message,
          variant: 'destructive',
        });
        return;
      } else {
        relationshipData = insertedRelationship.data as NetworkRelationship;
      }

      if (relationshipData) {
        setAuthoredRelationships((current) => [relationshipData, ...current.filter((item) => item.id !== relationshipData?.id)]);
      }
    }

    const { data, error } = await db
      .from('professional_network_recommendation_requests')
      .update({
        status,
        response_note: responseNote || null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', request.id)
      .select('*')
      .single();

    setRespondingRecommendationId(null);
    if (error) {
      toast({
        title: 'Could not update request',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const saved = data as NetworkRecommendationRequest;
    setReceivedRecommendationRequests((current) => current.map((item) => item.id === saved.id ? saved : item));
    setSentRecommendationRequests((current) => current.map((item) => item.id === saved.id ? saved : item));
    setRecommendationResponseDrafts((current) => ({ ...current, [request.id]: saved.response_note ?? '' }));
    toast({
      title: status === 'accepted' ? 'Recommendation published' : 'Request declined',
      description: status === 'accepted'
        ? 'That trust signal is now attached to the requester profile.'
        : 'The requester will still see that you reviewed the request.',
    });
  };

  const handleCreateThread = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const nextErrors: { target?: string; subject?: string; message?: string } = {};
    if (!threadTargetId) nextErrors.target = 'Choose who this message thread is for.';
    if (!threadSubject.trim()) nextErrors.subject = 'Add a short subject line.';
    if (!threadMessage.trim()) nextErrors.message = 'Write the opening message so the thread has context.';
    setThreadErrors(nextErrors);
    setThreadSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setThreadSubmitting(true);

    const targetVendor = role === 'planner'
      ? vendorPeers.find((vendor) => vendor.id === threadTargetId)
      : vendorListing;
    const targetPlanner = role === 'vendor'
      ? plannerPeers.find((planner) => planner.user_id === threadTargetId)
      : null;

    if (role === 'planner' && !targetVendor?.user_id) {
      setThreadSubmitting(false);
      setThreadSubmitError('Messaging is only available with claimed vendor profiles for now.');
      return;
    }

    if (role === 'vendor' && !vendorListing) {
      setThreadSubmitting(false);
      setThreadSubmitError('Finish your vendor listing first so your inbox can attach to a real profile.');
      return;
    }

    const threadPayload = role === 'planner'
      ? {
          created_by_user_id: user.id,
          created_by_role: 'planner',
          planner_user_id: user.id,
          vendor_user_id: targetVendor.user_id,
          vendor_listing_id: targetVendor.id,
          subject: threadSubject.trim(),
          context_type: threadContext,
        }
      : {
          created_by_user_id: user.id,
          created_by_role: 'vendor',
          planner_user_id: targetPlanner?.user_id,
          vendor_user_id: user.id,
          vendor_listing_id: vendorListing?.id,
          subject: threadSubject.trim(),
          context_type: threadContext,
        };

    const { data: threadData, error: threadError } = await db
      .from('professional_network_threads')
      .insert(threadPayload)
      .select('*')
      .single();

    if (threadError) {
      setThreadSubmitting(false);
      setThreadSubmitError(threadError.message || 'Could not open that message thread right now.');
      return;
    }

    const createdThread = threadData as NetworkThread;
    const { error: messageInsertError } = await db
      .from('professional_network_messages')
      .insert({
        thread_id: createdThread.id,
        sender_user_id: user.id,
        sender_role: role,
        body: threadMessage.trim(),
      });

    if (messageInsertError) {
      setThreadSubmitting(false);
      setThreadSubmitError(messageInsertError.message || 'The thread opened, but the first message could not be sent.');
      return;
    }

    setThreads((current) => [createdThread, ...current.filter((thread) => thread.id !== createdThread.id)]);
    setSelectedThreadId(createdThread.id);
    setThreadTargetId('');
    setThreadSubject('');
    setThreadContext('introduction');
    setThreadMessage('');
    setThreadSubmitting(false);
    setMessageFormOpen(false);
    toast({
      title: 'Conversation started',
      description: 'Your professional message thread is now open.',
    });
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !currentThread) return;
    if (!messageDraft.trim()) {
      setMessageError('Write a message before sending.');
      return;
    }

    setMessageSubmitting(true);
    setMessageError(null);

    const { data, error } = await db
      .from('professional_network_messages')
      .insert({
        thread_id: currentThread.id,
        sender_user_id: user.id,
        sender_role: role,
        body: messageDraft.trim(),
      })
      .select('*')
      .single();

    if (error) {
      setMessageSubmitting(false);
      setMessageError(error.message || 'Could not send that message right now.');
      return;
    }

    const saved = data as NetworkMessage;
    setMessages((current) => [...current, saved]);
    setThreads((current) => current.map((thread) => (
      thread.id === currentThread.id
        ? { ...thread, last_message_at: saved.created_at }
        : thread
    )).sort((left, right) => new Date(right.last_message_at).getTime() - new Date(left.last_message_at).getTime()));
    setMessageDraft('');
    setMessageSubmitting(false);
  };

  const renderRelationshipTargetLabel = (relationship: NetworkRelationship) => {
    if (relationship.target_vendor_listing_id) {
      return vendorPeerMap[relationship.target_vendor_listing_id]?.business_name ?? 'Vendor profile';
    }
    if (relationship.target_user_id) {
      const planner = plannerPeerMap[relationship.target_user_id];
      return planner?.company_name || planner?.full_name || 'Professional';
    }
    return 'Professional';
  };

  const renderRecommendationRecipientLabel = (request: NetworkRecommendationRequest) => {
    if (request.recipient_vendor_listing_id) {
      return vendorPeerMap[request.recipient_vendor_listing_id]?.business_name ?? 'Vendor profile';
    }

    const planner = plannerPeerMap[request.recipient_user_id];
    return planner?.company_name || planner?.full_name || 'Planner';
  };

  const renderRecommendationRequesterLabel = (request: NetworkRecommendationRequest) => {
    if (request.requester_role === 'vendor') {
      return request.requester_vendor_listing_id
        ? vendorPeerMap[request.requester_vendor_listing_id]?.business_name ?? 'Vendor profile'
        : 'Vendor';
    }

    const planner = plannerPeerMap[request.requester_user_id];
    return planner?.company_name || planner?.full_name || 'Planner';
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const nextProfileStep = onboarding.steps.find((step) => !step.complete);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-foreground">Network</h1>
        <p className="mt-2 text-sm text-muted-foreground">Work with trusted wedding professionals.</p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = value as 'overview' | 'exchange' | 'inbox';
          setActiveTab(nextTab);
          if (nextTab === 'inbox' && threads.length === 0) setMessageFormOpen(true);
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="overview">Recommendations</TabsTrigger>
          <TabsTrigger value="exchange">Questions</TabsTrigger>
          <TabsTrigger value="inbox">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="font-medium text-foreground">{nextProfileStep?.label ?? 'Profile ready'}</p>
                  {nextProfileStep ? <p className="mt-1 text-sm text-muted-foreground">{nextProfileStep.helper}</p> : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link to={role === 'planner' ? '/settings' : '/vendor-settings'}>
                    <Button>{role === 'planner' ? 'Edit profile' : 'Edit listing'}</Button>
                  </Link>
                  {role === 'vendor' && (
                    <Link to="/vendors-directory">
                      <Button variant="outline">Open vendor directory</Button>
                    </Link>
                  )}
                  {role === 'planner' && (
                    <Link to="/planners">
                      <Button variant="outline">Open planner directory</Button>
                    </Link>
                  )}
                </div>
                <details className="rounded-2xl border border-border/60">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none">View checklist</summary>
                  <div className="space-y-3 border-t border-border/60 p-4">
                    {onboarding.steps.map((step) => (
                      <div key={step.key} className="flex items-center gap-3 text-sm">
                        {step.complete ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : <span className="h-4 w-4 rounded-full border border-border" aria-hidden="true" />}
                        <span className="text-foreground">{step.label}</span>
                        <Badge variant={step.complete ? 'success' : 'outline'} className="ml-auto">{step.complete ? 'Done' : 'To do'}</Badge>
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <details
                id="add-recommendation"
                open={relationshipFormOpen}
                onToggle={(event) => setRelationshipFormOpen(event.currentTarget.open)}
                className="rounded-2xl border border-border/70 bg-card"
              >
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground marker:content-none">Add recommendation</summary>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-2xl">Add recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleCreateRelationship}>
                    <div className="space-y-2">
                      <Label>{role === 'planner' ? 'Vendor' : 'Planner'}</Label>
                      <Select value={relationshipTargetId} onValueChange={setRelationshipTargetId}>
                        <SelectTrigger>
                          <SelectValue placeholder={role === 'planner' ? 'Choose a vendor' : 'Choose a planner'} />
                        </SelectTrigger>
                        <SelectContent>
                          {(role === 'planner' ? vendorPeers : plannerPeers).map((peer) => (
                            <SelectItem
                              key={role === 'planner' ? (peer as VendorPeer).id : (peer as PlannerPeer).user_id}
                              value={role === 'planner' ? (peer as VendorPeer).id : (peer as PlannerPeer).user_id}
                            >
                              {role === 'planner'
                                ? `${(peer as VendorPeer).business_name} · ${(peer as VendorPeer).category}`
                                : ((peer as PlannerPeer).company_name || (peer as PlannerPeer).full_name || 'Planner')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError message={relationshipErrors.target} />
                    </div>

                    <div className="space-y-2">
                      <Label>Recommendation type</Label>
                      <Select value={relationshipKind} onValueChange={(value) => setRelationshipKind(value as ProfessionalRelationshipKind)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {relationshipKindOptions.map(([value, meta]) => (
                            <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{professionalRelationshipMeta[relationshipKind].description}</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Why you recommend them</Label>
                      <Textarea
                        value={relationshipNote}
                        onChange={(event) => setRelationshipNote(event.target.value)}
                        placeholder={role === 'planner'
                          ? 'Example: Strong communication, clean timelines, and dependable on event day.'
                          : 'Example: They brief vendors clearly, protect timelines, and follow through well.'}
                        rows={4}
                      />
                      <FormFieldError message={relationshipErrors.note} />
                    </div>

                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <Select value={relationshipVisibility} onValueChange={(value) => setRelationshipVisibility(value as 'public' | 'private')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public recommendation</SelectItem>
                          <SelectItem value="private">Private note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <FormSubmitError message={relationshipSubmitError} />
                    <Button type="submit" disabled={relationshipSubmitting} className="w-full gap-2">
                      {relationshipSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Save recommendation
                    </Button>
                  </form>
                </CardContent>
              </Card>
              </details>

              <details className="rounded-2xl border border-border/70 bg-card">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground marker:content-none">Request recommendation</summary>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-2xl">Request recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleCreateRecommendationRequest}>
                    <div className="space-y-2">
                      <Label>{role === 'planner' ? 'Claimed vendor profile' : 'Planner'}</Label>
                      <Select value={recommendationTargetId} onValueChange={setRecommendationTargetId}>
                        <SelectTrigger>
                          <SelectValue placeholder={role === 'planner' ? 'Choose a vendor to ask' : 'Choose a planner to ask'} />
                        </SelectTrigger>
                        <SelectContent>
                          {recommendationTargets.map((peer) => (
                            <SelectItem
                              key={role === 'planner' ? (peer as VendorPeer).id : (peer as PlannerPeer).user_id}
                              value={role === 'planner' ? (peer as VendorPeer).id : (peer as PlannerPeer).user_id}
                            >
                              {role === 'planner'
                                ? `${(peer as VendorPeer).business_name} · ${(peer as VendorPeer).category}`
                                : ((peer as PlannerPeer).company_name || (peer as PlannerPeer).full_name || 'Planner')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError message={recommendationErrors.target} />
                    </div>

                    <div className="space-y-2">
                      <Label>Recommendation type</Label>
                      <Select value={recommendationKind} onValueChange={(value) => setRecommendationKind(value as ProfessionalRelationshipKind)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {recommendationKindOptions.map(([value, meta]) => (
                            <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{professionalRelationshipMeta[recommendationKind].description}</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Why you are asking</Label>
                      <Textarea
                        value={recommendationMessage}
                        onChange={(event) => setRecommendationMessage(event.target.value)}
                        rows={4}
                        placeholder={role === 'planner'
                          ? 'Example: We worked together smoothly on a multiday wedding in Nairobi and I would value your public trust signal.'
                          : 'Example: We collaborated well on a client wedding and I would value a recommendation on my vendor profile.'}
                      />
                      <FormFieldError message={recommendationErrors.message} />
                    </div>

                    <FormSubmitError message={recommendationSubmitError} />
                    <Button type="submit" disabled={recommendationSubmitting} className="w-full gap-2">
                      {recommendationSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                      Send request
                    </Button>
                  </form>
                </CardContent>
              </Card>
              </details>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Recommendations you gave</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {authoredRelationships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recommendations yet.</p>
                ) : (
                  authoredRelationships.map((relationship) => (
                    <div key={relationship.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {professionalRelationshipMeta[relationship.relationship_type].shortLabel}
                        </Badge>
                        <Badge variant={relationship.is_public ? 'success' : 'outline'}>{relationship.is_public ? 'Public' : 'Private'}</Badge>
                      </div>
                      <p className="mt-3 font-medium text-foreground">{renderRelationshipTargetLabel(relationship)}</p>
                      {relationship.note && <p className="mt-2 text-sm text-muted-foreground">{relationship.note}</p>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Recommendations about you</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {receivedRelationships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recommendations yet.</p>
                ) : (
                  receivedRelationships.map((relationship) => (
                    <div key={relationship.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {professionalRelationshipMeta[relationship.relationship_type].label}
                        </Badge>
                        {relationship.target_acknowledged && (
                          <Badge variant="success">Acknowledged</Badge>
                        )}
                        {relationship.is_public ? (
                          <Badge variant="success">Visible on network surfaces</Badge>
                        ) : (
                          <Badge variant="outline">Private</Badge>
                        )}
                      </div>
                      <p className="mt-3 font-medium text-foreground">{renderRelationshipTargetLabel(relationship)}</p>
                      {relationship.note && <p className="mt-3 text-sm text-muted-foreground">{relationship.note}</p>}
                      {!relationship.target_acknowledged && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => void handleAcknowledgeRelationship(relationship)}
                          disabled={acknowledgingRelationshipId === relationship.id}
                        >
                          {acknowledgingRelationshipId === relationship.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Confirm recommendation
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {receivedRecommendationRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No requests.</p>
                ) : (
                  receivedRecommendationRequests.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{professionalRelationshipMeta[request.requested_relationship_type].label}</Badge>
                        <Badge variant={request.status === 'pending' ? 'warning' : request.status === 'accepted' ? 'success' : 'outline'}>
                          {request.status}
                        </Badge>
                      </div>
                      <p className="mt-3 font-medium text-foreground">{renderRecommendationRequesterLabel(request)}</p>
                      {request.request_message && (
                        <p className="mt-2 text-sm text-muted-foreground">{request.request_message}</p>
                      )}
                      {request.status === 'pending' ? (
                        <div className="mt-4 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`response-${request.id}`}>Your public trust note</Label>
                            <Textarea
                              id={`response-${request.id}`}
                              value={recommendationResponseDrafts[request.id] ?? ''}
                              onChange={(event) => handleRecommendationResponseDraftChange(request.id, event.target.value)}
                              rows={3}
                              placeholder="Example: Clear briefs, calm coordination, and dependable follow-through across the full wedding weekend."
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={respondingRecommendationId === request.id}
                              onClick={() => void handleRespondToRecommendationRequest(request, 'accepted')}
                            >
                              {respondingRecommendationId === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Publish signal
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={respondingRecommendationId === request.id}
                              onClick={() => void handleRespondToRecommendationRequest(request, 'declined')}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ) : request.response_note ? (
                        <p className="mt-3 text-sm text-muted-foreground">{request.response_note}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Sent requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sentRecommendationRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sent requests.</p>
                ) : (
                  sentRecommendationRequests.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{professionalRelationshipMeta[request.requested_relationship_type].label}</Badge>
                        <Badge variant={request.status === 'pending' ? 'warning' : request.status === 'accepted' ? 'success' : 'outline'}>
                          {request.status}
                        </Badge>
                      </div>
                      <p className="mt-3 font-medium text-foreground">{renderRecommendationRecipientLabel(request)}</p>
                      {request.request_message && (
                        <p className="mt-2 text-sm text-muted-foreground">{request.request_message}</p>
                      )}
                      {request.response_note && (
                        <p className="mt-3 rounded-xl bg-card px-3 py-2 text-sm text-muted-foreground">{request.response_note}</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Suggested professionals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {suggestedProfessionals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No strong matches yet. Complete more of your profile so Zania can make better introductions.
                </p>
              ) : (
                suggestedProfessionals.map((peer) => (
                  <div
                    key={role === 'planner' ? (peer as VendorPeer).id : (peer as PlannerPeer).user_id}
                    className="rounded-2xl border border-border/60 bg-background/70 p-4"
                  >
                    <div className="flex items-center gap-2">
                      {role === 'planner' ? <Store className="h-4 w-4 text-primary" /> : <Briefcase className="h-4 w-4 text-primary" />}
                      <p className="font-medium text-foreground">
                        {role === 'planner'
                          ? (peer as VendorPeer).business_name
                          : ((peer as PlannerPeer).company_name || (peer as PlannerPeer).full_name || 'Planner')}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {role === 'planner'
                        ? `${(peer as VendorPeer).category}${(peer as VendorPeer).profile_kind === 'claimed' ? ' · Claimed profile' : ''}`
                        : ((peer as PlannerPeer).founding_planner_contributor ? 'Founding Planner Contributor' : 'Professional planner')}
                    </p>
                    {((role === 'planner' ? (peer as VendorPeer).location_county : (peer as PlannerPeer).primary_county)) && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {role === 'planner' ? (peer as VendorPeer).location_county : (peer as PlannerPeer).primary_county}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRelationshipTargetId(
                            role === 'planner'
                              ? (peer as VendorPeer).id
                              : (peer as PlannerPeer).user_id,
                          );
                          setRelationshipFormOpen(true);
                          requestAnimationFrame(() => document.getElementById('add-recommendation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        }}
                      >
                        Recommend
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setThreadTargetId(
                            role === 'planner'
                              ? (peer as VendorPeer).id
                              : (peer as PlannerPeer).user_id,
                          );
                          setActiveTab('inbox');
                          setMessageFormOpen(true);
                          requestAnimationFrame(() => document.getElementById('new-network-message')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        }}
                      >
                        Message
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exchange" className="space-y-6">
          <ProfessionalExchangeTab
            db={db}
            userId={user?.id ?? ''}
            role={role as ProfessionalNetworkRole}
            profile={profile ?? null}
            vendorListing={vendorListing}
            plannerPeers={plannerPeers}
            vendorPeers={vendorPeers}
            onToast={({ title, description, variant }) => {
              toast({
                title,
                description,
                variant,
              });
            }}
          />
        </TabsContent>

        <TabsContent value="inbox" className="space-y-6">
          <div className="grid gap-6">
            <details
              id="new-network-message"
              open={messageFormOpen}
              onToggle={(event) => setMessageFormOpen(event.currentTarget.open)}
              className="order-2 rounded-2xl border border-border/60 bg-background/70"
            >
              <summary className="cursor-pointer list-none px-5 py-4 font-medium text-foreground">New message</summary>
            <Card className="rounded-t-none border-x-0 border-b-0 shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-2xl">New message</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleCreateThread}>
                  <div className="space-y-2">
                    <Label>{role === 'planner' ? 'Claimed vendor profile' : 'Planner'}</Label>
                    <Select value={threadTargetId} onValueChange={setThreadTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder={role === 'planner' ? 'Choose a claimed vendor' : 'Choose a planner'} />
                      </SelectTrigger>
                      <SelectContent>
                        {messageEligibleTargets.map((peer) => (
                          <SelectItem
                            key={role === 'planner' ? (peer as VendorPeer).id : (peer as PlannerPeer).user_id}
                            value={role === 'planner' ? (peer as VendorPeer).id : (peer as PlannerPeer).user_id}
                          >
                            {role === 'planner'
                              ? `${(peer as VendorPeer).business_name} · ${(peer as VendorPeer).category}`
                              : ((peer as PlannerPeer).company_name || (peer as PlannerPeer).full_name || 'Planner')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormFieldError message={threadErrors.target} />
                  </div>

                  <div className="space-y-2">
                    <Label>Context</Label>
                    <Select value={threadContext} onValueChange={(value) => setThreadContext(value as ProfessionalThreadContext)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {threadContextOptions.map(([value, meta]) => (
                          <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{professionalThreadContextMeta[threadContext].description}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      value={threadSubject}
                      onChange={(event) => setThreadSubject(event.target.value)}
                      placeholder={role === 'planner' ? 'Availability for a Naivasha wedding weekend' : 'Would love to collaborate on future weddings'}
                    />
                    <FormFieldError message={threadErrors.subject} />
                  </div>

                  <div className="space-y-2">
                    <Label>Opening message</Label>
                    <Textarea
                      value={threadMessage}
                      onChange={(event) => setThreadMessage(event.target.value)}
                      rows={5}
                      placeholder={role === 'planner'
                        ? 'Hi, I would love to understand your availability, working style, and how you prefer to collaborate on weddings like this.'
                        : 'Hi, I admire your work and would love to introduce my services properly for future weddings you may be coordinating.'}
                    />
                    <FormFieldError message={threadErrors.message} />
                  </div>

                  <FormSubmitError message={threadSubmitError} />
                  <Button type="submit" disabled={threadSubmitting} className="w-full gap-2">
                    {threadSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Start conversation
                  </Button>
                </form>
              </CardContent>
            </Card>
            </details>

            <Card className="order-1 shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Conversations</CardTitle>
              </CardHeader>
              <CardContent className={threads.length === 0 ? 'block' : 'grid gap-4 lg:grid-cols-[0.8fr_1.2fr]'}>
                <div className="space-y-3">
                  {threads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No conversations yet.</p>
                  ) : (
                    threads.map((thread) => {
                      const counterparty = role === 'planner'
                        ? (vendorPeerByUserId[thread.vendor_user_id]?.business_name || vendorPeerMap[thread.vendor_listing_id]?.business_name || 'Vendor')
                        : (plannerPeerMap[thread.planner_user_id]?.company_name || plannerPeerMap[thread.planner_user_id]?.full_name || 'Planner');
                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                            selectedThreadId === thread.id
                              ? 'border-primary/45 bg-primary/5'
                              : 'border-border/60 bg-background/70 hover:bg-accent/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{professionalThreadContextMeta[thread.context_type].label}</Badge>
                            <Badge variant="secondary">{counterparty}</Badge>
                          </div>
                          <p className="mt-3 font-medium text-foreground">{thread.subject}</p>
                        </button>
                      );
                    })
                  )}
                </div>

                {threads.length > 0 ? <div className="rounded-3xl border border-border/60 bg-background/70 p-4">
                  {!currentThread ? (
                    <div className="flex min-h-[18rem] items-center justify-center text-center text-sm text-muted-foreground">
                      Choose a conversation.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border-b border-border/60 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{professionalThreadContextMeta[currentThread.context_type].label}</Badge>
                          <Badge variant="secondary">
                            {role === 'planner'
                              ? (currentThreadCounterparty as VendorPeer | null)?.business_name || 'Vendor'
                              : (currentThreadCounterparty as PlannerPeer | null)?.company_name || (currentThreadCounterparty as PlannerPeer | null)?.full_name || 'Planner'}
                          </Badge>
                        </div>
                        <p className="mt-3 font-medium text-foreground">{currentThread.subject}</p>
                      </div>

                      <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                        {messagesLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        ) : (
                          messages.map((message) => {
                            const mine = message.sender_user_id === user?.id;
                            return (
                              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                                  mine ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground'
                                }`}>
                                  <p>{message.body}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <form className="space-y-3" onSubmit={handleSendMessage}>
                        <Textarea
                          value={messageDraft}
                          onChange={(event) => setMessageDraft(event.target.value)}
                          rows={3}
                          placeholder="Reply with the next practical step, timeline, or booking detail."
                        />
                        <FormSubmitError message={messageError} />
                        <Button type="submit" disabled={messageSubmitting} className="w-full gap-2">
                          {messageSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Send message
                        </Button>
                      </form>
                    </div>
                  )}
                </div> : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
