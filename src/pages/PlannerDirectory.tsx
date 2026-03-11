import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Heart, Search, ArrowRight, Loader2, UserCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

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
}

export default function PlannerDirectory() {
  const [planners, setPlanners] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('public_planner_profiles')
        .select('id, full_name, company_name, avatar_url, bio, specialties, company_email, company_phone, company_website');
      setPlanners((data as PlannerItem[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = planners.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.company_name?.toLowerCase().includes(q) ||
      p.specialties?.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" fill="currentColor" />
          <span className="font-display text-xl font-bold text-foreground">WeddingPlan Kenya</span>
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
          className="mx-auto mt-8 max-w-md"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialty…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
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
            {search ? 'No planners match your search.' : 'No planners have registered yet.'}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
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
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        View Profile <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-primary" fill="currentColor" />
          <span>WeddingPlan Kenya © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
