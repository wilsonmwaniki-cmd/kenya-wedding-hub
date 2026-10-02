import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Search, Store, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type VendorCandidate = {
  id: string;
  business_name: string;
  category: string;
  location: string | null;
  website: string | null;
  source_url: string | null;
  source_kind: string;
  profile_status: string;
  candidate_status: string;
  planner_client_id: string | null;
  wedding_id: string | null;
  snapshot: {
    summary?: string;
    matchReasons?: string[];
    unknowns?: string[];
  } | null;
  created_at: string;
};

export default function VendorCandidates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<VendorCandidate[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('vendor_candidates' as any)
      .select('id,business_name,category,location,website,source_url,source_kind,profile_status,candidate_status,planner_client_id,wedding_id,snapshot,created_at')
      .eq('owner_user_id', user.id)
      .neq('candidate_status', 'dismissed')
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      toast({ title: 'Could not load saved candidates', description: error.message, variant: 'destructive' });
      return;
    }

    const rows = (data ?? []) as unknown as VendorCandidate[];
    setCandidates(rows);
    const clientIds = [...new Set(rows.flatMap((candidate) => candidate.planner_client_id ? [candidate.planner_client_id] : []))];
    if (clientIds.length) {
      const { data: clients } = await supabase
        .from('planner_clients')
        .select('id,client_name,partner_name')
        .in('id', clientIds);
      setClientNames(Object.fromEntries((clients ?? []).map((client) => [
        client.id,
        [client.client_name, client.partner_name].filter(Boolean).join(' & '),
      ])));
    } else {
      setClientNames({});
    }
    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const savedCount = candidates.filter((candidate) => candidate.candidate_status === 'saved').length;

  const dismissCandidate = async (candidate: VendorCandidate) => {
    setRemovingId(candidate.id);
    const { error } = await supabase
      .from('vendor_candidates' as any)
      .update({ candidate_status: 'dismissed' })
      .eq('id', candidate.id)
      .eq('owner_user_id', user?.id ?? '');
    setRemovingId(null);
    if (error) {
      toast({ title: 'Could not remove candidate', description: error.message, variant: 'destructive' });
      return;
    }
    setCandidates((current) => current.filter((item) => item.id !== candidate.id));
    toast({ title: 'Candidate removed', description: `${candidate.business_name} is no longer in your private list.` });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-[28px] border border-border/70 bg-card/90 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              <Search className="h-4 w-4" /> Private research
            </div>
            <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">Saved vendor candidates</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Vendors you asked Zania to remember. Saving a candidate does not contact the vendor or publish a profile.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit px-3 py-1.5 text-sm">{savedCount} saved</Badge>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-[28px] border border-border/70 bg-card/70">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading saved vendor candidates" />
        </div>
      ) : candidates.length === 0 ? (
        <Card className="rounded-[28px] border-dashed">
          <CardContent className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
            <Store className="mb-4 h-9 w-9 text-muted-foreground" />
            <h2 className="font-display text-2xl font-semibold">No saved candidates yet</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Ask Zania to find a vendor, then say “Save this vendor as a private candidate.”
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {candidates.map((candidate) => {
            const sourceHref = candidate.website || candidate.source_url;
            const reasons = candidate.snapshot?.matchReasons ?? [];
            const unknowns = candidate.snapshot?.unknowns ?? [];
            const clientName = candidate.planner_client_id ? clientNames[candidate.planner_client_id] : null;
            return (
              <Card key={candidate.id} className="rounded-[26px] border-border/70 shadow-sm">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="font-display text-2xl">{candidate.business_name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[candidate.category, candidate.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Badge variant="outline">{clientName ?? (candidate.wedding_id ? 'Wedding candidate' : 'Unassigned')}</Badge>
                  </div>
                  {candidate.snapshot?.summary ? (
                    <p className="text-sm leading-6 text-foreground/80">{candidate.snapshot.summary}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {reasons.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Why it may fit</p>
                      <ul className="mt-2 space-y-1 text-sm text-foreground/80">
                        {reasons.slice(0, 4).map((reason) => <li key={reason}>• {reason}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {unknowns.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Still confirm</p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {unknowns.slice(0, 4).map((unknown) => <li key={unknown}>• {unknown}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                    {sourceHref ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={sourceHref} target="_blank" rel="noreferrer">View source <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={removingId === candidate.id}
                      onClick={() => void dismissCandidate(candidate)}
                    >
                      {removingId === candidate.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                      Remove
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">
                      Saved {new Date(candidate.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
