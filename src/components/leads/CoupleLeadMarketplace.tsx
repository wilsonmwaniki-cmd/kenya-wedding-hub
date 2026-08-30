import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { canonicalizeVendorCategory } from '@/lib/vendorCategories';
import {
  createLeadRequest,
  listLeadMatches,
  listWeddingLeadRequests,
  type LeadMatch,
  type LeadRequest,
} from '@/lib/leadMarketplace';
import { isLeadMarketplaceEnabled } from '@/lib/featureFlags';
import { useToast } from '@/hooks/use-toast';

interface CoupleLeadMarketplaceProps {
  weddingId: string | null;
}

interface BudgetCandidate {
  category: string;
  allocated: number;
}

interface BudgetRow { name: string; allocated: number | string | null }
interface VendorRow { category: string; selection_status: string | null; status: string | null }
interface PromptRow { category_key: string; state: string; next_prompt_at: string | null }

// lead_prompt_states is staging-only until this experiment is approved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string) => (supabase.from as any)(name);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function categoryQuestion(category: string) {
  if (category === 'Wedding Planner / Planning Team') return 'Would you like help finding a wedding planner?';
  const simple = category
    .replace('Wedding Venue', 'venue')
    .replace('Caterer', 'caterer')
    .replace('Photographer', 'photographer')
    .replace('Décor, Tents, Chairs, Tables', 'décor provider')
    .replace('Bridal Gown, Accessories, Preparation', 'bridal attire provider');
  return `Would you like help finding a ${simple.toLowerCase()}?`;
}

export default function CoupleLeadMarketplace({ weddingId }: CoupleLeadMarketplaceProps) {
  const { toast } = useToast();
  const focusedRequestId = new URLSearchParams(window.location.search).get('leadRequest');
  const [requests, setRequests] = useState<LeadRequest[]>([]);
  const [matches, setMatches] = useState<LeadMatch[]>([]);
  const [candidates, setCandidates] = useState<BudgetCandidate[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showRequests, setShowRequests] = useState(Boolean(focusedRequestId));

  const load = useCallback(async () => {
    if (!weddingId || !isLeadMarketplaceEnabled()) return;
    setLoading(true);
    try {
      const [nextRequests, budgetResult, vendorResult, promptResult] = await Promise.all([
        listWeddingLeadRequests(weddingId),
        table('budget_categories').select('name, allocated').eq('wedding_id', weddingId).eq('budget_scope', 'wedding'),
        table('vendors').select('category, selection_status, status').eq('wedding_id', weddingId),
        table('lead_prompt_states').select('category_key, state, next_prompt_at').eq('wedding_id', weddingId),
      ]);
      const nextMatches = await listLeadMatches(nextRequests.map((request) => request.id));
      const booked = new Set(
        ((vendorResult.data ?? []) as VendorRow[])
          .filter((vendor) => vendor.selection_status === 'selected' || vendor.status === 'booked')
          .map((vendor) => canonicalizeVendorCategory(vendor.category)),
      );
      const unique = new Map<string, number>();
      ((budgetResult.data ?? []) as BudgetRow[]).forEach((row) => {
        const category = canonicalizeVendorCategory(row.name);
        const allocated = Number(row.allocated ?? 0);
        if (category && allocated > 0 && !booked.has(category)) {
          unique.set(category, (unique.get(category) ?? 0) + allocated);
        }
      });
      setRequests(nextRequests);
      setMatches(nextMatches);
      setCandidates([...unique.entries()].map(([category, allocated]) => ({ category, allocated })).sort((a, b) => b.allocated - a.allocated));
      const now = Date.now();
      setDismissed(((promptResult.data ?? []) as PromptRow[])
        .filter((row) => (
          row.state === 'dismissed'
          || (row.state === 'snoozed' && row.next_prompt_at != null && new Date(row.next_prompt_at).getTime() > now)
        ))
        .map((row) => row.category_key));
    } catch (error: unknown) {
      toast({ title: 'Could not load matching help', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, weddingId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!focusedRequestId || !requests.some((request) => request.id === focusedRequestId)) return;
    const element = document.getElementById(`lead-request-${focusedRequestId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedRequestId, requests]);

  const liveCategories = useMemo(() => new Set(requests.filter((request) => ['open', 'matched', 'no_match'].includes(request.status)).map((request) => request.category_key)), [requests]);
  const suggestion = candidates.find((candidate) => !liveCategories.has(candidate.category) && !dismissed.includes(candidate.category));
  const activeRequests = requests.filter((request) => ['open', 'matched', 'no_match'].includes(request.status));

  const requestMatches = async () => {
    if (!weddingId || !suggestion) return;
    setCreating(true);
    try {
      await createLeadRequest(weddingId, suggestion.category === 'Wedding Planner / Planning Team' ? 'planner' : 'vendor', suggestion.category);
      toast({ title: 'Search started', description: 'Zania is checking up to five suitable providers.' });
      await load();
    } catch (error: unknown) {
      toast({ title: 'Could not start the search', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const dismissSuggestion = async () => {
    if (!weddingId || !suggestion) return;
    const providerType = suggestion.category === 'Wedding Planner / Planning Team' ? 'planner' : 'vendor';
    const nextPromptAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setCreating(true);
    try {
      const filters = table('lead_prompt_states')
        .select('category_key')
        .eq('wedding_id', weddingId)
        .eq('provider_type', providerType)
        .eq('category_key', suggestion.category);
      const { data: existing, error: lookupError } = await filters.maybeSingle();
      if (lookupError) throw lookupError;

      const result = existing
        ? await table('lead_prompt_states')
            .update({ state: 'snoozed', next_prompt_at: nextPromptAt })
            .eq('wedding_id', weddingId)
            .eq('provider_type', providerType)
            .eq('category_key', suggestion.category)
        : await table('lead_prompt_states').insert({
            wedding_id: weddingId,
            provider_type: providerType,
            category_key: suggestion.category,
            state: 'snoozed',
            next_prompt_at: nextPromptAt,
          });
      if (result.error) throw result.error;

      setDismissed((current) => current.includes(suggestion.category) ? current : [...current, suggestion.category]);
      toast({
        title: 'Okay, not now',
        description: `We will not ask about ${suggestion.category.toLowerCase()} again for 30 days.`,
      });
    } catch (error: unknown) {
      toast({ title: 'Could not save your choice', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  if (!isLeadMarketplaceEnabled() || !weddingId) return null;
  if (loading && !requests.length) return <div className="border border-border bg-card p-5 text-sm text-muted-foreground">Loading matching help…</div>;

  return (
    <section id="provider-matching" className="scroll-mt-24 border border-border bg-card p-4 shadow-sm" aria-labelledby="matching-help-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Provider matching</p>
          <h2 id="matching-help-title" className="mt-1 font-display text-lg font-semibold text-foreground">Find help within your budget</h2>
        </div>
        {activeRequests.length > 0 && (
          <button
            type="button"
            className="flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-expanded={showRequests}
            aria-controls="provider-matching-searches"
            onClick={() => setShowRequests((current) => !current)}
          >
            {showRequests ? 'Hide' : 'View'} {activeRequests.length} search{activeRequests.length === 1 ? '' : 'es'}
            {showRequests ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {activeRequests.length > 0 && showRequests && (
        <div id="provider-matching-searches" className="mt-3 divide-y divide-border border-y border-border">
          {activeRequests.map((request) => {
            const requestMatches = matches.filter((match) => match.lead_request_id === request.id && ['accepted', 'selected'].includes(match.status));
            const pendingMatchCount = matches.filter((match) => match.lead_request_id === request.id && match.status === 'invited').length;
            return (
              <div
                key={request.id}
                id={`lead-request-${request.id}`}
                className={`scroll-mt-28 py-3 ${focusedRequestId === request.id ? 'border-l-4 border-primary bg-primary/5 pl-3' : ''}`}
              >
                <p className="font-medium text-foreground">{request.category_key}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {request.status === 'no_match'
                    ? 'No suitable subscribed provider is available yet. We will not share your details.'
                    : requestMatches.length
                      ? `${requestMatches.length} provider${requestMatches.length === 1 ? ' is' : 's are'} ready to talk.`
                      : pendingMatchCount > 0
                        ? `${pendingMatchCount} suitable provider${pendingMatchCount === 1 ? ' has' : 's have'} been invited to reply.`
                        : 'Up to five suitable providers have been invited.'}
                </p>
                {requestMatches.map((match) => (
                  <Link key={match.id} to={`/matches/${match.id}`} className="mt-3 flex min-h-11 items-center justify-between border-t border-border pt-3 text-sm font-medium text-primary">
                    Talk to {match.provider_name}<ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {suggestion && (
        <div className="mt-3 border-t border-border pt-3 sm:flex sm:items-end sm:justify-between sm:gap-4">
          <div>
          <p className="text-base font-medium text-foreground">{categoryQuestion(suggestion.category)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Your details stay private until you choose to share them.</p>
          </div>
          <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
            <Button size="sm" onClick={requestMatches} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Find matches
            </Button>
            <Button size="sm" variant="outline" onClick={dismissSuggestion} disabled={creating}>Not now</Button>
          </div>
        </div>
      )}

      {!suggestion && activeRequests.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Your currently budgeted categories are already covered.</p>
      )}
    </section>
  );
}
