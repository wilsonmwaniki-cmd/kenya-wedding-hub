import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Phone, Mail, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  price: number | null;
  status: string | null;
  notes: string | null;
}

const vendorCategories = ['Venue', 'Catering', 'Photography', 'Videography', 'Flowers', 'Music/DJ', 'Décor', 'Transport', 'MC', 'Cake', 'Other'];

const statusColors: Record<string, string> = {
  contacted: 'bg-warning/10 text-warning border-warning/20',
  booked: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function Vendors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Venue', phone: '', price: '' });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('vendors').select('*').eq('user_id', user.id).order('created_at');
    if (data) setVendors(data.map(d => ({ ...d, price: d.price ? Number(d.price) : null })));
  };

  useEffect(() => { load(); }, [user]);

  const addVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('vendors').insert({
      user_id: user.id, name: form.name, category: form.category,
      phone: form.phone || null, price: form.price ? parseFloat(form.price) : null, status: 'contacted',
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setForm({ name: '', category: 'Venue', phone: '', price: '' }); setOpen(false); load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('vendors').update({ status }).eq('id', id);
    load();
  };

  const deleteVendor = async (id: string) => {
    await supabase.from('vendors').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground">{vendors.length} vendors tracked</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Vendor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add Vendor</DialogTitle></DialogHeader>
            <form onSubmit={addVendor} className="space-y-4">
              <div className="space-y-2">
                <Label>Vendor Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Business name" required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vendorCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254..." />
              </div>
              <div className="space-y-2">
                <Label>Price (KES, optional)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
              </div>
              <Button type="submit" className="w-full">Add Vendor</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {vendors.map(v => (
          <Card key={v.id} className="shadow-card">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-base font-medium">{v.name}</CardTitle>
                <Badge variant="outline" className="mt-1 text-xs">{v.category}</Badge>
              </div>
              <button onClick={() => deleteVendor(v.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-2">
              {v.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3 w-3" />{v.phone}</p>}
              {v.price && <p className="text-sm font-medium text-card-foreground">KES {v.price.toLocaleString()}</p>}
              <Select value={v.status || 'contacted'} onValueChange={(s) => updateStatus(v.id, s)}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
        {vendors.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">No vendors yet. Start by adding your venue!</p>
        )}
      </div>
    </div>
  );
}
