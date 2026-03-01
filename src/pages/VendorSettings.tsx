import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Clock, Store, X } from 'lucide-react';

const vendorCategories = ['Venue', 'Catering', 'Photography', 'Videography', 'Flowers', 'Music/DJ', 'Décor', 'Transport', 'MC', 'Cake', 'Other'];

interface VendorListing {
  id: string;
  business_name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  location: string;
  services: string[];
  is_approved: boolean;
  is_verified: boolean;
}

export default function VendorSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState<VendorListing | null>(null);
  const [form, setForm] = useState({
    business_name: '',
    category: 'Photography',
    description: '',
    phone: '',
    email: '',
    website: '',
    location: '',
    services: [] as string[],
  });
  const [newService, setNewService] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('vendor_listings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setListing(data as any);
        setForm({
          business_name: data.business_name || '',
          category: data.category || 'Photography',
          description: data.description || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          location: data.location || '',
          services: (data.services as string[]) || [],
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      business_name: form.business_name,
      category: form.category,
      description: form.description || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      location: form.location || null,
      services: form.services,
    };

    let error;
    if (listing) {
      ({ error } = await supabase.from('vendor_listings').update(payload).eq('id', listing.id));
    } else {
      ({ error } = await supabase.from('vendor_listings').insert(payload));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved!', description: listing ? 'Listing updated.' : 'Listing submitted for review.' });
      // Reload
      const { data } = await supabase.from('vendor_listings').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setListing(data as any);
    }
    setSaving(false);
  };

  const addService = () => {
    const s = newService.trim();
    if (s && !form.services.includes(s)) {
      setForm((f) => ({ ...f, services: [...f.services, s] }));
      setNewService('');
    }
  };

  const removeService = (s: string) => {
    setForm((f) => ({ ...f, services: f.services.filter((x) => x !== s) }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">My Vendor Listing</h1>
        <p className="text-muted-foreground">Manage your business listing on the vendor directory.</p>
      </div>

      {/* Status banner */}
      {listing && (
        <Card className={listing.is_approved ? 'border-primary/30 bg-primary/5' : 'border-yellow-500/30 bg-yellow-500/5'}>
          <CardContent className="flex items-center gap-3 py-4">
            {listing.is_approved ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Your listing is live {listing.is_verified && '& verified ✓'}
                  </p>
                  <p className="text-xs text-muted-foreground">Visible in the vendor directory.</p>
                </div>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">Pending Approval</p>
                  <p className="text-xs text-muted-foreground">Your listing is under review. You'll be notified once approved.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Business Details
          </CardTitle>
          <CardDescription>Fill in your business information. This will be shown in the public directory.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Business Name *</Label>
                <Input
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                  placeholder="Your business name"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vendorCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Tell couples and planners about your services…"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+254..." />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="business@example.com" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Nairobi, Kenya" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Services / Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="e.g. Outdoor Weddings"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
                />
                <Button type="button" variant="outline" onClick={addService}>Add</Button>
              </div>
              {form.services.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.services.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <button type="button" onClick={() => removeService(s)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {listing ? 'Update Listing' : 'Submit for Review'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
