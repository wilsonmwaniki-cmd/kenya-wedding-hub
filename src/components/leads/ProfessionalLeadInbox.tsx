import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isLeadMarketplaceEnabled } from '@/lib/featureFlags';
import {
  formatLeadBudgetRange,
  listLeadBriefs,
  listLeadMatches,
  updateLeadMatchStatus,
  type LeadBrief,
  type LeadMatch,
} from '@/lib/leadMarketplace';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

export default function ProfessionalLeadInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [matches, setMatches] = useState<LeadMatch[]>([]);
  const [briefs, setBriefs] = useState<Record<string, LeadBrief>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !isLeadMarketplaceEnabled()) return;
    try {
      const nextMatches = await listLeadMatches();
      const owned = nextMatches.filter((match) => match.provider_user_id === user.id && ['invited', 'accepted', 'selected'].includes(match.status));
      const nextBriefs = await listLeadBriefs([...new Set(owned.map((match) => match.lead_request_id))]);
      setMatches(owned);
      setBriefs(Object.fromEntries(nextBriefs.map((brief) => [brief.lead_request_id, brief])));
    } catch (error: unknown) {
      toast({ title: 'Could not load leads', description: errorMessage(error), variant: 'destructive' });
    }
  }, [toast, user]);

  useEffect(() => { void load(); }, [load]);

  const respond = async (match: LeadMatch, status: 'accepted' | 'passed') => {
    setBusyId(match.id);
    try {
      await updateLeadMatchStatus(match.id, status);
      toast({ title: status === 'accepted' ? 'Conversation opened' : 'Lead passed' });
      await load();
    } catch (error: unknown) {
      toast({ title: 'Could not respond', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (!isLeadMarketplaceEnabled() || !matches.length) return null;

  return (
    <section className="border border-border bg-card p-5 shadow-sm" aria-labelledby="lead-inbox-title">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">New business</p>
      <h2 id="lead-inbox-title" className="mt-2 font-display text-xl font-semibold text-foreground">Couples looking for help</h2>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {matches.map((match) => {
          const brief = briefs[match.lead_request_id];
          return (
            <article key={match.id} className="py-4">
              <p className="font-medium text-foreground">{match.provider_category}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{brief?.wedding_date ? new Date(`${brief.wedding_date}T00:00:00`).toLocaleDateString('en-GB') : 'Date unavailable'}</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{[brief?.location_town, brief?.location_county].filter(Boolean).join(', ') || 'Location not set'}</span>
                <span>{formatLeadBudgetRange(brief)}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">The couple’s name and contact details are private.</p>
              {match.status === 'invited' ? (
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => respond(match, 'accepted')} disabled={busyId === match.id}>I’m interested</Button>
                  <Button variant="outline" onClick={() => respond(match, 'passed')} disabled={busyId === match.id}>Pass</Button>
                </div>
              ) : (
                <Button asChild className="mt-4">
                  <Link to={`/matches/${match.id}`}>Open conversation<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
