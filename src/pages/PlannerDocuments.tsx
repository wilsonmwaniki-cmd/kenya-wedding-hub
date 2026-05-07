import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  FilePlus2,
  FileSpreadsheet,
  Link2,
  Loader2,
  Mail,
  NotebookPen,
  Printer,
  Receipt,
  Save,
  Send,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  buildCommercialDocumentShareEmailDraft,
  buildCommercialDocumentShareUrl,
  commercialDocumentPaymentMethodLabel,
  commercialDocumentPaymentMethodOptions,
  commercialDocumentStatusLabel,
  commercialDocumentStatusOptionsFor,
  commercialDocumentTypeLabel,
  createCommercialDocument,
  convertQuoteToInvoice,
  deleteCommercialDocument,
  ensureCommercialDocumentShareToken,
  getCommercialDocument,
  issueReceiptFromPayment,
  listCommercialDocuments,
  listPlannerClientOptions,
  recordCommercialDocumentPayment,
  saveCommercialDocumentItems,
  updateCommercialDocument,
  type CommercialDocumentDetail,
  type CommercialDocumentPaymentMethod,
  type CommercialDocumentRecord,
  type CommercialDocumentStatus,
  type CommercialDocumentType,
  type PlannerClientOption,
  type SaveCommercialDocumentItemInput,
} from '@/lib/commercialDocuments';

type CreateDocumentDraft = {
  documentType: CommercialDocumentType;
  title: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  weddingName: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  terms: string;
};

type PaymentDraft = {
  amount: string;
  paymentDate: string;
  paymentMethod: CommercialDocumentPaymentMethod;
  reference: string;
  notes: string;
};

type FilterType = 'all' | CommercialDocumentType;
type DocumentsSection = 'overview' | 'quotes' | 'invoices' | 'receipts' | 'contracts' | 'templates';

function formatCurrency(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultStatusFor(type: CommercialDocumentType): CommercialDocumentStatus {
  if (type === 'invoice') return 'draft';
  if (type === 'receipt') return 'issued';
  return 'draft';
}

function nextDueDateValue(type: CommercialDocumentType) {
  if (type === 'receipt') return '';
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.toISOString().slice(0, 10);
}

export default function PlannerDocuments() {
  const { toast } = useToast();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<CommercialDocumentRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CommercialDocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [plannerClients, setPlannerClients] = useState<PlannerClientOption[]>([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState(false);
  const [issuingReceiptId, setIssuingReceiptId] = useState<string | null>(null);
  const [sharingDocumentId, setSharingDocumentId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDocumentDraft>({
    documentType: 'quote',
    title: '',
    recipientName: '',
    recipientEmail: '',
    recipientPhone: '',
    weddingName: '',
    clientId: '',
    issueDate: todayIso(),
    dueDate: nextDueDateValue('quote'),
    notes: '',
    terms: '',
  });
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({
    amount: '',
    paymentDate: todayIso(),
    paymentMethod: 'mpesa',
    reference: '',
    notes: '',
  });
  const [headerDraft, setHeaderDraft] = useState<{
    title: string;
    status: CommercialDocumentStatus;
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string;
    weddingName: string;
    issueDate: string;
    dueDate: string;
    notes: string;
    terms: string;
  } | null>(null);
  const [itemDrafts, setItemDrafts] = useState<SaveCommercialDocumentItemInput[]>([]);

  const activeSection: DocumentsSection = useMemo(() => {
    if (location.pathname.endsWith('/quotes')) return 'quotes';
    if (location.pathname.endsWith('/invoices')) return 'invoices';
    if (location.pathname.endsWith('/receipts')) return 'receipts';
    if (location.pathname.endsWith('/contracts')) return 'contracts';
    if (location.pathname.endsWith('/templates')) return 'templates';
    return 'overview';
  }, [location.pathname]);

  const activeType: FilterType = useMemo(() => {
    if (activeSection === 'quotes') return 'quote';
    if (activeSection === 'invoices') return 'invoice';
    if (activeSection === 'receipts') return 'receipt';
    return 'all';
  }, [activeSection]);

  const loadDocuments = async (preferredId?: string | null) => {
    const next = await listCommercialDocuments({
      role: 'planner',
      documentType: activeType === 'all' ? undefined : activeType,
      search: search.trim() || undefined,
    });
    setDocuments(next);
    setSelectedDocumentId((current) => {
      if (preferredId && next.some((document) => document.id === preferredId)) return preferredId;
      if (current && next.some((document) => document.id === current)) return current;
      return next[0]?.id ?? null;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const clients = await listPlannerClientOptions();

        if (cancelled) return;

        setPlannerClients(clients);
        setCreateDraft((current) => ({
          ...current,
          clientId: current.clientId || clients[0]?.id || '',
        }));

        await loadDocuments();
      } catch (error) {
        console.error('Could not load planner documents workspace:', error);
        toast({
          title: 'Could not load documents',
          description: 'We could not open your commercial documents workspace.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    const refresh = async () => {
      setRefreshing(true);
      try {
        await loadDocuments(selectedDocumentId);
      } catch (error) {
        console.error('Could not refresh planner documents:', error);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };

    const handle = window.setTimeout(refresh, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [search, activeType]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setSelectedDetail(null);
      setHeaderDraft(null);
      setItemDrafts([]);
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const detail = await getCommercialDocument(selectedDocumentId);
        if (cancelled) return;
        setSelectedDetail(detail);
        if (detail) {
          setHeaderDraft({
            title: detail.title,
            status: detail.status,
            recipientName: detail.recipientName,
            recipientEmail: detail.recipientEmail ?? '',
            recipientPhone: detail.recipientPhone ?? '',
            weddingName: detail.weddingName ?? '',
            issueDate: detail.issueDate,
            dueDate: detail.dueDate ?? '',
            notes: detail.notes ?? '',
            terms: detail.terms ?? '',
          });
          setItemDrafts(
            detail.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              sortOrder: item.sortOrder,
              metadata: item.metadata,
            })),
          );
        }
      } catch (error) {
        console.error('Could not load document detail:', error);
        toast({
          title: 'Could not load document',
          description: 'We could not open the selected document right now.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId]);

  const stats = useMemo(() => {
    const invoices = documents.filter((document) => document.documentType === 'invoice');
    const quotes = documents.filter((document) => document.documentType === 'quote');
    const receipts = documents.filter((document) => document.documentType === 'receipt');
    const outstanding = invoices.reduce((sum, document) => sum + document.balanceDue, 0);
    const collected = invoices.reduce((sum, document) => sum + document.amountPaid, 0);

    return {
      total: documents.length,
      quotes: quotes.length,
      invoices: invoices.length,
      receipts: receipts.length,
      outstanding,
      collected,
    };
  }, [documents]);

  const selectedClient = useMemo(
    () => plannerClients.find((client) => client.id === createDraft.clientId) ?? null,
    [plannerClients, createDraft.clientId],
  );

  useEffect(() => {
    if (!selectedClient) return;
    setCreateDraft((current) => ({
      ...current,
      recipientName: current.recipientName || selectedClient.label,
      recipientEmail: current.recipientEmail || selectedClient.email || '',
      weddingName: current.weddingName || selectedClient.label,
      title:
        current.title ||
        `${commercialDocumentTypeLabel(current.documentType)} for ${selectedClient.label}`,
    }));
  }, [selectedClient]);

  const handleCreate = async () => {
    if (!createDraft.recipientName.trim()) {
      toast({
        title: 'Recipient name required',
        description: 'Add the person or couple you are billing before creating the document.',
        variant: 'destructive',
      });
      return;
    }

    if (!createDraft.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Give this document a simple internal title first.',
        variant: 'destructive',
      });
      return;
    }

    setSavingHeader(true);
    try {
      const created = await createCommercialDocument({
        role: 'planner',
        documentType: createDraft.documentType,
        title: createDraft.title.trim(),
        recipientName: createDraft.recipientName.trim(),
        recipientEmail: createDraft.recipientEmail.trim() || null,
        recipientPhone: createDraft.recipientPhone.trim() || null,
        weddingName: createDraft.weddingName.trim() || null,
        clientId: createDraft.clientId || null,
        issueDate: createDraft.issueDate || null,
        dueDate: createDraft.documentType === 'receipt' ? null : createDraft.dueDate || null,
        notes: createDraft.notes.trim() || null,
        terms: createDraft.terms.trim() || null,
        status: defaultStatusFor(createDraft.documentType),
      });

      await loadDocuments(created.id);
      setCreateOpen(false);
      setCreateDraft((current) => ({
        ...current,
        title: '',
        recipientName: '',
        recipientEmail: '',
        recipientPhone: '',
        weddingName: '',
        clientId: '',
        issueDate: todayIso(),
        dueDate: nextDueDateValue(current.documentType),
        notes: '',
        terms: '',
      }));
      toast({
        title: `${commercialDocumentTypeLabel(created.documentType)} created`,
        description: `${created.documentNumber} is ready for line items and payment tracking.`,
      });
    } catch (error) {
      console.error('Could not create document:', error);
      toast({
        title: 'Could not create document',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingHeader(false);
    }
  };

  const handleSaveHeader = async () => {
    if (!selectedDetail || !headerDraft) return;
    setSavingHeader(true);
    try {
      await updateCommercialDocument(selectedDetail.id, {
        title: headerDraft.title.trim(),
        status: headerDraft.status,
        recipientName: headerDraft.recipientName.trim(),
        recipientEmail: headerDraft.recipientEmail.trim() || null,
        recipientPhone: headerDraft.recipientPhone.trim() || null,
        weddingName: headerDraft.weddingName.trim() || null,
        issueDate: headerDraft.issueDate,
        dueDate: selectedDetail.documentType === 'receipt' ? null : headerDraft.dueDate || null,
        notes: headerDraft.notes.trim() || null,
        terms: headerDraft.terms.trim() || null,
      });
      await loadDocuments(selectedDetail.id);
      setSelectedDetail(await getCommercialDocument(selectedDetail.id));
      toast({
        title: 'Document updated',
        description: 'Header details and status are now saved.',
      });
    } catch (error) {
      console.error('Could not save document header:', error);
      toast({
        title: 'Could not save changes',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingHeader(false);
    }
  };

  const handleSaveItems = async () => {
    if (!selectedDetail) return;

    const sanitized = itemDrafts
      .map((item, index) => ({
        description: item.description?.trim() || '',
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? 0),
        sortOrder: index,
        metadata: item.metadata ?? {},
      }))
      .filter((item) => item.description.length > 0);

    if (!sanitized.length) {
      toast({
        title: 'Add at least one line item',
        description: 'Quotes and invoices should have at least one service line.',
        variant: 'destructive',
      });
      return;
    }

    setSavingItems(true);
    try {
      await saveCommercialDocumentItems(selectedDetail.id, sanitized);
      await loadDocuments(selectedDetail.id);
      setSelectedDetail(await getCommercialDocument(selectedDetail.id));
      toast({
        title: 'Line items saved',
        description: 'Totals were recalculated from the latest item list.',
      });
    } catch (error) {
      console.error('Could not save line items:', error);
      toast({
        title: 'Could not save line items',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingItems(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedDetail) return;
    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: 'Enter a valid payment amount',
        description: 'Payments need a real amount before they can be recorded.',
        variant: 'destructive',
      });
      return;
    }

    setSavingPayment(true);
    try {
      await recordCommercialDocumentPayment(selectedDetail.id, {
        amount,
        paymentDate: paymentDraft.paymentDate || null,
        paymentMethod: paymentDraft.paymentMethod,
        reference: paymentDraft.reference.trim() || null,
        notes: paymentDraft.notes.trim() || null,
      });
      await loadDocuments(selectedDetail.id);
      setSelectedDetail(await getCommercialDocument(selectedDetail.id));
      setPaymentOpen(false);
      setPaymentDraft({
        amount: '',
        paymentDate: todayIso(),
        paymentMethod: 'mpesa',
        reference: '',
        notes: '',
      });
      toast({
        title: 'Payment recorded',
        description: 'The invoice balance and payment trail are now updated.',
      });
    } catch (error) {
      console.error('Could not record payment:', error);
      toast({
        title: 'Could not record payment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleConvertQuote = async () => {
    if (!selectedDetail) return;
    setConvertingQuote(true);
    try {
      const invoice = await convertQuoteToInvoice(selectedDetail.id, {
        issueDate: todayIso(),
        dueDate: nextDueDateValue('invoice'),
      });
      await loadDocuments(invoice.id);
      setSelectedDocumentId(invoice.id);
      toast({
        title: 'Quote converted',
        description: `${invoice.documentNumber} is ready to send and track for payment.`,
      });
    } catch (error) {
      console.error('Could not convert quote:', error);
      toast({
        title: 'Could not convert quote',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setConvertingQuote(false);
    }
  };

  const handleIssueReceipt = async (paymentId: string) => {
    if (!selectedDetail) return;
    setIssuingReceiptId(paymentId);
    try {
      const receipt = await issueReceiptFromPayment(selectedDetail.id, paymentId);
      await loadDocuments(receipt.id);
      setSelectedDocumentId(receipt.id);
      toast({
        title: 'Receipt issued',
        description: `${receipt.documentNumber} has been added to your document library.`,
      });
    } catch (error) {
      console.error('Could not issue receipt:', error);
      toast({
        title: 'Could not issue receipt',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIssuingReceiptId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedDetail) return;
    if (!window.confirm(`Delete ${selectedDetail.documentNumber}? This cannot be undone.`)) return;

    try {
      await deleteCommercialDocument(selectedDetail.id);
      await loadDocuments(null);
      toast({
        title: 'Document deleted',
        description: 'The document has been removed from your library.',
      });
    } catch (error) {
      console.error('Could not delete document:', error);
      toast({
        title: 'Could not delete document',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyShareLink = async () => {
    if (!selectedDetail) return;
    setSharingDocumentId(selectedDetail.id);
    try {
      const token = await ensureCommercialDocumentShareToken(selectedDetail.id);
      const url = buildCommercialDocumentShareUrl(token, window.location.origin);
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Share link copied',
        description: 'You can now paste this document link into WhatsApp or email.',
      });
    } catch (error) {
      console.error('Could not copy share link:', error);
      toast({
        title: 'Could not create share link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharingDocumentId(null);
    }
  };

  const handleEmailShare = async () => {
    if (!selectedDetail) return;
    setSharingDocumentId(selectedDetail.id);
    try {
      const token = await ensureCommercialDocumentShareToken(selectedDetail.id);
      const url = buildCommercialDocumentShareUrl(token, window.location.origin);
      const draft = buildCommercialDocumentShareEmailDraft({
        document: selectedDetail,
        shareUrl: url,
      });
      window.location.href = draft.href;
    } catch (error) {
      console.error('Could not prepare share email:', error);
      toast({
        title: 'Could not prepare share email',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharingDocumentId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Opening your commercial documents workspace...
        </div>
      </div>
    );
  }

  const pageTitle =
    activeSection === 'quotes'
      ? 'Quotes'
      : activeSection === 'invoices'
        ? 'Invoices'
        : activeSection === 'receipts'
          ? 'Receipts'
          : activeSection === 'contracts'
            ? 'Contracts'
            : activeSection === 'templates'
              ? 'Templates'
              : 'Documents';

  const pageDescription =
    activeSection === 'quotes'
      ? 'Draft proposals for couples without the rest of the billing workflow crowding the page.'
      : activeSection === 'invoices'
        ? 'Stay focused on what is due, what is paid, and what still needs follow-up.'
        : activeSection === 'receipts'
          ? 'Keep issued receipts in one clean trail for every real payment you record.'
          : activeSection === 'contracts'
            ? 'Keep agreements separate from billing so service terms live in their own calmer workspace.'
            : activeSection === 'templates'
              ? 'Keep reusable document starting points in one place so new paperwork is faster to create.'
              : 'Use the left menu to move between your overview, quotes, invoices, receipts, contracts, and templates.';

  const sectionBadgeLabel =
    activeSection === 'overview'
      ? 'Quotes'
      : activeSection === 'quotes'
        ? 'Quotes'
        : activeSection === 'invoices'
          ? 'Invoices'
          : activeSection === 'receipts'
            ? 'Receipts'
            : activeSection === 'contracts'
              ? 'Contracts'
              : 'Templates';

  const showDocumentWorkspace =
    activeSection === 'overview' ||
    activeSection === 'quotes' ||
    activeSection === 'invoices' ||
    activeSection === 'receipts';

  const emptyStateCopy =
    activeSection === 'quotes'
      ? 'Create your first quote for a couple, then turn it into an invoice once the work is confirmed.'
      : activeSection === 'invoices'
        ? 'Once a quote is approved, your invoices will gather here for due-date and payment follow-up.'
        : activeSection === 'receipts'
          ? 'Receipts appear after you record real payments against invoices.'
          : 'Start with a quote for a couple, then turn it into an invoice once the work is confirmed.';

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Commercial documents</p>
            <CardTitle className="font-display text-3xl text-foreground">{pageTitle}</CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {pageDescription}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start">
            <FilePlus2 className="h-4 w-4" />
            New document
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Documents</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{sectionBadgeLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {activeSection === 'quotes'
                ? stats.quotes
                : activeSection === 'invoices'
                  ? stats.invoices
                  : activeSection === 'receipts'
                    ? stats.receipts
                    : 0}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Collected</p>
            <p className="mt-2 text-lg font-semibold text-emerald-700">{formatCurrency(stats.collected)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Outstanding</p>
            <p className="mt-2 text-lg font-semibold text-amber-700">{formatCurrency(stats.outstanding)}</p>
          </div>
        </CardContent>
      </Card>

      {!showDocumentWorkspace ? (
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{pageTitle}</CardTitle>
            <CardDescription>
              {activeSection === 'contracts'
                ? 'This is the next clean step for the documents area: agreements live here instead of being mixed into invoices and receipts.'
                : 'Reusable quote, invoice, receipt, and contract starters will live here so new paperwork is faster to prepare.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center">
              <NotebookPen className="mx-auto mb-4 h-6 w-6 text-primary" />
              <p className="font-medium text-foreground">
                {activeSection === 'contracts' ? 'Contracts workspace coming next' : 'Templates workspace coming next'}
              </p>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {activeSection === 'contracts'
                  ? 'We have separated contracts into their own submenu so this area can stay focused and uncluttered. The agreement workflow will land here next.'
                  : 'We have separated templates into their own submenu so the billing workspace stays lighter. Reusable templates will land here next.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl">Document library</CardTitle>
                <CardDescription>Filter your live quote, invoice, and receipt stack.</CardDescription>
              </div>
              {refreshing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Refreshing
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by document number, recipient, or wedding"
              />
              <div className="flex items-center rounded-xl border border-border bg-muted/20 px-4 text-sm text-muted-foreground">
                Showing <span className="mx-1 font-medium text-foreground">{pageTitle}</span> from the left menu
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                <FileSpreadsheet className="mx-auto mb-3 h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">No documents yet</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyStateCopy}</p>
                <Button className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                  <FilePlus2 className="h-4 w-4" />
                  Create first document
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="hidden grid-cols-[1.1fr_1.4fr_0.9fr_0.9fr_1fr] gap-4 border-b border-border bg-muted/20 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:grid">
                  <span>Document</span>
                  <span>Recipient</span>
                  <span>Total</span>
                  <span>Due</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border">
                  {documents.map((document) => {
                    const isActive = document.id === selectedDocumentId;
                    return (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => setSelectedDocumentId(document.id)}
                        className={`grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[1.1fr_1.4fr_0.9fr_0.9fr_1fr] md:items-center ${
                          isActive ? 'bg-primary/6' : 'bg-card hover:bg-muted/10'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-foreground">{document.documentNumber}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{document.title}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{document.recipientName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{document.weddingName || 'No wedding label'}</p>
                        </div>
                        <div className="text-sm font-semibold text-foreground">{formatCurrency(document.totalAmount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {document.documentType !== 'receipt' && document.dueDate
                            ? new Date(document.dueDate).toLocaleDateString()
                            : 'No due date'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{commercialDocumentTypeLabel(document.documentType)}</Badge>
                          <Badge variant={document.status === 'paid' || document.status === 'accepted' || document.status === 'issued' ? 'default' : 'outline'}>
                            {commercialDocumentStatusLabel(document.status)}
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
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl">
                  {selectedDetail ? selectedDetail.documentNumber : 'Document details'}
                </CardTitle>
                <CardDescription>
                  {selectedDetail
                    ? 'Update the header, line items, and payments from one workspace.'
                    : 'Pick a document on the left to edit it here.'}
                </CardDescription>
              </div>
              {selectedDetail && (
                <div className="flex flex-wrap gap-2">
                  {selectedDetail.documentType === 'quote' && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleConvertQuote}
                      disabled={convertingQuote}
                    >
                      {convertingQuote ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Convert to invoice
                    </Button>
                  )}
                  {selectedDetail.documentType === 'invoice' && (
                    <Button variant="outline" className="gap-2" onClick={() => setPaymentOpen(true)}>
                      <Wallet className="h-4 w-4" />
                      Record payment
                    </Button>
                  )}
                  <Button asChild variant="outline" className="gap-2">
                    <Link to={`/documents/${selectedDetail.id}/print`} target="_blank" rel="noreferrer">
                      <Printer className="h-4 w-4" />
                      Print
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleCopyShareLink}
                    disabled={sharingDocumentId === selectedDetail.id}
                  >
                    {sharingDocumentId === selectedDetail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleEmailShare}
                    disabled={sharingDocumentId === selectedDetail.id}
                  >
                    <Mail className="h-4 w-4" />
                    Email link
                  </Button>
                  <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedDocumentId ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                Pick a quote, invoice, or receipt to continue.
              </div>
            ) : detailLoading || !selectedDetail || !headerDraft ? (
              <div className="flex min-h-[360px] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/15 px-5 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Opening document details...
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={headerDraft.title}
                      onChange={(event) => setHeaderDraft((current) => current ? { ...current, title: event.target.value } : current)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={headerDraft.status}
                      onValueChange={(value) =>
                        setHeaderDraft((current) =>
                          current ? { ...current, status: value as CommercialDocumentStatus } : current,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {commercialDocumentStatusOptionsFor(selectedDetail.documentType).map((option) => (
                          <SelectItem key={option} value={option}>
                            {commercialDocumentStatusLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient name</Label>
                    <Input
                      value={headerDraft.recipientName}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, recipientName: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wedding name</Label>
                    <Input
                      value={headerDraft.weddingName}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, weddingName: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient email</Label>
                    <Input
                      type="email"
                      value={headerDraft.recipientEmail}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, recipientEmail: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient phone</Label>
                    <Input
                      value={headerDraft.recipientPhone}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, recipientPhone: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Issue date</Label>
                    <Input
                      type="date"
                      value={headerDraft.issueDate}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, issueDate: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due date</Label>
                    <Input
                      type="date"
                      value={headerDraft.dueDate}
                      disabled={selectedDetail.documentType === 'receipt'}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, dueDate: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      rows={3}
                      value={headerDraft.notes}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, notes: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Terms</Label>
                    <Textarea
                      rows={3}
                      value={headerDraft.terms}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, terms: event.target.value } : current)
                      }
                    />
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/10 p-4">
                  <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-6">
                    <p><span className="font-medium text-foreground">Subtotal:</span> {formatCurrency(selectedDetail.subtotal)}</p>
                    <p><span className="font-medium text-foreground">Paid:</span> {formatCurrency(selectedDetail.amountPaid)}</p>
                    <p><span className="font-medium text-foreground">Balance:</span> {formatCurrency(selectedDetail.balanceDue)}</p>
                  </div>
                  <Button className="gap-2" onClick={handleSaveHeader} disabled={savingHeader}>
                    {savingHeader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save document details
                  </Button>
                </div>

                <section className="space-y-4 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg text-foreground">Line items</h3>
                      <p className="text-sm text-muted-foreground">Keep the commercial breakdown clean before you send or convert.</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setItemDrafts((current) => [
                          ...current,
                          { description: '', quantity: 1, unitPrice: 0, sortOrder: current.length },
                        ])
                      }
                    >
                      Add line item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {itemDrafts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground">
                        No line items yet. Add at least one service or deliverable before you send this document out.
                      </div>
                    ) : (
                      itemDrafts.map((item, index) => {
                        const quantity = Number(item.quantity ?? 1);
                        const unitPrice = Number(item.unitPrice ?? 0);
                        return (
                          <div key={`${index}-${item.description}`} className="grid gap-3 rounded-2xl border border-border bg-muted/5 p-4 md:grid-cols-[1.6fr_0.45fr_0.55fr_auto]">
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Input
                                value={item.description}
                                onChange={(event) =>
                                  setItemDrafts((current) =>
                                    current.map((row, rowIndex) =>
                                      rowIndex === index ? { ...row, description: event.target.value } : row,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Qty</Label>
                              <Input
                                type="number"
                                min="1"
                                value={String(item.quantity ?? 1)}
                                onChange={(event) =>
                                  setItemDrafts((current) =>
                                    current.map((row, rowIndex) =>
                                      rowIndex === index ? { ...row, quantity: Number(event.target.value || 1) } : row,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Unit price</Label>
                              <Input
                                type="number"
                                min="0"
                                value={String(item.unitPrice ?? 0)}
                                onChange={(event) =>
                                  setItemDrafts((current) =>
                                    current.map((row, rowIndex) =>
                                      rowIndex === index ? { ...row, unitPrice: Number(event.target.value || 0) } : row,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-end justify-between gap-3 md:flex-col md:items-end">
                              <p className="text-sm font-medium text-foreground">{formatCurrency(quantity * unitPrice)}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  setItemDrafts((current) => current.filter((_, rowIndex) => rowIndex !== index))
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button className="gap-2" onClick={handleSaveItems} disabled={savingItems}>
                      {savingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save line items
                    </Button>
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg text-foreground">Payments and receipts</h3>
                      <p className="text-sm text-muted-foreground">Use this trail to keep deposits, balances, and acknowledgements clean.</p>
                    </div>
                    {selectedDetail.documentType === 'invoice' && (
                      <Button onClick={() => setPaymentOpen(true)} className="gap-2">
                        <Wallet className="h-4 w-4" />
                        Record payment
                      </Button>
                    )}
                  </div>

                  {selectedDetail.documentType === 'receipt' ? (
                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
                      This receipt was generated from a recorded payment. You can keep it in the library as your acknowledgement record.
                    </div>
                  ) : selectedDetail.payments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground">
                      No payments recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDetail.payments.map((payment) => (
                        <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/5 p-4">
                          <div>
                            <p className="font-medium text-foreground">{formatCurrency(payment.amount)}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(payment.paymentDate).toLocaleDateString()} · {commercialDocumentPaymentMethodLabel(payment.paymentMethod)}
                            </p>
                            {payment.reference && (
                              <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                            )}
                          </div>
                          {selectedDetail.documentType === 'invoice' && (
                            <Button
                              variant="outline"
                              className="gap-2"
                              onClick={() => handleIssueReceipt(payment.id)}
                              disabled={issuingReceiptId === payment.id}
                            >
                              {issuingReceiptId === payment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <BadgeCheck className="h-4 w-4" />
                              )}
                              Issue receipt
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create a commercial document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Document type</Label>
              <Select
                value={createDraft.documentType}
                onValueChange={(value) =>
                  setCreateDraft((current) => ({
                    ...current,
                    documentType: value as CommercialDocumentType,
                    dueDate: nextDueDateValue(value as CommercialDocumentType),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linked client</Label>
              <Select
                value={createDraft.clientId || 'none'}
                onValueChange={(value) =>
                  setCreateDraft((current) => ({
                    ...current,
                    clientId: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client link</SelectItem>
                  {plannerClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input
                value={createDraft.title}
                onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Planning proposal for Mary & James"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient name</Label>
              <Input
                value={createDraft.recipientName}
                onChange={(event) => setCreateDraft((current) => ({ ...current, recipientName: event.target.value }))}
                placeholder="Couple or main contact name"
              />
            </div>
            <div className="space-y-2">
              <Label>Wedding / project name</Label>
              <Input
                value={createDraft.weddingName}
                onChange={(event) => setCreateDraft((current) => ({ ...current, weddingName: event.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient email</Label>
              <Input
                type="email"
                value={createDraft.recipientEmail}
                onChange={(event) => setCreateDraft((current) => ({ ...current, recipientEmail: event.target.value }))}
                placeholder="couple@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient phone</Label>
              <Input
                value={createDraft.recipientPhone}
                onChange={(event) => setCreateDraft((current) => ({ ...current, recipientPhone: event.target.value }))}
                placeholder="+254..."
              />
            </div>
            <div className="rounded-2xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              Link documents to a planner client so your proposals, invoices, and receipts stay attached to the right wedding workspace.
            </div>
            <div className="space-y-2">
              <Label>Issue date</Label>
              <Input
                type="date"
                value={createDraft.issueDate}
                onChange={(event) => setCreateDraft((current) => ({ ...current, issueDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                disabled={createDraft.documentType === 'receipt'}
                value={createDraft.dueDate}
                onChange={(event) => setCreateDraft((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={createDraft.notes}
                onChange={(event) => setCreateDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Terms</Label>
              <Textarea
                rows={3}
                value={createDraft.terms}
                onChange={(event) => setCreateDraft((current) => ({ ...current, terms: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={handleCreate} disabled={savingHeader}>
              {savingHeader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                value={paymentDraft.amount}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input
                type="date"
                value={paymentDraft.paymentDate}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paymentDraft.paymentMethod}
                onValueChange={(value) =>
                  setPaymentDraft((current) => ({
                    ...current,
                    paymentMethod: value as CommercialDocumentPaymentMethod,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commercialDocumentPaymentMethodOptions.map((method) => (
                    <SelectItem key={method} value={method}>
                      {commercialDocumentPaymentMethodLabel(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={paymentDraft.reference}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))}
                placeholder="M-Pesa code, bank ref, or note"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={paymentDraft.notes}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Save payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
