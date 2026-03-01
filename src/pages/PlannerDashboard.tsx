import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner, PlannerClient } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Calendar, MapPin, ArrowRight, Trash2, LinkIcon, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface LinkRequest {
  id: string;
  couple_user_id: string;
  status: string;
  created_at: string;
  couple_name?: string;
  couple_email?: string;
}

export default function PlannerDashboard() {
  const { user } = useAuth();
  const { clients, loadClients, selectClient } = usePlanner();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [form, setForm] = useState({
    client_name: '', partner_name: '', wedding_date: '', wedding_location: '', email: '', phone: '',
  });

  const loadLinkRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('planner_link_requests')
      .select('*')
      .eq('planner_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!data) return;

    // Fetch couple names
    const coupleIds = data.map(r => r.couple_user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', coupleIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
    setLinkRequests(data.map(r => ({
      ...r,
      couple_name: profileMap.get(r.couple_user_id) || 'Unknown',
    })));
  };

  useEffect(() => { if (user) loadLinkRequests(); }, [user]);

  const approveRequest = async (req: LinkRequest) => {
    // Create a planner_client record linked to the couple's user id
    if (!user) return;
    const { error: clientError } = await supabase.from('planner_clients').insert({
      planner_user_id: user.id,
      client_name: req.couple_name || 'Client',
      linked_user_id: req.couple_user_id,
    });
    if (clientError) {
      toast({ title: 'Error', description: clientError.message, variant: 'destructive' });
      return;
    }
    // Update request status
    await supabase.from('planner_link_requests').update({ status: 'approved' }).eq('id', req.id);
    toast({ title: 'Request approved!', description: `${req.couple_name} is now linked.` });
    loadLinkRequests();
    loadClients();
  };

  const rejectRequest = async (req: LinkRequest) => {
    await supabase.from('planner_link_requests').update({ status: 'rejected' }).eq('id', req.id);
    toast({ title: 'Request rejected' });
    loadLinkRequests();
  };

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
      {/* Pending Link Requests */}
      {linkRequests.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Pending Link Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex-1">
                  <p className="font-medium text-sm text-card-foreground">{req.couple_name}</p>
                  <p className="text-xs text-muted-foreground">Wants to link their wedding account</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => rejectRequest(req)} className="gap-1">
                  <XCircle className="h-3.5 w-3.5" /> Decline
                </Button>
                <Button size="sm" onClick={() => approveRequest(req)} className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                    <div className="flex items-center gap-2 mt-1">
                      {c.wedding_location && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {c.wedding_location}
                        </p>
                      )}
                      {c.linked_user_id && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <LinkIcon className="h-3 w-3" /> Linked
                        </Badge>
                      )}
                    </div>
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
