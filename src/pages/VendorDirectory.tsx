import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Heart, Search, Loader2, Store, ArrowLeft, CheckCircle2, MapPin, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import VendorInterestButton from '@/components/VendorInterestButton';

const vendorCategories = ['All', 'Venue', 'Catering', 'Photography', 'Videography', 'Flowers', 'Music/DJ', 'Décor', 'Transport', 'MC', 'Cake', 'Other'];

interface VendorListing {
  id: string;
  business_name: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  location: string | null;
  services: string[] | null;
  is_verified: boolean;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export default function VendorDirectory() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<VendorListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [requestStatuses, setRequestStatuses] = useState<Record<string, string>>({});
  const [vendorRatings, setVendorRatings] = useState<Record<string, { avg: number; count: number }>>({});

  useEffect(() => {

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('vendor_listings')
        .select('id, business_name, category, description, logo_url, location, services, is_verified, phone, email, website')
        .eq('is_approved', true)
        .order('is_verified', { ascending: false });
      setVendors((data as VendorListing[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  // Load existing request statuses for logged-in user
  useEffect(() => {
    if (!user) return;
    const loadStatuses = async () => {
      const { data } = await supabase
        .from('vendor_connection_requests' as any)
        .select('vendor_listing_id, status')
        .eq('requester_user_id', user.id);
      if (data) {
        const map: Record<string, string> = {};
        (data as any[]).forEach((r: any) => { map[r.vendor_listing_id] = r.status; });
        setRequestStatuses(map);
      }
    };
    loadStatuses();
  }, [user]);

  const filtered = vendors.filter((v) => {
    if (category !== 'All' && v.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.business_name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.location?.toLowerCase().includes(q) ||
      v.services?.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-background">
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
          {!user && (
            <Link to="/auth">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </nav>

      <section className="bg-gradient-warm px-6 py-16 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold text-foreground sm:text-4xl"
        >
          <Store className="inline h-8 w-8 mr-2 text-primary" />
          Vendor Directory
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-3 max-w-md text-muted-foreground"
        >
          Discover verified wedding vendors across Kenya. From venues to photographers, find the perfect team for your big day.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto mt-8 flex max-w-lg gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vendorCategories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            {search || category !== 'All' ? 'No vendors match your search.' : 'No vendors listed yet. Be the first!'}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group h-full shadow-card transition-shadow hover:shadow-warm">
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div className="relative">
                      <Avatar className="h-16 w-16 border-2 border-border">
                        {v.logo_url ? (
                          <AvatarImage src={v.logo_url} alt={v.business_name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-lg text-primary">
                          {v.business_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {v.is_verified && (
                        <CheckCircle2 className="absolute -bottom-1 -right-1 h-5 w-5 text-primary fill-background" />
                      )}
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-card-foreground">
                      {v.business_name}
                    </h3>
                    <Badge variant="outline" className="mt-1 text-xs">{v.category}</Badge>
                    {v.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {v.location}
                      </p>
                    )}
                    {v.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                    )}
                    {v.services && v.services.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                        {v.services.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {v.services.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{v.services.length - 3}</Badge>
                        )}
                      </div>
                    )}
                    {v.is_verified && (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <CheckCircle2 className="h-3 w-3" /> Verified Vendor
                      </span>
                    )}
                    {/* Interest button for logged-in couples/planners */}
                    {user && (
                      <div className="mt-4">
                        <VendorInterestButton
                          vendorListingId={v.id}
                          vendorName={v.business_name}
                          vendorEmail={v.email}
                          existingStatus={requestStatuses[v.id] || null}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-primary" fill="currentColor" />
          <span>WeddingPlan Kenya © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
