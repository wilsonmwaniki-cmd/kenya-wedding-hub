import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Heart, MapPin, Users, Calendar, Star, ArrowLeft, Loader2, Tag, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';

interface PortfolioData {
  id: string;
  title: string;
  wedding_date: string | null;
  wedding_location: string | null;
  guest_count: number;
  style_tags: string[];
  description: string | null;
  cover_photo_url: string | null;
}

interface PortfolioVendor {
  id: string;
  vendor_name: string;
  vendor_category: string;
  vendor_listing_id: string | null;
}

interface VendorReview {
  id: string;
  rating: number;
  review_text: string | null;
  reviewer_name: string | null;
  reviewer_role: string | null;
  created_at: string;
  vendor_listing_id: string;
}

export default function WeddingPortfolio() {
  const { token } = useParams<{ token: string }>();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [vendors, setVendors] = useState<PortfolioVendor[]>([]);
  const [reviews, setReviews] = useState<VendorReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data: p } = await supabase
        .from('wedding_portfolios')
        .select('id, title, wedding_date, wedding_location, guest_count, style_tags, description, cover_photo_url')
        .eq('share_token', token)
        .eq('is_published', true)
        .maybeSingle();

      if (!p) { setLoading(false); return; }
      setPortfolio(p as PortfolioData);

      const [vendorRes, reviewRes] = await Promise.all([
        supabase.from('portfolio_vendors').select('*').eq('portfolio_id', p.id),
        supabase.from('vendor_reviews').select('*').eq('portfolio_id', p.id),
      ]);
      setVendors((vendorRes.data || []) as PortfolioVendor[]);
      setReviews((reviewRes.data || []) as VendorReview[]);
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">This wedding story is not available.</p>
        <Link to="/" className="text-primary hover:underline text-sm">← Back to home</Link>
      </div>
    );
  }

  const weddingDate = portfolio.wedding_date
    ? new Date(portfolio.wedding_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? 'text-accent fill-accent' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative bg-gradient-hero text-primary-foreground">
        {portfolio.cover_photo_url && (
          <img src={portfolio.cover_photo_url} alt="" className="absolute inset-0 h-full w-full object-cover mix-blend-overlay opacity-40" />
        )}
        <div className="relative px-6 py-20 text-center lg:py-28">
          <Link to="/" className="absolute left-4 top-4 text-primary-foreground/70 hover:text-primary-foreground text-sm flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Heart className="mx-auto h-10 w-10 mb-4" fill="currentColor" />
            <h1 className="font-display text-4xl font-bold sm:text-5xl">{portfolio.title}</h1>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-primary-foreground/80">
              {weddingDate && (
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {weddingDate}</span>
              )}
              {portfolio.wedding_location && (
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {portfolio.wedding_location}</span>
              )}
              {portfolio.guest_count > 0 && (
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {portfolio.guest_count} Guests</span>
              )}
            </div>
            {portfolio.style_tags.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {portfolio.style_tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0">
                    <Tag className="h-3 w-3 mr-1" /> {tag}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
        {/* Description */}
        {portfolio.description && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-center text-lg text-muted-foreground leading-relaxed">
            {portfolio.description}
          </motion.p>
        )}

        {/* Vendor Credits */}
        {vendors.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-semibold text-foreground text-center mb-6">
              <Store className="inline h-6 w-6 mr-2 text-primary" />
              Wedding Team
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {vendors.map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                  <Card className="shadow-card">
                    <CardContent className="flex items-center gap-4 p-4">
                      <Avatar className="h-11 w-11 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {v.vendor_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-card-foreground truncate">{v.vendor_name}</p>
                        <Badge variant="outline" className="text-xs mt-0.5">{v.vendor_category}</Badge>
                      </div>
                      {/* Show avg rating if reviews exist for this vendor */}
                      {(() => {
                        const vReviews = reviews.filter(r => r.vendor_listing_id === v.vendor_listing_id);
                        if (vReviews.length === 0) return null;
                        const avg = vReviews.reduce((s, r) => s + r.rating, 0) / vReviews.length;
                        return (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 text-accent fill-accent" />
                            <span className="font-semibold text-foreground">{avg.toFixed(1)}</span>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <Separator className="mb-8" />
            <h2 className="font-display text-2xl font-semibold text-foreground text-center mb-6">
              <Star className="inline h-6 w-6 mr-2 text-accent" />
              Reviews
            </h2>
            <div className="space-y-4">
              {reviews.map((r, i) => {
                const vendor = vendors.find(v => v.vendor_listing_id === r.vendor_listing_id);
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                    <Card className="shadow-card">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-card-foreground">{r.reviewer_name || 'Anonymous'}</p>
                            {r.reviewer_role && <p className="text-xs text-muted-foreground capitalize">{r.reviewer_role}</p>}
                          </div>
                          {renderStars(r.rating)}
                        </div>
                        {vendor && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Reviewed <span className="font-medium text-foreground">{vendor.vendor_name}</span> ({vendor.vendor_category})
                          </p>
                        )}
                        {r.review_text && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{r.review_text}</p>}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-primary" fill="currentColor" />
          <span>Centerpiece © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
