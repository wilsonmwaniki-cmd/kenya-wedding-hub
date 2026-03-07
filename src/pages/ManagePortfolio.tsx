import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Heart, Plus, Trash2, Copy, ExternalLink, Star, Loader2, Eye, Tag, X } from 'lucide-react';
import { motion } from 'framer-motion';

const STYLE_SUGGESTIONS = ['Garden', 'Church', 'Beach', 'Traditional', 'Modern', 'Rustic', 'Luxury', 'Intimate', 'Outdoor', 'Cultural'];

interface Portfolio {
  id: string;
  title: string;
  wedding_date: string | null;
  wedding_location: string | null;
  guest_count: number;
  style_tags: string[];
  description: string | null;
  is_published: boolean;
  share_token: string;
}

interface PortfolioVendor {
  id: string;
  vendor_name: string;
  vendor_category: string;
  vendor_listing_id: string | null;
  portfolio_id: string;
}

interface Review {
  id: string;
  vendor_listing_id: string;
  rating: number;
  review_text: string | null;
  reviewer_name: string | null;
  reviewer_role: string | null;
}

export default function ManagePortfolio() {
  const { user, profile } = useAuth();
  const { selectedClient, dataOrFilter } = usePlanner();
  const { toast } = useToast();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vendors, setVendors] = useState<PortfolioVendor[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [location, setLocation] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Review dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewVendorId, setReviewVendorId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  // Add vendor dialog
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState('');
  const [weddingVendors, setWeddingVendors] = useState<Array<{ id: string; name: string; category: string; vendor_listing_id: string | null }>>([]);

  useEffect(() => {
    if (!user || !dataOrFilter) return;
    loadPortfolio();
  }, [user, dataOrFilter]);

  const loadPortfolio = async () => {
    // Load existing portfolio
    const { data: portfolios } = await supabase
      .from('wedding_portfolios')
      .select('*')
      .or(dataOrFilter!);

    if (portfolios && portfolios.length > 0) {
      const p = portfolios[0] as Portfolio;
      setPortfolio(p);
      setTitle(p.title);
      setWeddingDate(p.wedding_date || '');
      setLocation(p.wedding_location || '');
      setGuestCount(p.guest_count);
      setStyleTags(p.style_tags || []);
      setDescription(p.description || '');
      setIsPublished(p.is_published);

      const [vRes, rRes] = await Promise.all([
        supabase.from('portfolio_vendors').select('*').eq('portfolio_id', p.id),
        supabase.from('vendor_reviews').select('*').eq('portfolio_id', p.id),
      ]);
      setVendors((vRes.data || []) as PortfolioVendor[]);
      setReviews((rRes.data || []) as Review[]);
    }

    // Load wedding vendors for quick-add
    const { data: wv } = await supabase
      .from('vendors')
      .select('id, name, category, vendor_listing_id')
      .or(dataOrFilter!);
    setWeddingVendors((wv || []) as any);

    setLoading(false);
  };

  const createPortfolio = async () => {
    if (!user) return;
    const coupleName = selectedClient
      ? `${selectedClient.client_name}${selectedClient.partner_name ? ' & ' + selectedClient.partner_name : ''}`
      : `${profile?.full_name || ''}${profile?.partner_name ? ' & ' + profile.partner_name : ''}`;

    const wDate = selectedClient?.wedding_date || profile?.wedding_date || null;
    const wLoc = selectedClient?.wedding_location || profile?.wedding_location || null;

    // Get guest count
    const { count } = await supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .or(dataOrFilter!);

    const { data, error } = await supabase.from('wedding_portfolios').insert({
      user_id: user.id,
      client_id: selectedClient?.id || null,
      title: coupleName || 'Our Wedding',
      wedding_date: wDate,
      wedding_location: wLoc,
      guest_count: count || 0,
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    const p = data as Portfolio;

    // Auto-add wedding vendors
    if (weddingVendors.length > 0) {
      const vendorInserts = weddingVendors.map(v => ({
        portfolio_id: p.id,
        vendor_name: v.name,
        vendor_category: v.category,
        vendor_listing_id: v.vendor_listing_id,
      }));
      await supabase.from('portfolio_vendors').insert(vendorInserts);
    }

    toast({ title: 'Portfolio created!', description: 'Your wedding story has been generated from your workspace data.' });
    await loadPortfolio();
  };

  const savePortfolio = async () => {
    if (!portfolio) return;
    setSaving(true);
    const { error } = await supabase.from('wedding_portfolios').update({
      title, wedding_date: weddingDate || null, wedding_location: location || null,
      guest_count: guestCount, style_tags: styleTags, description: description || null,
      is_published: isPublished,
    }).eq('id', portfolio.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved!' });
      setPortfolio({ ...portfolio, title, wedding_date: weddingDate || null, wedding_location: location || null, guest_count: guestCount, style_tags: styleTags, description: description || null, is_published: isPublished });
    }
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !styleTags.includes(t)) setStyleTags([...styleTags, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setStyleTags(styleTags.filter(t => t !== tag));

  const addVendorToPortfolio = async () => {
    if (!portfolio || !newVendorName || !newVendorCategory) return;
    const { error } = await supabase.from('portfolio_vendors').insert({
      portfolio_id: portfolio.id,
      vendor_name: newVendorName,
      vendor_category: newVendorCategory,
    });
    if (!error) {
      setAddVendorOpen(false);
      setNewVendorName('');
      setNewVendorCategory('');
      const { data } = await supabase.from('portfolio_vendors').select('*').eq('portfolio_id', portfolio.id);
      setVendors((data || []) as PortfolioVendor[]);
    }
  };

  const removeVendor = async (id: string) => {
    await supabase.from('portfolio_vendors').delete().eq('id', id);
    setVendors(vendors.filter(v => v.id !== id));
  };

  const submitReview = async () => {
    if (!portfolio || !user || !reviewVendorId) return;
    const { error } = await supabase.from('vendor_reviews').insert({
      reviewer_user_id: user.id,
      vendor_listing_id: reviewVendorId,
      portfolio_id: portfolio.id,
      rating: reviewRating,
      review_text: reviewText || null,
      reviewer_name: profile?.full_name || null,
      reviewer_role: profile?.role || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Review submitted!' });
      setReviewDialogOpen(false);
      setReviewText('');
      setReviewRating(5);
      const { data } = await supabase.from('vendor_reviews').select('*').eq('portfolio_id', portfolio.id);
      setReviews((data || []) as Review[]);
    }
  };

  const deleteReview = async (id: string) => {
    await supabase.from('vendor_reviews').delete().eq('id', id);
    setReviews(reviews.filter(r => r.id !== id));
  };

  const copyShareLink = () => {
    if (!portfolio) return;
    const url = `${window.location.origin}/wedding/${portfolio.share_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!' });
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!portfolio) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Wedding Portfolio</h1>
          <p className="mt-1 text-muted-foreground">Create a beautiful wedding story page from your workspace data.</p>
        </div>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <Heart className="h-12 w-12 text-primary" />
            <p className="text-center text-muted-foreground max-w-sm">
              Generate your wedding story automatically from your timeline, vendors, and guest data. Share it publicly or keep it private.
            </p>
            <Button onClick={createPortfolio} className="gap-2">
              <Plus className="h-4 w-4" /> Create Wedding Portfolio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reviewableVendors = vendors.filter(v => v.vendor_listing_id && !reviews.find(r => r.vendor_listing_id === v.vendor_listing_id));
  const shareUrl = `${window.location.origin}/wedding/${portfolio.share_token}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Wedding Portfolio</h1>
          <p className="mt-1 text-muted-foreground">Your wedding story page</p>
        </div>
        <div className="flex items-center gap-2">
          {isPublished && (
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </a>
          )}
          <Button onClick={copyShareLink} variant="outline" size="sm" className="gap-1.5">
            <Copy className="h-4 w-4" /> Copy Link
          </Button>
          <Button onClick={savePortfolio} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Wedding Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Grace & Daniel" />
            </div>
            <div className="space-y-1.5">
              <Label>Wedding Date</Label>
              <Input type="date" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Karen, Nairobi" />
            </div>
            <div className="space-y-1.5">
              <Label>Guest Count</Label>
              <Input type="number" value={guestCount} onChange={e => setGuestCount(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="A beautiful garden wedding..." rows={3} />
          </div>

          {/* Style Tags */}
          <div className="space-y-1.5">
            <Label>Style Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {styleTags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(tagInput))}
                placeholder="Add a tag..." className="max-w-xs" />
              <Button variant="outline" size="sm" onClick={() => addTag(tagInput)}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {STYLE_SUGGESTIONS.filter(s => !styleTags.includes(s)).map(s => (
                <button key={s} onClick={() => addTag(s)}
                  className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors">
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Publish Portfolio</Label>
              <p className="text-xs text-muted-foreground">Make it visible to anyone with the link</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </CardContent>
      </Card>

      {/* Vendor Credits */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Wedding Team</CardTitle>
          <Dialog open={addVendorOpen} onOpenChange={setAddVendorOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Vendor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Vendor Credit</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Vendor Name</Label>
                  <Input value={newVendorName} onChange={e => setNewVendorName(e.target.value)} placeholder="Mwaniki Studios" />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input value={newVendorCategory} onChange={e => setNewVendorCategory(e.target.value)} placeholder="Photography" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addVendorToPortfolio} disabled={!newVendorName || !newVendorCategory}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No vendors added yet.</p>
          ) : (
            <div className="space-y-2">
              {vendors.map(v => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium text-card-foreground text-sm">{v.vendor_name}</p>
                    <Badge variant="outline" className="text-xs mt-0.5">{v.vendor_category}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeVendor(v.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Reviews</CardTitle>
          {reviewableVendors.length > 0 && (
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5"><Star className="h-4 w-4" /> Write Review</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Review a Vendor</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Vendor</Label>
                    <Select value={reviewVendorId} onValueChange={setReviewVendorId}>
                      <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      <SelectContent>
                        {reviewableVendors.map(v => (
                          <SelectItem key={v.vendor_listing_id!} value={v.vendor_listing_id!}>{v.vendor_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rating</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => setReviewRating(s)}>
                          <Star className={`h-6 w-6 transition-colors ${s <= reviewRating ? 'text-accent fill-accent' : 'text-muted-foreground/30'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Review (optional)</Label>
                    <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="How was your experience?" rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitReview} disabled={!reviewVendorId}>Submit Review</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No reviews yet. Review vendors who participated in this wedding.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => {
                const vendor = vendors.find(v => v.vendor_listing_id === r.vendor_listing_id);
                return (
                  <div key={r.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-card-foreground text-sm">{vendor?.vendor_name || 'Vendor'}</p>
                        <div className="flex gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? 'text-accent fill-accent' : 'text-muted-foreground/30'}`} />
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteReview(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {r.review_text && <p className="mt-2 text-sm text-muted-foreground">{r.review_text}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
