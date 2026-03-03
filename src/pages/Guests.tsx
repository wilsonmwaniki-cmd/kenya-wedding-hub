import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Users, Upload, Download, Mail, Send, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: string | null;
  meal_preference: string | null;
  plus_one: boolean | null;
  table_number: number | null;
}

export default function Guests() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteGuest, setInviteGuest] = useState<Guest | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rsvp, setRsvp] = useState('pending');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const sheet = workbook.worksheets[0];
      if (!sheet) { toast({ title: 'Empty file', description: 'No worksheets found.', variant: 'destructive' }); return; }
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNumber) => { headers[colNumber - 1] = String(cell.value || ''); });
      const rows: Record<string, any>[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj: Record<string, any> = {};
        row.eachCell((cell, colNumber) => { obj[headers[colNumber - 1]] = cell.value; });
        rows.push(obj);
      });

      if (rows.length === 0) {
        toast({ title: 'Empty file', description: 'No rows found in the spreadsheet.', variant: 'destructive' });
        return;
      }

      const guestRows = rows.map(row => {
        const insert: any = {
          user_id: user.id,
          name: String(row['Name'] || row['name'] || row['Full Name'] || row['full_name'] || '').trim(),
          email: String(row['Email'] || row['email'] || '').trim() || null,
          phone: String(row['Phone'] || row['phone'] || row['Phone Number'] || '').trim() || null,
          rsvp_status: String(row['RSVP'] || row['rsvp_status'] || row['Status'] || 'pending').toLowerCase().trim(),
          meal_preference: String(row['Meal'] || row['meal_preference'] || row['Meal Preference'] || '').trim() || null,
          plus_one: row['Plus One'] === true || row['plus_one'] === true || String(row['Plus One'] || row['plus_one'] || '').toLowerCase() === 'yes',
        };
        if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
        return insert;
      }).filter(g => g.name);

      if (guestRows.length === 0) {
        toast({ title: 'No valid rows', description: 'Could not find a "Name" column.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('guests').insert(guestRows);
      if (error) {
        toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: `${guestRows.length} guests uploaded successfully!` });
        load();
      }
    } catch (err: any) {
      toast({ title: 'File error', description: err.message || 'Could not read file', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Guests');
    ws.addRow(['Name', 'Email', 'Phone', 'RSVP', 'Meal Preference', 'Plus One']);
    ws.addRow(['Jane Doe', 'jane@example.com', '+254700000000', 'pending', 'Vegetarian', 'No']);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'guest-list-template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!dataOrFilter) return;
    const { data } = await supabase.from('guests').select('*').or(dataOrFilter).order('name');
    if (data) setGuests(data as Guest[]);
  };

  useEffect(() => { load(); }, [user, selectedClient, dataOrFilter]);

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const insert: any = { user_id: user.id, name, email: email || null, phone: phone || null, rsvp_status: rsvp };
    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
    const { error } = await supabase.from('guests').insert(insert);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setName(''); setEmail(''); setPhone(''); setRsvp('pending'); setOpen(false); load();
  };

  const updateRsvp = async (id: string, status: string) => {
    await supabase.from('guests').update({ rsvp_status: status }).eq('id', id);
    load();
  };

  const deleteGuest = async (id: string) => {
    await supabase.from('guests').delete().eq('id', id);
    load();
  };

  const sendInvite = async (guest: Guest, message?: string) => {
    setSendingInvite(true);
    try {
      const coupleName = profile?.full_name && profile?.partner_name
        ? `${profile.full_name} & ${profile.partner_name}`
        : profile?.full_name || undefined;

      const { data, error } = await supabase.functions.invoke('send-guest-invite', {
        body: {
          guestName: guest.name,
          guestEmail: guest.email,
          coupleName,
          weddingDate: profile?.wedding_date,
          weddingLocation: profile?.wedding_location,
          message: message || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Invite sent!', description: `Invitation sent to ${guest.email}` });
      setInviteOpen(false);
      setInviteMessage('');
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message || 'Could not send invite', variant: 'destructive' });
    } finally {
      setSendingInvite(false);
    }
  };

  const sendBulkInvites = async () => {
    const guestsWithEmail = guests.filter(g => g.email && g.rsvp_status === 'pending');
    if (guestsWithEmail.length === 0) {
      toast({ title: 'No guests to invite', description: 'No pending guests with email addresses found.', variant: 'destructive' });
      return;
    }
    setSendingBulk(true);
    let sent = 0;
    let failed = 0;
    for (const guest of guestsWithEmail) {
      try {
        const coupleName = profile?.full_name && profile?.partner_name
          ? `${profile.full_name} & ${profile.partner_name}`
          : profile?.full_name || undefined;

        const { data, error } = await supabase.functions.invoke('send-guest-invite', {
          body: {
            guestName: guest.name,
            guestEmail: guest.email,
            coupleName,
            weddingDate: profile?.wedding_date,
            weddingLocation: profile?.wedding_location,
          },
        });
        if (error || data?.error) { failed++; } else { sent++; }
      } catch { failed++; }
    }
    setSendingBulk(false);
    toast({
      title: 'Bulk invites complete',
      description: `${sent} sent, ${failed} failed out of ${guestsWithEmail.length} guests.`,
    });
  };

  const openInviteDialog = (guest: Guest) => {
    setInviteGuest(guest);
    setInviteMessage('');
    setInviteOpen(true);
  };

  const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
  const pendingWithEmail = guests.filter(g => g.email && g.rsvp_status === 'pending').length;

  if (isPlanner && !selectedClient) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Guest List</h1>
          <p className="text-muted-foreground">{guests.length} guests · {confirmed} confirmed</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          {pendingWithEmail > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={sendBulkInvites}
              disabled={sendingBulk}
              className="gap-2"
            >
              {sendingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendingBulk ? 'Sending...' : `Invite All (${pendingWithEmail})`}
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Guest</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Add Guest</DialogTitle></DialogHeader>
              <form onSubmit={addGuest} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Guest name" required />
                </div>
                <div className="space-y-2">
                  <Label>Email (for invites)</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guest@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254..." />
                </div>
                <div className="space-y-2">
                  <Label>RSVP Status</Label>
                  <Select value={rsvp} onValueChange={setRsvp}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Add Guest</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Send Invite to {inviteGuest?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An invitation email will be sent to <strong>{inviteGuest?.email}</strong> with your wedding details.
            </p>
            <div className="space-y-2">
              <Label>Personal message (optional)</Label>
              <Textarea
                value={inviteMessage}
                onChange={e => setInviteMessage(e.target.value)}
                placeholder="We'd love for you to join us on our special day..."
                rows={3}
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => inviteGuest && sendInvite(inviteGuest, inviteMessage)}
              disabled={sendingInvite}
            >
              {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendingInvite ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {guests.map(g => (
          <Card key={g.id} className="shadow-card">
            <CardContent className="flex items-center gap-3 py-3">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-card-foreground truncate">{g.name}</p>
                {g.email && <p className="text-xs text-muted-foreground">{g.email}</p>}
                {g.phone && !g.email && <p className="text-xs text-muted-foreground">{g.phone}</p>}
              </div>
              {g.email && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openInviteDialog(g)}
                  title="Send invite"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              )}
              <Select value={g.rsvp_status || 'pending'} onValueChange={(v) => updateRsvp(g.id, v)}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={() => deleteGuest(g.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
        {guests.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No guests added yet. Start building your guest list!</p>
        )}
      </div>
    </div>
  );
}
