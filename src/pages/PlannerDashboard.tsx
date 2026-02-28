import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner, PlannerClient } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Calendar, MapPin, ArrowRight, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function PlannerDashboard() {
  const { user } = useAuth();
  const { clients, loadClients, selectClient } = usePlanner();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_name: '', partner_name: '', wedding_date: '', wedding_location: '', email: '', phone: '',
  });

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('planner_clients').insert({
      planner_user_id: user.id,
      client_name: form.client_name,
      partner_name: form.partner_name || null,
      wedding_date: form.wedding_date || null,
      wedding_location: form.wedding_location || null,
      email: form.email || null,
      phone: form.phone || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setForm({ client_name: '', partner_name: '', wedding_date: '', wedding_location: '', email: '', phone: '' });
    setOpen(false);
    loadClients();
    toast({ title: 'Client added!' });
  };

  const deleteClient = async (id: string) => {
    await supabase.from('planner_clients').delete().eq('id', id);
    loadClients();
    toast({ title: 'Client removed' });
  };

  const openClientDashboard = (client: PlannerClient) => {
    selectClient(client);
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Clients</h1>
          <p className="text-muted-foreground">{clients.length} wedding{clients.length !== 1 ? 's' : ''} being managed</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Client</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-display">New Client</DialogTitle></DialogHeader>
            <form onSubmit={addClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. Jane Wanjiku" required />
                </div>
                <div className="space-y-2">
                  <Label>Partner Name</Label>
                  <Input value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} placeholder="e.g. John Kamau" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Wedding Date</Label>
                  <Input type="date" value={form.wedding_date} onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={form.wedding_location} onChange={e => setForm(f => ({ ...f, wedding_location: e.target.value }))} placeholder="Nairobi" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254..." />
                </div>
              </div>
              <Button type="submit" className="w-full">Add Client</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((c, i) => {
          const weddingDate = c.wedding_date ? new Date(c.wedding_date) : null;
          const daysUntil = weddingDate ? Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000)) : null;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="shadow-card hover:shadow-warm transition-shadow cursor-pointer group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-display">
                      {c.client_name}{c.partner_name ? ` & ${c.partner_name}` : ''}
                    </CardTitle>
                    {c.wedding_location && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" /> {c.wedding_location}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteClient(c.id); }}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {weddingDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        {weddingDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {daysUntil !== null && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          {daysUntil === 0 ? 'Today!' : `${daysUntil}d`}
                        </Badge>
                      )}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => openClientDashboard(c)}
                  >
                    Open Dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {clients.length === 0 && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No clients yet. Add your first client to start managing their wedding!</p>
        </div>
      )}
    </div>
  );
}
