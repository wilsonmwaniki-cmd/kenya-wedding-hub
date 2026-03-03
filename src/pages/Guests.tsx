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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Users, Upload, Download, Mail, Send, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeGuest, setComposeGuest] = useState<Guest | null>(null); // null = bulk mode
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rsvp, setRsvp] = useState('pending');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compose state (Mail Mellow patterns)
  const [composeSubject, setComposeSubject] = useState('');
  const [contentText, setContentText] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [composeMode, setComposeMode] = useState<'text' | 'html'>('text');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });

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

  const coupleName = profile?.full_name && profile?.partner_name
    ? `${profile.full_name} & ${profile.partner_name}`
    : profile?.full_name || '';

  const openCompose = (guest?: Guest) => {
    setComposeGuest(guest || null);
    setComposeSubject('');
    setContentText('');
    setContentHtml('');
    setComposeMode('text');
    setShowPreview(false);
    setProgress({ sent: 0, failed: 0, total: 0 });
    setComposeOpen(true);
  };

  const sendInviteToGuest = async (guest: Guest) => {
    const { data, error } = await supabase.functions.invoke('send-guest-invite', {
      body: {
        guestName: guest.name,
        guestEmail: guest.email,
        coupleName: coupleName || undefined,
        weddingDate: profile?.wedding_date,
        weddingLocation: profile?.wedding_location,
        subject: composeSubject.trim() || undefined,
        contentText: contentText.trim() || undefined,
        contentHtml: composeMode === 'html' && contentHtml.trim() ? contentHtml : undefined,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSend = async () => {
    setSending(true);
    const targets = composeGuest
      ? [composeGuest]
      : guests.filter(g => g.email && g.rsvp_status === 'pending');

    setProgress({ sent: 0, failed: 0, total: targets.length });

    let sent = 0;
    let failed = 0;

    for (const guest of targets) {
      try {
        await sendInviteToGuest(guest);
        sent++;
      } catch {
        failed++;
      }
      setProgress({ sent, failed, total: targets.length });
    }

    setSending(false);
    toast({
      title: sent > 0 ? 'Invites sent!' : 'Send failed',
      description: `Sent: ${sent}, Failed: ${failed}${targets.length > 1 ? ` of ${targets.length}` : ''}`,
      variant: failed === targets.length ? 'destructive' : undefined,
    });

    if (sent > 0) setComposeOpen(false);
  };

  const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
  const pendingWithEmail = guests.filter(g => g.email && g.rsvp_status === 'pending');

  if (isPlanner && !selectedClient) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Guest List</h1>
          <p className="text-muted-foreground">{guests.length} guests · {confirmed} confirmed</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          {pendingWithEmail.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => openCompose()} className="gap-2">
              <Send className="h-4 w-4" /> Invite All ({pendingWithEmail.length})
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

      {/* Compose Invite Dialog — Mail Mellow style */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {composeGuest ? `Send Invite to ${composeGuest.name}` : `Compose Bulk Invite (${pendingWithEmail.length} guests)`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject Line (optional)</Label>
              <Input
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder={`You're Invited${coupleName ? ` — ${coupleName}'s Wedding` : ' to Our Wedding'}!`}
              />
              <p className="text-xs text-muted-foreground">Leave blank to use the default wedding invite subject.</p>
            </div>

            {/* Message format — text/html toggle */}
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <Label>Message Format</Label>
                <Tabs value={composeMode} onValueChange={(v) => setComposeMode(v as 'text' | 'html')}>
                  <TabsList>
                    <TabsTrigger value="text">Text</TabsTrigger>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {composeMode === 'text' ? 'Personal message (added to the default template)' : 'Plain text fallback'}
                </Label>
                <Textarea
                  value={contentText}
                  onChange={e => setContentText(e.target.value)}
                  placeholder="We'd love for you to join us on our special day..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <AnimatePresence>
                {composeMode === 'html' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label className="text-xs text-muted-foreground">Custom HTML (replaces default template)</Label>
                    <Textarea
                      value={contentHtml}
                      onChange={e => setContentHtml(e.target.value)}
                      placeholder="<h1>You're Invited!</h1><p>We would love for you to celebrate with us...</p>"
                      rows={6}
                      className="resize-none font-mono text-xs"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? 'Hide Preview' : 'Preview'}
              </Button>
            </div>

            <AnimatePresence>
              {showPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl border border-border p-5"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Email Preview</p>
                  <h3 className="text-lg font-semibold text-foreground">
                    {composeSubject || `You're Invited${coupleName ? ` — ${coupleName}'s Wedding` : ' to Our Wedding'}!`}
                  </h3>
                  <div className="mt-3 border-t border-border pt-4">
                    {composeMode === 'html' && contentHtml.trim() ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                    ) : (
                      <div className="space-y-3 text-sm text-foreground">
                        <p>Dear <strong>{composeGuest?.name || '{Guest Name}'}</strong>,</p>
                        <p>We are delighted to invite you to celebrate our wedding{coupleName ? ` — ${coupleName}` : ''}.</p>
                        {profile?.wedding_date && <p>📅 <strong>Date:</strong> {new Date(profile.wedding_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>}
                        {profile?.wedding_location && <p>📍 <strong>Venue:</strong> {profile.wedding_location}</p>}
                        {contentText && (
                          <p className="border-l-2 border-primary pl-3 italic text-muted-foreground">{contentText}</p>
                        )}
                        <p>We would be honoured to have you join us on our special day.</p>
                        <p>With love and warm regards ❤️</p>
                      </div>
                    )}
                  </div>
                  {!composeGuest && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Sending to: {pendingWithEmail.length} pending guests with email addresses
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress bar during sending */}
            {sending && progress.total > 1 && (
              <div className="space-y-2">
                <Progress value={((progress.sent + progress.failed) / progress.total) * 100} />
                <p className="text-xs text-muted-foreground text-center">
                  Sending {progress.sent + progress.failed}/{progress.total}... ({progress.sent} sent, {progress.failed} failed)
                </p>
              </div>
            )}

            <Button
              className="w-full gap-2"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending {progress.sent}/{progress.total}...</>
              ) : (
                <><Send className="h-4 w-4" /> {composeGuest ? 'Send Invitation' : `Send to ${pendingWithEmail.length} Guests`}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guest list */}
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCompose(g)} title="Send invite">
                  <Mail className="h-4 w-4" />
                </Button>
              )}
              <Select value={g.rsvp_status || 'pending'} onValueChange={(v) => updateRsvp(g.id, v)}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
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
