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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Users, Upload, Download, Mail, Send, Loader2, Eye, EyeOff,
  Link2, Copy, UserCheck, BarChart3, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import GuestInsights from '@/components/guests/GuestInsights';
import GuestCheckIn from '@/components/guests/GuestCheckIn';

interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: string | null;
  meal_preference: string | null;
  plus_one: boolean | null;
  table_number: number | null;
  group_name: string | null;
  category: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  rsvp_token: string;
}

const GUEST_GROUPS = ['Bride Family', 'Groom Family', 'Friends', 'Work Colleagues', 'Committee', 'Church'];
const GUEST_CATEGORIES = ['general', 'vip', 'family', 'friends', 'kids', 'vendor'];

export default function Guests() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [guests, setGuests] = useState<Guest[]>([]);
  const [open, setOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeGuest, setComposeGuest] = useState<Guest | null>(null);
  const [checkInMode, setCheckInMode] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Add guest form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rsvp, setRsvp] = useState('pending');
  const [groupName, setGroupName] = useState('');
  const [category, setCategory] = useState('general');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compose state
  const [composeSubject, setComposeSubject] = useState('');
  const [contentText, setContentText] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [composeMode, setComposeMode] = useState<'text' | 'html'>('text');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!dataOrFilter) return;
    const { data } = await supabase.from('guests').select('*').or(dataOrFilter).order('name');
    if (data) setGuests(data as unknown as Guest[]);
  };

  useEffect(() => { load(); }, [user, selectedClient, dataOrFilter]);

  // File handling
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
      if (rows.length === 0) { toast({ title: 'Empty file', variant: 'destructive' }); return; }

      const guestRows = rows.map(row => {
        const insert: any = {
          user_id: user.id,
          name: String(row['Name'] || row['name'] || row['Full Name'] || row['full_name'] || '').trim(),
          email: String(row['Email'] || row['email'] || '').trim() || null,
          phone: String(row['Phone'] || row['phone'] || row['Phone Number'] || '').trim() || null,
          rsvp_status: String(row['RSVP'] || row['rsvp_status'] || row['Status'] || 'pending').toLowerCase().trim(),
          meal_preference: String(row['Meal'] || row['meal_preference'] || row['Meal Preference'] || '').trim() || null,
          plus_one: row['Plus One'] === true || row['plus_one'] === true || String(row['Plus One'] || row['plus_one'] || '').toLowerCase() === 'yes',
          group_name: String(row['Group'] || row['group_name'] || '').trim() || null,
          category: String(row['Category'] || row['category'] || 'general').toLowerCase().trim(),
        };
        if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
        return insert;
      }).filter(g => g.name);

      if (guestRows.length === 0) { toast({ title: 'No valid rows', variant: 'destructive' }); return; }
      const { error } = await supabase.from('guests').insert(guestRows);
      if (error) toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Success', description: `${guestRows.length} guests uploaded!` }); load(); }
    } catch (err: any) {
      toast({ title: 'File error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Guests');
    ws.addRow(['Name', 'Email', 'Phone', 'RSVP', 'Meal Preference', 'Plus One', 'Group', 'Category']);
    ws.addRow(['Jane Doe', 'jane@example.com', '+254700000000', 'pending', 'Vegetarian', 'No', 'Bride Family', 'family']);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'guest-list-template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const insert: any = {
      user_id: user.id, name, email: email || null, phone: phone || null,
      rsvp_status: rsvp, group_name: groupName || null, category,
    };
    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
    const { error } = await supabase.from('guests').insert(insert);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setName(''); setEmail(''); setPhone(''); setRsvp('pending'); setGroupName(''); setCategory('general');
    setOpen(false); load();
  };

  const updateRsvp = async (id: string, status: string) => {
    await supabase.from('guests').update({ rsvp_status: status }).eq('id', id);
    load();
  };

  const deleteGuest = async (id: string) => {
    await supabase.from('guests').delete().eq('id', id);
    load();
  };

  const copyRsvpLink = (guest: Guest) => {
    const url = `${window.location.origin}/rsvp/${guest.rsvp_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'RSVP link copied!', description: `Share this link with ${guest.name} via WhatsApp or SMS.` });
  };

  const coupleName = profile?.full_name && profile?.partner_name
    ? `${profile.full_name} & ${profile.partner_name}` : profile?.full_name || '';

  const openCompose = (guest?: Guest) => {
    setComposeGuest(guest || null);
    setComposeSubject(''); setContentText(''); setContentHtml('');
    setComposeMode('text'); setShowPreview(false);
    setProgress({ sent: 0, failed: 0, total: 0 }); setComposeOpen(true);
  };

  const sendInviteToGuest = async (guest: Guest) => {
    const { data, error } = await supabase.functions.invoke('send-guest-invite', {
      body: {
        guestName: guest.name, guestEmail: guest.email,
        coupleName: coupleName || undefined,
        weddingDate: profile?.wedding_date, weddingLocation: profile?.wedding_location,
        subject: composeSubject.trim() || undefined,
        contentText: contentText.trim() || undefined,
        contentHtml: composeMode === 'html' && contentHtml.trim() ? contentHtml : undefined,
        rsvpLink: `${window.location.origin}/rsvp/${guest.rsvp_token}`,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  const handleSend = async () => {
    setSending(true);
    const targets = composeGuest
      ? [composeGuest]
      : guests.filter(g => g.email && g.rsvp_status === 'pending');
    setProgress({ sent: 0, failed: 0, total: targets.length });
    let sent = 0, failed = 0;
    for (const guest of targets) {
      try { await sendInviteToGuest(guest); sent++; } catch { failed++; }
      setProgress({ sent, failed, total: targets.length });
    }
    setSending(false);
    toast({
      title: sent > 0 ? 'Invites sent!' : 'Send failed',
      description: `Sent: ${sent}, Failed: ${failed}`,
      variant: failed === targets.length ? 'destructive' : undefined,
    });
    if (sent > 0) setComposeOpen(false);
  };

  const pendingWithEmail = guests.filter(g => g.email && g.rsvp_status === 'pending');

  // Filtered guests
  const visibleGuests = guests.filter(g => {
    const matchesSearch = !searchTerm || g.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = filterGroup === 'all' || g.group_name === filterGroup;
    return matchesSearch && matchesGroup;
  });

  const uniqueGroups = [...new Set(guests.map(g => g.group_name).filter(Boolean))] as string[];

  if (isPlanner && !selectedClient) return null;
  if (checkInMode) return <GuestCheckIn guests={guests as any} onClose={() => setCheckInMode(false)} onUpdate={load} />;

  const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          <Button variant="outline" size="sm" onClick={() => setCheckInMode(true)} className="gap-2">
            <UserCheck className="h-4 w-4" /> Check-In
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label>Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Guest name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guest@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Group</Label>
                    <Select value={groupName} onValueChange={setGroupName}>
                      <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                      <SelectContent>
                        {GUEST_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GUEST_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
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
                </div>
                <Button type="submit" className="w-full">Add Guest</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs: List / Insights */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Guest List</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4">
          <GuestInsights guests={guests as any} />
        </TabsContent>

        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Search & filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search guests..."
                className="pl-10"
              />
            </div>
            {uniqueGroups.length > 0 && (
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All groups" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {uniqueGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Guest cards */}
          <div className="space-y-2">
            {visibleGuests.map(g => (
              <Card key={g.id} className="shadow-card">
                <CardContent className="flex items-center gap-3 py-3">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-card-foreground truncate">{g.name}</p>
                      {g.category && g.category !== 'general' && (
                        <Badge variant="secondary" className="text-[10px] capitalize h-5">{g.category}</Badge>
                      )}
                      {g.group_name && (
                        <Badge variant="outline" className="text-[10px] h-5">{g.group_name}</Badge>
                      )}
                    </div>
                    {g.email && <p className="text-xs text-muted-foreground">{g.email}</p>}
                    {g.phone && !g.email && <p className="text-xs text-muted-foreground">{g.phone}</p>}
                  </div>
                  {/* RSVP link copy */}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyRsvpLink(g)} title="Copy RSVP link">
                    <Link2 className="h-4 w-4" />
                  </Button>
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
            {visibleGuests.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                {searchTerm || filterGroup !== 'all' ? 'No guests match your filter.' : 'No guests added yet. Start building your guest list!'}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Compose Invite Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {composeGuest ? `Send Invite to ${composeGuest.name}` : `Compose Bulk Invite (${pendingWithEmail.length} guests)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Subject Line (optional)</Label>
              <Input
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder={`You're Invited${coupleName ? ` — ${coupleName}'s Wedding` : ' to Our Wedding'}!`}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <Label>Message Format</Label>
                <Tabs value={composeMode} onValueChange={(v) => setComposeMode(v as 'text' | 'html')}>
                  <TabsList><TabsTrigger value="text">Text</TabsTrigger><TabsTrigger value="html">HTML</TabsTrigger></TabsList>
                </Tabs>
              </div>
              <Textarea
                value={contentText}
                onChange={e => setContentText(e.target.value)}
                placeholder="We'd love for you to join us..."
                rows={4} className="resize-none"
              />
              <AnimatePresence>
                {composeMode === 'html' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                    <Label className="text-xs text-muted-foreground">Custom HTML</Label>
                    <Textarea value={contentHtml} onChange={e => setContentHtml(e.target.value)} placeholder="<h1>You're Invited!</h1>" rows={6} className="resize-none font-mono text-xs" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-2">
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? 'Hide Preview' : 'Preview'}
            </Button>
            <AnimatePresence>
              {showPreview && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-xl border border-border p-5">
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
                        {contentText && <p className="border-l-2 border-primary pl-3 italic text-muted-foreground">{contentText}</p>}
                        <p>We would be honoured to have you join us.</p>
                        <p className="text-xs text-muted-foreground mt-4">📩 Each invite includes a personal RSVP link.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {sending && progress.total > 1 && (
              <div className="space-y-2">
                <Progress value={((progress.sent + progress.failed) / progress.total) * 100} />
                <p className="text-xs text-muted-foreground text-center">
                  Sending {progress.sent + progress.failed}/{progress.total}...
                </p>
              </div>
            )}
            <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending {progress.sent}/{progress.total}...</> : <><Send className="h-4 w-4" /> {composeGuest ? 'Send Invitation' : `Send to ${pendingWithEmail.length} Guests`}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
