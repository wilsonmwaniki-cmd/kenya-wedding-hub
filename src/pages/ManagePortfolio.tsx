import { useEffect, useMemo, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Copy, Star, Loader2, Eye, X } from 'lucide-react';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { useDeferredDelete } from '@/hooks/useDeferredDelete';

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
  const { pendingIds: pendingDeleteIds, scheduleDelete } = useDeferredDelete();
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

  const removeVendor = (id: string) => {
    const vendor = vendors.find((item) => item.id === id);
    if (!vendor) return;
    scheduleDelete({
      id,
      title: 'Portfolio vendor removed',
      description: `${vendor.vendor_name} was removed from this portfolio.`,
      commit: async () => {
        const { error } = await supabase.from('portfolio_vendors').delete().eq('id', id);
        if (error) throw error;
      },
      onCommit: () => setVendors((current) => current.filter((item) => item.id !== id)),
    });
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

  const deleteReview = (id: string) => {
    const review = reviews.find((item) => item.id === id);
    if (!review) return;
    scheduleDelete({
      id,
      title: 'Review removed',
      description: 'The vendor review was removed from this portfolio.',
      commit: async () => {
        const { error } = await supabase.from('vendor_reviews').delete().eq('id', id);
        if (error) throw error;
      },
      onCommit: () => setReviews((current) => current.filter((item) => item.id !== id)),
    });
  };

  const copyShareLink = () => {
    if (!portfolio) return;
    const url = `${window.location.origin}/wedding/${portfolio.share_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!' });
  };

  const reviewableVendors = useMemo(
    () => vendors.filter(v => v.vendor_listing_id && !reviews.find(r => r.vendor_listing_id === v.vendor_listing_id)),
    [reviews, vendors],
  );

  if (loading) {
    return <WorkspacePageSkeleton compact />;
  }

  if (!portfolio) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="workspace-h1">Wedding story</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Create a page you can prepare before publishing.
          </p>
        </div>
        <Card className="border-dashed border-border/70 shadow-card">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div>
              <p className="text-lg font-semibold text-foreground">No wedding story yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Uses your wedding details and vendors. It stays private until you publish.</p>
            </div>
            <Button onClick={createPortfolio} className="gap-2">
              <Plus className="h-4 w-4" /> Create wedding story
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  const shareUrl = `${window.location.origin}/wedding/${portfolio.share_token}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="workspace-h1">{title || 'Wedding story'}</h1>
            <Badge variant={isPublished ? 'success' : 'outline'}>{isPublished ? 'Published' : 'Draft'}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPublished ? 'Anyone with the link can view this story.' : 'Only you can view this draft.'}
          </p>
        </div>
        {isPublished ? (
          <div className="flex flex-wrap gap-2">
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-1.5"><Eye className="h-4 w-4" /> Preview</Button>
            </a>
            <Button onClick={copyShareLink} variant="outline" className="gap-1.5"><Copy className="h-4 w-4" /> Copy link</Button>
          </div>
        ) : null}
      </div>

      {/* Basic Info */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">Story</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Grace & Daniel" />
          </div>
          <div className="space-y-1.5">
            <Label>Your story</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell guests about your wedding" rows={4} />
          </div>
          <details className="rounded-2xl border border-border/70 p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground">More details</summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Wedding date</Label>
                  <Input type="date" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Karen, Nairobi" />
                </div>
                <div className="space-y-1.5">
                  <Label>Guest count</Label>
                  <Input type="number" value={guestCount} onChange={e => setGuestCount(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Style</Label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {styleTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(tagInput))}
                    placeholder="Add a style" className="max-w-xs" />
                  <Button type="button" variant="outline" size="sm" onClick={() => addTag(tagInput)}>Add</Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {STYLE_SUGGESTIONS.filter(s => !styleTags.includes(s)).map(s => (
                    <button type="button" key={s} onClick={() => addTag(s)}
                      className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary">
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>
          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div>
              <Label className="text-base">Publish story</Label>
              <p className="text-xs text-muted-foreground">Anyone with the link can view it.</p>
            </div>
            <Switch aria-label="Publish story" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
          <Button onClick={savePortfolio} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {isPublished ? 'Save and publish' : 'Save draft'}
          </Button>
        </CardContent>
      </Card>

      <details className="rounded-[1.6rem] border border-border/70 bg-card shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-lg font-semibold text-foreground">Vendor credits and reviews</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>{vendors.length} vendors</span>
            <span>{reviews.length} reviews</span>
          </div>
        </summary>

        <div className="space-y-6 px-6 pb-6">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Wedding Team</CardTitle>
              <Dialog open={addVendorOpen} onOpenChange={setAddVendorOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add credit</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add vendor credit</DialogTitle>
                    <DialogDescription>Credit someone who helped create the wedding.</DialogDescription>
                  </DialogHeader>
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
                    <Button onClick={addVendorToPortfolio} disabled={!newVendorName || !newVendorCategory}>Add credit</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">No vendor credits yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vendors.filter((vendor) => !pendingDeleteIds.has(vendor.id)).map(v => (
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

          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Reviews</CardTitle>
              {reviewableVendors.length > 0 && (
                <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5"><Star className="h-4 w-4" /> Add review</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Review vendor</DialogTitle>
                      <DialogDescription>Share your experience with this vendor.</DialogDescription>
                    </DialogHeader>
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
                      <Button onClick={submitReview} disabled={!reviewVendorId}>Add review</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">No reviews yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.filter((review) => !pendingDeleteIds.has(review.id)).map(r => {
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
      </details>
    </div>
  );
}
