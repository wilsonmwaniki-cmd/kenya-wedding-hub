import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Search, ArrowRight, Loader2, UserCircle, ArrowLeft, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatBudgetBand, getBudgetFit, getLocationMatch, getTownsForCounty, kenyaCounties } from '@/lib/kenyaLocations';

interface PlannerItem {
  id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  specialties: string[] | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  primary_county: string | null;
  primary_town: string | null;
  service_areas: string[] | null;
  travel_scope: string | null;
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
}

export default function PlannerDirectory() {
  const { user, profile } = useAuth();
  const [planners, setPlanners] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationCounty, setLocationCounty] = useState('all');
  const [locationTown, setLocationTown] = useState('all');
  const [weddingBudgetTotal, setWeddingBudgetTotal] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('public_planner_profiles')
        .select('id, full_name, company_name, avatar_url, bio, specialties, company_email, company_phone, company_website, primary_county, primary_town, service_areas, travel_scope, minimum_budget_kes, maximum_budget_kes');
      setPlanners((data as PlannerItem[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const isCouple = profile?.role === 'couple';
    const isCommittee = profile?.role === 'planner' && profile?.planner_type === 'committee';
    if (!user || (!isCouple && !isCommittee)) return;
    const loadBudgetTotal = async () => {
      const { data } = await supabase
        .from('budget_categories')
        .select('allocated')
        .eq('user_id', user.id)
        .eq('budget_scope', 'wedding');
      const total = (data || []).reduce((sum, item) => sum + Number(item.allocated || 0), 0);
      setWeddingBudgetTotal(total || null);
    };
    void loadBudgetTotal();
  }, [user, profile?.role, profile?.planner_type]);

  const availableTowns = locationCounty === 'all' ? [] : getTownsForCounty(locationCounty);

  const filtered = planners.filter((p) => {
    if (locationCounty !== 'all') {
      const servesCounty =
        p.primary_county?.toLowerCase() === locationCounty.toLowerCase() ||
        p.service_areas?.some((area) => area.toLowerCase() === locationCounty.toLowerCase()) ||
        p.travel_scope === 'nationwide';
      if (!servesCounty) return false;
    }
    if (locationTown !== 'all' && p.primary_town?.toLowerCase() !== locationTown.toLowerCase()) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.company_name?.toLowerCase().includes(q) ||
      p.specialties?.some((s) => s.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    const aLocation = getLocationMatch({
      weddingCounty: profile?.wedding_county,
      weddingTown: profile?.wedding_town,
      primaryCounty: a.primary_county,
      primaryTown: a.primary_town,
      serviceAreas: a.service_areas,
      travelScope: a.travel_scope,
    });
    const bLocation = getLocationMatch({
      weddingCounty: profile?.wedding_county,
      weddingTown: profile?.wedding_town,
      primaryCounty: b.primary_county,
      primaryTown: b.primary_town,
      serviceAreas: b.service_areas,
      travelScope: b.travel_scope,
    });
    const aBudget = getBudgetFit(weddingBudgetTotal, a.minimum_budget_kes, a.maximum_budget_kes);
    const bBudget = getBudgetFit(weddingBudgetTotal, b.minimum_budget_kes, b.maximum_budget_kes);
    const scoreA = aLocation.score + aBudget.score;
    const scoreB = bLocation.score + bBudget.score;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (a.company_name || a.full_name || '').localeCompare(b.company_name || b.full_name || '');
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" fill="currentColor" />
          <span className="font-display text-xl font-bold text-foreground">Zania</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Home
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Sign In</Button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="bg-gradient-warm px-6 py-16 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold text-foreground sm:text-4xl"
        >
          Find Your Wedding Planner
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-3 max-w-md text-muted-foreground"
        >
          Browse experienced Kenyan wedding planners ready to bring your dream day to life.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto mt-8 flex max-w-5xl flex-col gap-3 md:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialty…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={locationCounty}
            onValueChange={(value) => {
              setLocationCounty(value);
              setLocationTown('all');
            }}
          >
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="All counties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counties</SelectItem>
              {kenyaCounties.map((county) => (
                <SelectItem key={county} value={county}>{county}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationTown} onValueChange={setLocationTown} disabled={locationCounty === 'all'}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="All towns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All towns</SelectItem>
              {availableTowns.map((town) => (
                <SelectItem key={town} value={town}>{town}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            {search || locationCounty !== 'all' || locationTown !== 'all'
              ? 'No planners match your search or location filters.'
              : 'No planners have registered yet.'}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              (() => {
                const locationMatch = getLocationMatch({
                  weddingCounty: profile?.wedding_county,
                  weddingTown: profile?.wedding_town,
                  primaryCounty: p.primary_county,
                  primaryTown: p.primary_town,
                  serviceAreas: p.service_areas,
                  travelScope: p.travel_scope,
                });
                const budgetFit = getBudgetFit(weddingBudgetTotal, p.minimum_budget_kes, p.maximum_budget_kes);
                const matchReasons = [...locationMatch.reasons];
                if (budgetFit.label) matchReasons.push(budgetFit.label);
                const uniqueReasons = [...new Set(matchReasons)];

                return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/planner/${p.id}`}>
                  <Card className="group h-full shadow-card transition-shadow hover:shadow-warm">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <Avatar className="h-16 w-16 border-2 border-border">
                        {p.avatar_url ? (
                          <AvatarImage src={p.avatar_url} alt={p.company_name || p.full_name || 'Planner'} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-lg text-primary">
                          {p.full_name
                            ? p.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                            : <UserCircle className="h-7 w-7" />}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="mt-4 font-display text-lg font-semibold text-card-foreground">
                        {p.company_name || p.full_name || 'Wedding Planner'}
                      </h3>
                      {p.company_name && p.full_name && (
                        <p className="text-sm text-muted-foreground">{p.full_name}</p>
                      )}
                      {p.bio && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.bio}</p>
                      )}
                      {(p.primary_town || p.primary_county) && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {[p.primary_town, p.primary_county].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {uniqueReasons.length > 0 && (
                        <div className="mt-2 w-full rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-left">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Why this match
                          </p>
                          <p className="mt-1 text-xs text-foreground">
                            {uniqueReasons.join(' · ')}
                          </p>
                        </div>
                      )}
                      {p.specialties && p.specialties.length > 0 && (
                        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                          {p.specialties.slice(0, 3).map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                          {p.specialties.length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{p.specialties.length - 3}</Badge>
                          )}
                        </div>
                      )}
                      {formatBudgetBand(p.minimum_budget_kes, p.maximum_budget_kes) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Typical wedding size: {formatBudgetBand(p.minimum_budget_kes, p.maximum_budget_kes)}
                        </p>
                      )}
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        View Profile <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
                );
              })()
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-primary" fill="currentColor" />
          <span>Zania © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
