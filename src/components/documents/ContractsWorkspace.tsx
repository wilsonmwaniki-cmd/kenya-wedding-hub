import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CalendarDays, FilePlus2, Loader2, Save, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createProfessionalContract,
  deleteProfessionalContract,
  listProfessionalContracts,
  professionalContractStatusLabel,
  professionalContractStatusOptions,
  updateProfessionalContract,
  type CommercialDocumentRole,
  type PlannerClientOption,
  type ProfessionalContractRecord,
  type ProfessionalContractStatus,
  type VendorBookingOption,
  type VendorListingOption,
} from '@/lib/commercialDocuments';

type ContractDraft = {
  title: string;
  status: ProfessionalContractStatus;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  weddingName: string;
  clientId: string;
  vendorListingId: string;
  vendorId: string;
  eventDate: string;
  summary: string;
  terms: string;
  notes: string;
};

type Props = {
  role: CommercialDocumentRole;
  plannerClients?: PlannerClientOption[];
  vendorListings?: VendorListingOption[];
  vendorBookings?: VendorBookingOption[];
};

function blankDraft(): ContractDraft {
  return {
    title: '',
    status: 'draft',
    recipientName: '',
    recipientEmail: '',
    recipientPhone: '',
    weddingName: '',
    clientId: '',
    vendorListingId: '',
    vendorId: '',
    eventDate: '',
    summary: '',
    terms: '',
    notes: '',
  };
}

export default function ContractsWorkspace({ role, plannerClients = [], vendorListings = [], vendorBookings = [] }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contracts, setContracts] = useState<ProfessionalContractRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ContractDraft>(blankDraft());
  const [detailDraft, setDetailDraft] = useState<ContractDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadContracts = async (preferredId?: string | null) => {
    const next = await listProfessionalContracts({ role, search: search.trim() || undefined });
    setContracts(next);
    setSelectedId((current) => {
      if (preferredId && next.some((item) => item.id === preferredId)) return preferredId;
      if (current && next.some((item) => item.id === current)) return current;
      return next[0]?.id ?? null;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadContracts();
      } catch (error) {
        console.error('Could not load contracts workspace:', error);
        toast({
          title: 'Could not load contracts',
          description: 'Please try again in a moment.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setRefreshing(true);
      try {
        await loadContracts(selectedId);
      } catch (error) {
        console.error('Could not refresh contracts:', error);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [search]);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === selectedId) ?? null,
    [contracts, selectedId],
  );

  useEffect(() => {
    if (!selectedContract) {
      setDetailDraft(null);
      return;
    }
    setDetailDraft({
      title: selectedContract.title,
      status: selectedContract.status,
      recipientName: selectedContract.recipientName,
      recipientEmail: selectedContract.recipientEmail ?? '',
      recipientPhone: selectedContract.recipientPhone ?? '',
      weddingName: selectedContract.weddingName ?? '',
      clientId: selectedContract.clientId ?? '',
      vendorListingId: selectedContract.vendorListingId ?? '',
      vendorId: selectedContract.vendorId ?? '',
      eventDate: selectedContract.eventDate ?? '',
      summary: selectedContract.summary ?? '',
      terms: selectedContract.terms ?? '',
      notes: selectedContract.notes ?? '',
    });
  }, [selectedContract?.id]);

  const selectedClient = useMemo(
    () => plannerClients.find((client) => client.id === createDraft.clientId) ?? null,
    [plannerClients, createDraft.clientId],
  );
  const selectedBooking = useMemo(
    () => vendorBookings.find((booking) => booking.id === createDraft.vendorId) ?? null,
    [vendorBookings, createDraft.vendorId],
  );

  useEffect(() => {
    if (!selectedClient) return;
    setCreateDraft((current) => ({
      ...current,
      recipientName: current.recipientName || selectedClient.label,
      recipientEmail: current.recipientEmail || selectedClient.email || '',
      weddingName: current.weddingName || selectedClient.label,
      title: current.title || `Planner agreement for ${selectedClient.label}`,
    }));
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedBooking) return;
    setCreateDraft((current) => ({
      ...current,
      recipientName: current.recipientName || selectedBooking.coupleName,
      weddingName: current.weddingName || selectedBooking.coupleName,
      title: current.title || `Vendor agreement for ${selectedBooking.coupleName}`,
    }));
  }, [selectedBooking]);

  const stats = useMemo(() => {
    const awaiting = contracts.filter((item) => item.status === 'awaiting_signature' || item.status === 'sent').length;
    const countersigned = contracts.filter((item) => item.status === 'countersigned').length;
    const completed = contracts.filter((item) => item.status === 'completed').length;
    return {
      total: contracts.length,
      awaiting,
      countersigned,
      completed,
    };
  }, [contracts]);

  const handleCreate = async () => {
    if (!createDraft.title.trim() || !createDraft.recipientName.trim()) {
      toast({
        title: 'Add the contract basics first',
        description: 'A contract needs a title and recipient before we can create it.',
        variant: 'destructive',
      });
      return;
    }
    setCreating(true);
    try {
      const created = await createProfessionalContract({
        role,
        title: createDraft.title.trim(),
        status: createDraft.status,
        recipientName: createDraft.recipientName.trim(),
        recipientEmail: createDraft.recipientEmail.trim() || null,
        recipientPhone: createDraft.recipientPhone.trim() || null,
        weddingName: createDraft.weddingName.trim() || null,
        clientId: role === 'planner' ? createDraft.clientId || null : null,
        vendorListingId: role === 'vendor' ? createDraft.vendorListingId || null : null,
        vendorId: role === 'vendor' ? createDraft.vendorId || null : null,
        eventDate: createDraft.eventDate || null,
        summary: createDraft.summary.trim() || null,
        terms: createDraft.terms.trim() || null,
        notes: createDraft.notes.trim() || null,
      });
      await loadContracts(created.id);
      setCreateDraft(blankDraft());
      if (role === 'vendor' && vendorListings[0]?.id) {
        setCreateDraft((current) => ({ ...current, vendorListingId: vendorListings[0].id }));
      }
      setCreateOpen(false);
      toast({ title: 'Contract created', description: 'Your agreement workspace is ready.' });
    } catch (error) {
      console.error('Could not create contract:', error);
      toast({ title: 'Could not create contract', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedContract || !detailDraft) return;
    setSaving(true);
    try {
      await updateProfessionalContract(selectedContract.id, {
        title: detailDraft.title.trim(),
        status: detailDraft.status,
        recipientName: detailDraft.recipientName.trim(),
        recipientEmail: detailDraft.recipientEmail.trim() || null,
        recipientPhone: detailDraft.recipientPhone.trim() || null,
        weddingName: detailDraft.weddingName.trim() || null,
        eventDate: detailDraft.eventDate || null,
        summary: detailDraft.summary.trim() || null,
        terms: detailDraft.terms.trim() || null,
        notes: detailDraft.notes.trim() || null,
        sentAt: detailDraft.status === 'sent' || detailDraft.status === 'awaiting_signature' || detailDraft.status === 'countersigned' || detailDraft.status === 'completed'
          ? selectedContract.sentAt ?? new Date().toISOString()
          : null,
        signedAt: detailDraft.status === 'completed' ? selectedContract.signedAt ?? new Date().toISOString() : null,
        cancelledAt: detailDraft.status === 'cancelled' ? selectedContract.cancelledAt ?? new Date().toISOString() : null,
      });
      await loadContracts(selectedContract.id);
      toast({ title: 'Contract saved', description: 'The agreement details are up to date.' });
    } catch (error) {
      console.error('Could not save contract:', error);
      toast({ title: 'Could not save contract', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedContract) return;
    if (!window.confirm(`Delete ${selectedContract.title}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteProfessionalContract(selectedContract.id);
      await loadContracts(null);
      toast({ title: 'Contract deleted' });
    } catch (error) {
      console.error('Could not delete contract:', error);
      toast({ title: 'Could not delete contract', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Opening contracts workspace...
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Agreements</p>
            <CardTitle className="font-display text-3xl text-foreground">Contracts</CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Keep service terms, signature status, and wedding-specific agreements in one calmer workspace.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start">
            <FilePlus2 className="h-4 w-4" />
            New contract
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contracts</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Awaiting action</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.awaiting}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Countersigned</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.countersigned}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">{stats.completed}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl">Contract library</CardTitle>
                <CardDescription>Track every agreement without mixing it into invoices and receipts.</CardDescription>
              </div>
              {refreshing && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Refreshing</div>}
            </div>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, recipient, or wedding" />
          </CardHeader>
          <CardContent className="space-y-3">
            {contracts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                <BadgeCheck className="mx-auto mb-3 h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">No contracts yet</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Start with one agreement for your next client so service terms and signatures stop living in chat threads.</p>
                <Button className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                  <FilePlus2 className="h-4 w-4" />
                  Create first contract
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="hidden grid-cols-[1.2fr_1.2fr_0.8fr_1fr] gap-4 border-b border-border bg-muted/20 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:grid">
                  <span>Contract</span>
                  <span>Recipient</span>
                  <span>Event</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border">
                  {contracts.map((contract) => {
                    const active = contract.id === selectedId;
                    return (
                      <button
                        key={contract.id}
                        type="button"
                        onClick={() => setSelectedId(contract.id)}
                        className={`grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[1.2fr_1.2fr_0.8fr_1fr] md:items-center ${active ? 'bg-primary/6' : 'bg-card hover:bg-muted/10'}`}
                      >
                        <div>
                          <p className="font-semibold text-foreground">{contract.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{contract.weddingName || 'No wedding label'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{contract.recipientName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{contract.recipientEmail || contract.recipientPhone || 'No contact yet'}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">{contract.eventDate ? new Date(contract.eventDate).toLocaleDateString() : 'No event date'}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant={contract.status === 'completed' ? 'default' : contract.status === 'cancelled' ? 'outline' : 'secondary'}>
                            {professionalContractStatusLabel(contract.status)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-xl">Contract details</CardTitle>
            <CardDescription>
              {selectedContract ? 'Adjust status, terms, and agreement notes here.' : 'Pick a contract on the left to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedContract || !detailDraft ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center text-sm text-muted-foreground">
                Pick a contract from the library to continue.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Contract title</Label>
                    <Input value={detailDraft.title} onChange={(event) => setDetailDraft((current) => current ? { ...current, title: event.target.value } : current)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={detailDraft.status} onValueChange={(value) => setDetailDraft((current) => current ? { ...current, status: value as ProfessionalContractStatus } : current)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {professionalContractStatusOptions.map((status) => (
                          <SelectItem key={status} value={status}>{professionalContractStatusLabel(status)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient name</Label>
                    <Input value={detailDraft.recipientName} onChange={(event) => setDetailDraft((current) => current ? { ...current, recipientName: event.target.value } : current)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Event date</Label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input type="date" className="pl-9" value={detailDraft.eventDate} onChange={(event) => setDetailDraft((current) => current ? { ...current, eventDate: event.target.value } : current)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient email</Label>
                    <Input value={detailDraft.recipientEmail} onChange={(event) => setDetailDraft((current) => current ? { ...current, recipientEmail: event.target.value } : current)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient phone</Label>
                    <Input value={detailDraft.recipientPhone} onChange={(event) => setDetailDraft((current) => current ? { ...current, recipientPhone: event.target.value } : current)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Wedding / project label</Label>
                  <Input value={detailDraft.weddingName} onChange={(event) => setDetailDraft((current) => current ? { ...current, weddingName: event.target.value } : current)} />
                </div>
                <div className="space-y-2">
                  <Label>Summary</Label>
                  <Textarea rows={3} value={detailDraft.summary} onChange={(event) => setDetailDraft((current) => current ? { ...current, summary: event.target.value } : current)} placeholder="What does this agreement cover?" />
                </div>
                <div className="space-y-2">
                  <Label>Terms</Label>
                  <Textarea rows={8} value={detailDraft.terms} onChange={(event) => setDetailDraft((current) => current ? { ...current, terms: event.target.value } : current)} placeholder="Outline deliverables, payment milestones, cancellations, and any important conditions here." />
                </div>
                <div className="space-y-2">
                  <Label>Internal notes</Label>
                  <Textarea rows={4} value={detailDraft.notes} onChange={(event) => setDetailDraft((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="Internal reminders, meeting notes, or follow-up context." />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>Sent: {selectedContract.sentAt ? new Date(selectedContract.sentAt).toLocaleDateString() : 'Not yet'}</span>
                    <span>Signed: {selectedContract.signedAt ? new Date(selectedContract.signedAt).toLocaleDateString() : 'Not yet'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDetailDraft((current) => current ? { ...current, status: 'awaiting_signature' } : current)}>
                      <Send className="mr-2 h-4 w-4" />Mark awaiting signature
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDetailDraft((current) => current ? { ...current, status: 'completed' } : current)}>
                      <ShieldCheck className="mr-2 h-4 w-4" />Mark completed
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="h-4 w-4" />
                    {deleting ? 'Deleting...' : 'Delete contract'}
                  </Button>
                  <Button type="button" className="gap-2" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save contract'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create contract</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {role === 'planner' ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Planner client</Label>
                <Select value={createDraft.clientId} onValueChange={(value) => setCreateDraft((current) => ({ ...current, clientId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
                  <SelectContent>
                    {plannerClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Vendor listing</Label>
                  <Select value={createDraft.vendorListingId} onValueChange={(value) => setCreateDraft((current) => ({ ...current, vendorListingId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Choose listing" /></SelectTrigger>
                    <SelectContent>
                      {vendorListings.map((listing) => (
                        <SelectItem key={listing.id} value={listing.id}>{listing.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Linked booking</Label>
                  <Select value={createDraft.vendorId || '__none__'} onValueChange={(value) => setCreateDraft((current) => ({ ...current, vendorId: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Choose booking" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No linked booking</SelectItem>
                      {vendorBookings.map((booking) => (
                        <SelectItem key={booking.id} value={booking.id}>{booking.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>Contract title</Label>
              <Input value={createDraft.title} onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))} placeholder={role === 'planner' ? 'e.g. Planning agreement for Mary & Daniel' : 'e.g. Photography agreement for Mary & Daniel'} />
            </div>
            <div className="space-y-2">
              <Label>Recipient name</Label>
              <Input value={createDraft.recipientName} onChange={(event) => setCreateDraft((current) => ({ ...current, recipientName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Event date</Label>
              <Input type="date" value={createDraft.eventDate} onChange={(event) => setCreateDraft((current) => ({ ...current, eventDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Recipient email</Label>
              <Input value={createDraft.recipientEmail} onChange={(event) => setCreateDraft((current) => ({ ...current, recipientEmail: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Recipient phone</Label>
              <Input value={createDraft.recipientPhone} onChange={(event) => setCreateDraft((current) => ({ ...current, recipientPhone: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Wedding / project label</Label>
              <Input value={createDraft.weddingName} onChange={(event) => setCreateDraft((current) => ({ ...current, weddingName: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={3} value={createDraft.summary} onChange={(event) => setCreateDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="A quick summary of what this agreement covers." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Terms</Label>
              <Textarea rows={6} value={createDraft.terms} onChange={(event) => setCreateDraft((current) => ({ ...current, terms: event.target.value }))} placeholder="Main agreement terms." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Internal notes</Label>
              <Textarea rows={3} value={createDraft.notes} onChange={(event) => setCreateDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Private reminders about this agreement." />
            </div>
          </div>
          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleCreate} disabled={creating}>
              <FilePlus2 className="h-4 w-4" />
              {creating ? 'Creating...' : 'Create contract'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
