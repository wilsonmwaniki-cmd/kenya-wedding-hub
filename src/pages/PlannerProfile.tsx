import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Globe, ArrowLeft, Loader2, UserCircle, CheckCircle2, Clock, MapPin, FileText } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getEntitlementDecision } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { UpgradePromptDialog } from '@/components/UpgradePrompt';
import BrandWordmark from '@/components/BrandWordmark';
import { isProfessionalNetworkEnabled } from '@/lib/featureFlags';
import { PublicPageSkeleton } from '@/components/AppLoadingSkeletons';
import { displaySafeUrl, normalizeEmailHref, normalizeExternalUrl, normalizePhoneHref } from '@/lib/security';
import { requestPlannerQuote } from '@/lib/documentRequests';
import ProfessionalReviewsCard from '@/components/ProfessionalReviewsCard';

interface PlannerData {
  id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  bio: string | null;
  specialties: string[] | null;
  primary_county: string | null;
  primary_town: string | null;
  service_areas: string[] | null;
  travel_scope: string | null;
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
  founding_planner_contributor: boolean;
}

export default function PlannerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const { toast } = useToast();
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [requestingQuote, setRequestingQuote] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [networkSignals, setNetworkSignals] = useState<{ total: number; trusted: number; workedWith: number } | null>(null);
  const professionalNetworkEnabled = isProfessionalNetworkEnabled();

  const isCouple = profile?.role === 'couple';
  const connectDecision = getEntitlementDecision('couple.connect_planners', {
    profile,
    weddingEntitlements,
    couplePlanTier,
  });

  useEffect(() => {
    if (!id) return;
      const load = async () => {
      const { data, error } = await supabase
        .from('public_planner_profiles')
        .select('id, user_id, full_name, company_name, company_email, company_phone, company_website, bio, specialties, avatar_url, primary_county, primary_town, service_areas, travel_scope, minimum_budget_kes, maximum_budget_kes, founding_planner_contributor')
        .eq('id', id)
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setPlanner(data as PlannerData);
        if (professionalNetworkEnabled) {
          // The generated client types do not include this feature-flagged table yet.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: signalRows } = await (supabase as any)
            .from('professional_network_relationships')
            .select('relationship_type')
            .eq('target_user_id', data.user_id)
            .eq('active', true)
            .eq('is_public', true);
          const summary = ((signalRows as Array<{ relationship_type: string }> | null) ?? []).reduce((acc, row) => {
            acc.total += 1;
            if (row.relationship_type === 'trusted_collaborator' || row.relationship_type === 'recommended') acc.trusted += 1;
            if (row.relationship_type === 'worked_with') acc.workedWith += 1;
            return acc;
          }, { total: 0, trusted: 0, workedWith: 0 });
          setNetworkSignals(summary.total > 0 ? summary : null);
        } else {
          setNetworkSignals(null);
        }
        // Check existing link request
        if (user) {
          const { data: req } = await supabase
            .from('planner_link_requests')
            .select('status')
            .eq('couple_user_id', user.id)
            .eq('planner_user_id', data.user_id)
            .maybeSingle();
          if (req) setRequestStatus(req.status);
        }
      }
      setLoading(false);
    };
    load();
  }, [id, user]);

  const sendRequest = async () => {
    if (!user || !planner) return;
    setSending(true);
    const { data: inserted, error } = await supabase.from('planner_link_requests').insert({
      couple_user_id: user.id,
      planner_user_id: planner.user_id,
      message: message.trim() || null,
    }).select('id').single();
    setSending(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setRequestStatus('pending');
    setDialogOpen(false);
    setMessage('');
    toast({ title: 'Interest sent', description: 'Your planner will review your request.' });
    // Send email notification with action links (fire-and-forget)
    if (planner.company_email) {
      supabase.functions.invoke('send-connection-notification', {
        body: {
          recipientEmail: planner.company_email,
          recipientName: planner.company_name || planner.full_name,
          requesterName: profile?.full_name || 'A couple',
          message: message.trim() || null,
          type: 'planner',
          requestId: inserted?.id || null,
        },
      }).catch(() => {});
    }
  };

  const sendQuoteRequest = async () => {
    if (!planner) return;
    setRequestingQuote(true);
    try {
      await requestPlannerQuote(planner.user_id, {
        message: 'Please send us a wedding planning quote.',
      });
      toast({
        title: 'Quote requested',
        description: 'This planner will see your wedding at the top of their document desk.',
      });
    } catch (error) {
      toast({
        title: 'Could not request quote',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRequestingQuote(false);
    }
  };

  if (loading) {
    return <PublicPageSkeleton card={false} />;
  }

  if (notFound || !planner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Planner profile not found.</p>
        <Link to="/">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to Home</Button>
        </Link>
      </div>
    );
  }

  const plannerEmailHref = normalizeEmailHref(planner.company_email);
  const plannerPhoneHref = normalizePhoneHref(planner.company_phone);
  const plannerWebsiteHref = normalizeExternalUrl(planner.company_website);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-2">
          <BrandWordmark size="sm" className="shrink-0" />
          <Link to="/" className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Profile Header */}
        <div className="flex items-start gap-5">
          <Avatar className="h-16 w-16 border-2 border-border shrink-0">
            {planner.avatar_url ? <AvatarImage src={planner.avatar_url} alt="Planner photo" /> : null}
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {planner.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || <UserCircle className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {planner.company_name || planner.full_name || 'Wedding Planner'}
            </h1>
            {planner.founding_planner_contributor && (
              <Badge className="mt-2 border-0 bg-[#ead8a8] text-[#4c3528]">
                Founding Planner Contributor
              </Badge>
            )}
            {planner.company_name && planner.full_name && (
              <p className="text-muted-foreground">{planner.full_name}</p>
            )}
          </div>
        </div>

        {/* Link Request Button for Couples */}
        {isCouple && user && (
          <Card className="shadow-card border-primary/20">
            <CardContent className="flex items-center gap-4 py-4">
              {requestStatus === 'approved' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground">You're linked with this planner</p>
                    <p className="text-sm text-muted-foreground">Your wedding progress is shared.</p>
                  </div>
                  <Button onClick={() => void sendQuoteRequest()} disabled={requestingQuote} size="sm" className="gap-1.5">
                    {requestingQuote ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Request quote
                  </Button>
                </>
              ) : requestStatus === 'pending' ? (
                <>
                  <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground">Interest pending</p>
                    <p className="text-sm text-muted-foreground">Waiting for the planner to accept.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground">Work with this planner</p>
                    <p className="text-sm text-muted-foreground">Send a connection request to share your wedding progress.</p>
                  </div>
                  <Button
                    onClick={() => (connectDecision.allowed ? setDialogOpen(true) : setUpgradeOpen(true))}
                    size="sm"
                    className="gap-1.5"
                  >
                    Interested
                  </Button>
                  <Button
                    onClick={() => void sendQuoteRequest()}
                    disabled={requestingQuote}
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                  >
                    {requestingQuote ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Request quote
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Interest Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">Connect with {planner.company_name || planner.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send a connection request. Once accepted, your wedding progress will be shared with this planner.
              </p>
              <div className="space-y-2">
                <Label>Message (optional)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi! We're planning our wedding and would love your help…"
                  maxLength={500}
                  rows={3}
                />
              </div>
              <Button onClick={sendRequest} disabled={sending} className="w-full gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send Interest
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <UpgradePromptDialog
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          decision={connectDecision.allowed ? null : connectDecision}
        />

        {professionalNetworkEnabled && networkSignals && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Professional network credibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {networkSignals.total} public signal{networkSignals.total === 1 ? '' : 's'} attached to this planner profile
              </p>
              <p>
                {networkSignals.trusted} trust mark{networkSignals.trusted === 1 ? '' : 's'} · {networkSignals.workedWith} worked-with signal{networkSignals.workedWith === 1 ? '' : 's'}
              </p>
            </CardContent>
          </Card>
        )}

        <ProfessionalReviewsCard professionalType="planner" professionalId={planner.id} />

        {/* Contact Card */}
        {(planner.company_email || planner.company_phone || planner.company_website) && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {planner.company_email && plannerEmailHref && (
                <a href={plannerEmailHref} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4 text-primary" />
                  {planner.company_email}
                </a>
              )}
              {planner.company_phone && plannerPhoneHref && (
                <a href={plannerPhoneHref} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="h-4 w-4 text-primary" />
                  {planner.company_phone}
                </a>
              )}
              {planner.company_website && plannerWebsiteHref && (
                <a href={plannerWebsiteHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Globe className="h-4 w-4 text-primary" />
                  {displaySafeUrl(planner.company_website)}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {(planner.primary_county || planner.primary_town || planner.minimum_budget_kes != null || planner.maximum_budget_kes != null) && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Location & Fit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {(planner.primary_town || planner.primary_county) && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{[planner.primary_town, planner.primary_county].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {planner.service_areas && planner.service_areas.length > 0 && (
                <div>
                  <p className="font-medium text-foreground">Service areas</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {planner.service_areas.map((area) => (
                      <Badge key={area} variant="secondary" className="text-xs">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(planner.minimum_budget_kes != null || planner.maximum_budget_kes != null) && (
                <p>
                  Typical budget range:{' '}
                  <span className="font-medium text-foreground">
                    {planner.minimum_budget_kes != null ? `KES ${Number(planner.minimum_budget_kes).toLocaleString()}` : 'Flexible'}
                    {planner.maximum_budget_kes != null ? ` - KES ${Number(planner.maximum_budget_kes).toLocaleString()}` : '+'}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {planner.bio && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{planner.bio}</p>
            </CardContent>
          </Card>
        )}

        {planner.specialties && planner.specialties.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Specialties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {planner.specialties.map(s => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
