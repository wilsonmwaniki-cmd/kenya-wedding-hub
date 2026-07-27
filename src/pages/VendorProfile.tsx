import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Globe, Loader2, Mail, MapPin, Phone, Star, Store } from 'lucide-react';

import BrandWordmark from '@/components/BrandWordmark';
import VendorInterestButton from '@/components/VendorInterestButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatBudgetBand } from '@/lib/kenyaLocations';
import { getVendorReputationOverview, type VendorReputationOverview } from '@/lib/vendorReputation';
import { getProfessionalNetworkPath, isProfessionalNetworkEnabled } from '@/lib/featureFlags';
import { PublicPageSkeleton } from '@/components/AppLoadingSkeletons';
import { displaySafeUrl, normalizeEmailHref, normalizeExternalUrl, normalizePhoneHref } from '@/lib/security';
import { canonicalizeVendorCategory } from '@/lib/vendorCategories';

interface VendorProfileData {
  id: string;
  business_name: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  location: string | null;
  location_county: string | null;
  location_town: string | null;
  service_areas: string[];
  travel_scope: string;
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
  services: string[] | null;
  is_verified: boolean;
  phone: string | null;
  email: string | null;
  website: string | null;
  profile_kind: 'claimed' | 'curated' | 'featured';
  public_listing_note: string | null;
}

interface VendorSignalSummary {
  total: number;
  confirmed: number;
  recommended: number;
  collaborators: number;
}

interface PlannerRecommendation {
  planner_public_name: string;
  planner_company_name: string | null;
  planner_is_founding: boolean;
  recommendation_note: string | null;
}

function vendorProfileBadge(listing: VendorProfileData) {
  switch (listing.profile_kind) {
    case 'featured':
      return { label: 'Featured profile', tone: 'default' as const };
    case 'curated':
      return { label: 'Curated listing', tone: 'outline' as const };
    case 'claimed':
    default:
      return { label: 'Profile claimed', tone: 'secondary' as const };
  }
}

export default function VendorProfile() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [vendor, setVendor] = useState<VendorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [vendorTrust, setVendorTrust] = useState<VendorReputationOverview | null>(null);
  const [recommendations, setRecommendations] = useState<PlannerRecommendation[]>([]);
  const [signalSummary, setSignalSummary] = useState<VendorSignalSummary | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const professionalNetworkEnabled = isProfessionalNetworkEnabled();

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const [vendorRes, recommendationsRes, signalsRes] = await Promise.all([
        supabase
          .from('vendor_listings')
          .select('id, business_name, category, description, logo_url, location, location_county, location_town, service_areas, travel_scope, minimum_budget_kes, maximum_budget_kes, services, is_verified, phone, email, website, profile_kind, public_listing_note')
          .eq('id', id)
          .eq('is_approved', true)
          .eq('directory_opt_out', false)
          .maybeSingle(),
        professionalNetworkEnabled
          ? (supabase as any)
              .from('vendor_planner_recommendations')
              .select('planner_public_name, planner_company_name, planner_is_founding, recommendation_note')
              .eq('vendor_listing_id', id)
              .eq('active', true)
          : Promise.resolve({ data: [] }),
        professionalNetworkEnabled
          ? (supabase as any)
              .from('professional_network_relationships')
              .select('relationship_type, target_acknowledged')
              .eq('target_vendor_listing_id', id)
              .eq('active', true)
              .eq('is_public', true)
          : Promise.resolve({ data: [] }),
      ]);

      if (!vendorRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setVendor({
        ...(vendorRes.data as VendorProfileData),
        category: canonicalizeVendorCategory(vendorRes.data.category),
      });
      setRecommendations((recommendationsRes.data as PlannerRecommendation[] | null) ?? []);
      const summary = ((signalsRes.data as Array<{ relationship_type: string; target_acknowledged: boolean }> | null) ?? []).reduce((acc, row) => {
        acc.total += 1;
        if (row.target_acknowledged) acc.confirmed += 1;
        if (row.relationship_type === 'recommended' || row.relationship_type === 'preferred_vendor') acc.recommended += 1;
        if (row.relationship_type === 'worked_with' || row.relationship_type === 'trusted_collaborator') acc.collaborators += 1;
        return acc;
      }, { total: 0, confirmed: 0, recommended: 0, collaborators: 0 });
      setSignalSummary(summary.total > 0 ? summary : null);

      const trust = await getVendorReputationOverview(id, 3).catch(() => null);
      setVendorTrust(trust);

      if (user) {
        const { data } = await (supabase as any)
          .from('vendor_connection_requests')
          .select('status')
          .eq('vendor_listing_id', id)
          .eq('requester_user_id', user.id)
          .maybeSingle();
        if (data?.status) setRequestStatus(data.status);
      }

      setLoading(false);
    };

    void load();
  }, [id, user]);

  const foundingRecommendation = useMemo(
    () => recommendations.find((item) => item.planner_is_founding),
    [recommendations],
  );

  if (loading) {
    return <PublicPageSkeleton card={false} />;
  }

  if (notFound || !vendor) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">Vendor profile not found.</p>
        <Link to="/vendors-directory">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to directory</Button>
        </Link>
      </div>
    );
  }

  const profileBadge = vendorProfileBadge(vendor);
  const vendorEmailHref = normalizeEmailHref(vendor.email);
  const vendorPhoneHref = normalizePhoneHref(vendor.phone);
  const vendorWebsiteHref = normalizeExternalUrl(vendor.website);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <BrandWordmark size="sm" className="shrink-0" />
          <Link to="/vendors-directory" className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground">
            Back to directory
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <Avatar className="h-20 w-20 border-2 border-border">
            {vendor.logo_url ? <AvatarImage src={vendor.logo_url} alt={vendor.business_name} /> : null}
            <AvatarFallback className="bg-primary/10 text-2xl text-primary">
              {vendor.business_name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold text-foreground">{vendor.business_name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{vendor.category}</Badge>
              <Badge variant={profileBadge.tone}>{profileBadge.label}</Badge>
              {vendor.is_verified && <Badge>Verified by vendor</Badge>}
            </div>
            {vendor.description && (
              <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{vendor.description}</p>
            )}
          </div>
        </div>

        {professionalNetworkEnabled && foundingRecommendation && (
          <Card className="border-[#ead8a8] bg-[#fff7e6] shadow-card">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a5b30]">
                Recommended by a Zania Founding Planner
              </p>
              <p className="mt-2 font-medium text-[#4c3528]">
                {foundingRecommendation.planner_company_name || foundingRecommendation.planner_public_name}
              </p>
              {foundingRecommendation.recommendation_note && (
                <p className="mt-1 text-sm text-[#6a5142]">{foundingRecommendation.recommendation_note}</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {professionalNetworkEnabled ? <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Network credibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {signalSummary ? (
                <>
                  <p className="font-medium text-foreground">{signalSummary.total} public professional signal{signalSummary.total === 1 ? '' : 's'}</p>
                  <p>{signalSummary.confirmed} acknowledged by this vendor</p>
                  <p>{signalSummary.recommended} recommendation signal{signalSummary.recommended === 1 ? '' : 's'} · {signalSummary.collaborators} collaboration mark{signalSummary.collaborators === 1 ? '' : 's'}</p>
                </>
              ) : (
                <p>No public network signals yet.</p>
              )}
            </CardContent>
          </Card> : null}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Planner trust</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {vendorTrust?.benchmark_visible && vendorTrust.average_overall_rating != null ? (
                <>
                  <div className="flex items-center gap-2 text-foreground">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    <span className="font-medium">{vendorTrust.average_overall_rating.toFixed(1)}/5 planner score</span>
                  </div>
                  <p>{vendorTrust.sample_size} planner scorecards</p>
                  <p>
                    {vendorTrust.hire_again_rate != null ? `${Math.round(vendorTrust.hire_again_rate * 100)}% would hire again` : 'Hire-again rate pending'}
                    {vendorTrust.on_time_rate != null ? ` · ${Math.round(vendorTrust.on_time_rate * 100)}% on time` : ''}
                  </p>
                </>
              ) : (
                <p>No planner benchmark is visible yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Typical fit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {(vendor.location || vendor.location_town || vendor.location_county) && (
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{vendor.location || [vendor.location_town, vendor.location_county].filter(Boolean).join(', ')}</p>
              )}
              {formatBudgetBand(vendor.minimum_budget_kes, vendor.maximum_budget_kes) && (
                <p>Typical budget: <span className="font-medium text-foreground">{formatBudgetBand(vendor.minimum_budget_kes, vendor.maximum_budget_kes)}</span></p>
              )}
              {vendor.service_areas.length > 0 && (
                <p>{vendor.service_areas.length} service area{vendor.service_areas.length === 1 ? '' : 's'} listed</p>
              )}
            </CardContent>
          </Card>
        </div>

        {(vendor.email || vendor.phone || vendor.website) && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vendor.email && vendorEmailHref && (
                <a href={vendorEmailHref} className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  {vendor.email}
                </a>
              )}
              {vendor.phone && vendorPhoneHref && (
                <a href={vendorPhoneHref} className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  {vendor.phone}
                </a>
              )}
              {vendor.website && vendorWebsiteHref && (
                <a href={vendorWebsiteHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <Globe className="h-4 w-4 text-primary" />
                  {displaySafeUrl(vendor.website)}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {vendor.services && vendor.services.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {vendor.services.map((service) => (
                  <Badge key={service} variant="secondary">{service}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {vendor.profile_kind === 'curated' && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Listing note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {vendor.public_listing_note || 'This vendor was listed from public business information and Zania curation.'}
              </p>
            </CardContent>
          </Card>
        )}

        {user && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">Professional outreach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If this is the right fit for your wedding or planner network, keep the next step structured inside Zania.
              </p>
              <div className="flex flex-wrap gap-3">
                <VendorInterestButton
                  vendorListingId={vendor.id}
                  vendorName={vendor.business_name}
                  vendorEmail={vendor.email}
                  existingStatus={requestStatus}
                />
                {professionalNetworkEnabled && (profile?.role === 'planner' || profile?.role === 'vendor') && (
                  <Link to={getProfessionalNetworkPath()}>
                    <Button variant="outline">Open network workspace</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
