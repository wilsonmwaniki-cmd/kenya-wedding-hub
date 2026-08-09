import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, BookmarkPlus, Copy, Eye, FilePlus2, Link2, Loader2, Mail, PenLine, RotateCw, Send, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import DocumentSummaryRail from '@/components/documents/DocumentSummaryRail';
import ContractDocumentEditor, { type ContractDocumentDraft } from '@/components/documents/ContractDocumentEditor';
import {
  createDocumentTemplate,
  createProfessionalContract,
  deleteProfessionalContract,
  buildProfessionalContractShareEmailDraft,
  buildProfessionalContractShareUrl,
  getProfessionalContractActivity,
  listDocumentTemplates,
  listProfessionalContracts,
  markProfessionalContractSent,
  professionalContractStatusLabel,
  professionalContractEventLabel,
  refreshProfessionalContractShareToken,
  revokeProfessionalContractShareToken,
  signOwnedProfessionalContract,
  updateProfessionalContract,
  type CommercialDocumentRole,
  type ProfessionalContractActivity,
  type ProfessionalContractShareState,
  type PlannerClientOption,
  type ProfessionalDocumentTemplateRecord,
  type ProfessionalContractRecord,
  type ProfessionalContractSignerRecord,
  type VendorBookingOption,
  type VendorListingOption,
} from '@/lib/commercialDocuments';

type Props = {
  role: CommercialDocumentRole;
  plannerClients?: PlannerClientOption[];
  vendorListings?: VendorListingOption[];
  vendorBookings?: VendorBookingOption[];
};

function blankDraft(): ContractDocumentDraft {
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

function isShareActive(shareState: ProfessionalContractShareState | null) {
  if (!shareState) return false;
  if (shareState.revokedAt) return false;
  if (!shareState.expiresAt) return true;
  return new Date(shareState.expiresAt).getTime() > Date.now();
}

function signatureFontStyle() {
  return {
    fontFamily: '"Montserrat", sans-serif',
    fontStyle: 'italic',
    fontWeight: 600,
  } as const;
}

export default function ContractsWorkspace({ role, plannerClients = [], vendorListings = [], vendorBookings = [] }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contracts, setContracts] = useState<ProfessionalContractRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ContractDocumentDraft>(blankDraft());
  const [detailDraft, setDetailDraft] = useState<ContractDocumentDraft | null>(null);
  const [templates, setTemplates] = useState<ProfessionalDocumentTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activity, setActivity] = useState<ProfessionalContractActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [signingIssuer, setSigningIssuer] = useState(false);

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
    let cancelled = false;
    listDocumentTemplates({ role, templateType: 'contract' })
      .then((next) => { if (!cancelled) setTemplates(next); })
      .catch((error) => console.error('Could not load contract templates:', error));
    return () => { cancelled = true; };
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
      setActivity(null);
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

  useEffect(() => {
    if (!selectedContract) return;
    let cancelled = false;

    const loadActivity = async () => {
      setActivityLoading(true);
      try {
        const next = await getProfessionalContractActivity(selectedContract.id);
        if (!cancelled) setActivity(next);
      } catch (error) {
        console.error('Could not load contract activity:', error);
        if (!cancelled) setActivity(null);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };

    void loadActivity();
    return () => {
      cancelled = true;
    };
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

  const issuerSigner = useMemo(
    () => activity?.signers.find((signer) => signer.signerRole === 'issuer') ?? null,
    [activity?.signers],
  );
  const clientSigner = useMemo(
    () => activity?.signers.find((signer) => signer.signerRole === 'client') ?? null,
    [activity?.signers],
  );
  const shareUrl = activity?.shareState
    ? buildProfessionalContractShareUrl(activity.shareState.shareToken, window.location.origin)
    : null;
  const shareActive = isShareActive(activity?.shareState ?? null);

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
      setSelectedTemplateId('');
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

  const handleSave = async (silent = false) => {
    if (!selectedContract || !detailDraft) return false;
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
      if (!silent) toast({ title: 'Contract saved', description: 'The agreement details are up to date.' });
      return true;
    } catch (error) {
      console.error('Could not save contract:', error);
      toast({ title: 'Could not save contract', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedContract) return;
    const previewWindow = window.open('about:blank', '_blank');
    const saved = await handleSave(true);
    if (!saved) {
      previewWindow?.close();
      return;
    }
    if (previewWindow) previewWindow.location.href = `/contracts/${selectedContract.id}/preview`;
    else window.location.href = `/contracts/${selectedContract.id}/preview`;
  };

  const handleSaveAsTemplate = async () => {
    if (!detailDraft?.title.trim()) return;
    setSavingTemplate(true);
    try {
      const created = await createDocumentTemplate({
        role,
        templateType: 'contract',
        name: detailDraft.title.trim(),
        description: detailDraft.summary.trim() || null,
        defaultTitle: detailDraft.title.trim(),
        defaultNotes: detailDraft.summary.trim() || null,
        defaultTerms: detailDraft.terms.trim() || null,
        defaultItems: [],
        metadata: { source: 'contract_editor' },
      });
      setTemplates((current) => [created, ...current]);
      toast({ title: 'Reusable contract saved', description: 'You can start a future contract from this wording.' });
    } catch (error) {
      console.error('Could not save contract template:', error);
      toast({ title: 'Could not save reusable contract', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const applyContractTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setCreateDraft((current) => ({
      ...current,
      title: template.defaultTitle || current.title,
      summary: template.defaultNotes || '',
      terms: template.defaultTerms || '',
    }));
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

  const handleCopyShareLink = async () => {
    if (!selectedContract || !detailDraft) return;
    setSharing(true);
    try {
      const saved = await handleSave(true);
      if (!saved) return;
      const token = await markProfessionalContractSent(selectedContract.id);
      const url = buildProfessionalContractShareUrl(token, window.location.origin);
      await navigator.clipboard.writeText(url);
      await loadContracts(selectedContract.id);
      setActivity(await getProfessionalContractActivity(selectedContract.id));
      toast({
        title: 'Signing link copied',
        description: 'The public contract link is ready to send.',
      });
    } catch (error) {
      console.error('Could not copy contract share link:', error);
      toast({
        title: 'Could not copy signing link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharing(false);
    }
  };

  const handleEmailShare = async () => {
    if (!selectedContract || !detailDraft) return;
    setSharing(true);
    try {
      const saved = await handleSave(true);
      if (!saved) return;
      const token = await markProfessionalContractSent(selectedContract.id);
      const url = buildProfessionalContractShareUrl(token, window.location.origin);
      const draft = buildProfessionalContractShareEmailDraft({
        contract: {
          ...selectedContract,
          title: detailDraft.title.trim(),
          recipientName: detailDraft.recipientName.trim(),
          recipientEmail: detailDraft.recipientEmail.trim() || null,
          weddingName: detailDraft.weddingName.trim() || null,
          eventDate: detailDraft.eventDate || null,
        },
        shareUrl: url,
      });
      await loadContracts(selectedContract.id);
      setActivity(await getProfessionalContractActivity(selectedContract.id));
      window.location.href = draft.href;
    } catch (error) {
      console.error('Could not prepare contract share email:', error);
      toast({
        title: 'Could not prepare email draft',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharing(false);
    }
  };

  const handleIssuerSignature = async () => {
    if (!selectedContract) return;
    setSigningIssuer(true);
    try {
      await signOwnedProfessionalContract(selectedContract.id);
      await loadContracts(selectedContract.id);
      setActivity(await getProfessionalContractActivity(selectedContract.id));
      toast({
        title: 'Signature added',
        description: 'Your side of the contract is now signed.',
      });
    } catch (error) {
      console.error('Could not sign contract as issuer:', error);
      toast({
        title: 'Could not sign contract',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSigningIssuer(false);
    }
  };

  const handleRefreshShareLink = async () => {
    if (!selectedContract) return;
    setSharing(true);
    try {
      const token = await refreshProfessionalContractShareToken(selectedContract.id);
      await loadContracts(selectedContract.id);
      setActivity(await getProfessionalContractActivity(selectedContract.id));
      await navigator.clipboard.writeText(buildProfessionalContractShareUrl(token, window.location.origin));
      toast({
        title: 'Signing link refreshed',
        description: 'The previous link has been replaced and the new one is copied.',
      });
    } catch (error) {
      console.error('Could not refresh contract share link:', error);
      toast({
        title: 'Could not refresh signing link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShareLink = async () => {
    if (!selectedContract) return;
    setSharing(true);
    try {
      await revokeProfessionalContractShareToken(selectedContract.id);
      setActivity(await getProfessionalContractActivity(selectedContract.id));
      toast({
        title: 'Signing link revoked',
        description: 'The public contract link is no longer active.',
      });
    } catch (error) {
      console.error('Could not revoke contract share link:', error);
      toast({
        title: 'Could not revoke signing link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharing(false);
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
      <header className="space-y-5 border-b border-border/70 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Documents</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">Contracts</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Keep terms and signatures together for each client.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start sm:self-auto"><FilePlus2 className="h-4 w-4" />New contract</Button>
        </div>
        <DocumentSummaryRail items={[
          { label: 'Contracts', value: stats.total },
          { label: 'Needs action', value: stats.awaiting },
          { label: 'Countersigned', value: stats.countersigned },
          { label: 'Completed', value: stats.completed, tone: 'success' },
        ]} />
      </header>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 bg-white/95 shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl">Contract library</CardTitle>
                <CardDescription>Track every agreement without mixing it into invoices and receipts.</CardDescription>
              </div>
              {refreshing && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Refreshing</div>}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, recipient, or wedding" />
              <div className="flex min-h-12 items-center rounded-xl border border-border bg-muted/20 px-4 py-2 text-sm leading-5 text-muted-foreground">
                Viewing <span className="mx-1 break-words font-medium text-foreground">agreements</span>
              </div>
            </div>
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
                        <div className="min-w-0">
                          <p className="break-words font-semibold leading-5 text-foreground">{contract.title}</p>
                          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{contract.weddingName || 'No wedding label'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium leading-5 text-foreground">{contract.recipientName}</p>
                          <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">{contract.recipientEmail || contract.recipientPhone || 'No contact yet'}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">{contract.eventDate ? new Date(contract.eventDate).toLocaleDateString() : 'No event date'}</div>
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${
                              contract.status === 'completed'
                                ? 'bg-success'
                                : contract.status === 'cancelled'
                                  ? 'bg-destructive'
                                  : 'bg-warning'
                            }`}
                          />
                          {professionalContractStatusLabel(contract.status)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-white/95 shadow-card">
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
                <ContractDocumentEditor contract={selectedContract} draft={detailDraft} setDraft={setDetailDraft} saving={saving} onSave={() => handleSave()} />
                <div className="grid gap-4 border border-border/70 bg-muted/10 p-5 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="contract-private-note">Private workspace note</Label>
                    <Textarea id="contract-private-note" rows={3} value={detailDraft.notes} onChange={(event) => setDetailDraft((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="Reminders only your team should see." />
                    <p className="text-xs text-muted-foreground">This note never appears in the preview or the client signing link.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-2" onClick={handlePreview} disabled={saving}>
                      <Eye className="h-4 w-4" />Preview contract
                    </Button>
                    <Button type="button" variant="outline" className="gap-2" onClick={handleSaveAsTemplate} disabled={savingTemplate}>
                      {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                      Save as reusable
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-2xl border border-border bg-muted/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Signing link</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Let clients review and sign without creating a Zania account.
                        </p>
                      </div>
                      {activityLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" size="sm" className="gap-2" onClick={handleCopyShareLink} disabled={sharing}>
                        {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        Copy signing link
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleEmailShare} disabled={sharing}>
                        <Mail className="h-4 w-4" />
                        Send by email
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleRefreshShareLink} disabled={sharing}>
                        {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                        Refresh link
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleRevokeShareLink} disabled={sharing || !activity?.shareState || !shareActive}>
                        <ShieldOff className="h-4 w-4" />
                        Revoke link
                      </Button>
                    </div>
                    <div className="mt-4 rounded-xl border border-border/70 bg-white/80 p-3 text-sm text-muted-foreground">
                      {shareUrl ? (
                        <>
                          <div className="flex items-center gap-2 text-foreground">
                            <Link2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">{shareActive ? 'Public signing link active' : 'Signing link inactive'}</span>
                          </div>
                          <p className="mt-2 break-all">{shareUrl}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                            {typeof activity?.shareState?.accessCount === 'number'
                              ? `${activity.shareState.accessCount} public open${activity.shareState.accessCount === 1 ? '' : 's'}`
                              : 'No public opens yet'}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {activity?.shareState?.expiresAt
                              ? `Expires ${new Date(activity.shareState.expiresAt).toLocaleDateString()}`
                              : 'No expiry set'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {activity?.shareState?.lastAccessedAt
                              ? `Last opened ${new Date(activity.shareState.lastAccessedAt).toLocaleString()}`
                              : 'No public opens recorded yet.'}
                          </p>
                        </>
                      ) : (
                        <p>Generate the signing link when this agreement is ready for the client.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Signatures</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep the issuer and client signature states in one place.
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleIssuerSignature} disabled={signingIssuer || !!issuerSigner?.signedAt}>
                        {signingIssuer ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                        {issuerSigner?.signedAt ? 'Issuer signed' : 'Sign as issuer'}
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[issuerSigner, clientSigner].map((signer, index) => (
                        <div key={signer?.id ?? index} className="rounded-xl border border-border/70 bg-white/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {signer?.signerTitle || (index === 0 ? (role === 'planner' ? 'Planner' : 'Vendor') : 'Client')}
                          </p>
                          {signer?.signedName ? (
                            <>
                              <p className="mt-3 text-2xl text-foreground" style={signatureFontStyle()}>{signer.signedName}</p>
                              <p className="mt-2 text-sm font-medium text-foreground">{signer.signerName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Signed {new Date(signer.signedAt || '').toLocaleDateString()}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mt-3 text-sm font-medium text-foreground">{index === 0 ? 'Signature pending on your side' : 'Client signature pending'}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {index === 0 ? 'Add your typed signature when the contract is ready.' : 'The client can sign from the public contract link.'}
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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
                <div className="rounded-2xl border border-border bg-white/90 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Timeline</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Watch each contract move from draft to completion.
                      </p>
                    </div>
                    {activityLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  <div className="mt-4 space-y-4">
                    {activity?.events.length ? (
                      activity.events.map((event, index) => (
                        <div key={event.id} className="flex gap-4">
                          <div className="flex w-5 flex-col items-center">
                            <span className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-primary' : 'bg-primary/45'}`} />
                            {index !== activity.events.length - 1 && <span className="mt-1 h-full w-px bg-border" />}
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-semibold text-foreground">{professionalContractEventLabel(event.eventType)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{event.actorName || 'Zania contract activity'}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                              {new Date(event.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                        Contract events will appear here as the signing process moves.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-start gap-3">
                  <Button type="button" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="h-4 w-4" />
                    {deleting ? 'Deleting...' : 'Delete contract'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[88vh] w-[min(92vw,56rem)] max-w-[56rem] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5">
            <DialogTitle>Create contract</DialogTitle>
            <p className="text-sm text-muted-foreground">Add the basics now. You will edit the agreement itself on the next screen.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              {templates.length > 0 && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Start from a reusable contract · Optional</Label>
                  <Select value={selectedTemplateId || '__blank__'} onValueChange={(value) => value === '__blank__' ? setSelectedTemplateId('') : applyContractTemplate(value)}>
                    <SelectTrigger><SelectValue placeholder="Start with a blank contract" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__blank__">Start with a blank contract</SelectItem>
                      {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">This fills the title, summary, and agreement wording. You can amend everything before sending.</p>
                </div>
              )}
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
            </div>
          </div>
          <div className="flex shrink-0 justify-end border-t border-border/70 bg-background px-6 py-4">
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
