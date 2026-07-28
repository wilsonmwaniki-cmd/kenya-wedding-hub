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
  RotateCw,
  Save,
  Send,
  ShieldOff,
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
import ContractsWorkspace from '@/components/documents/ContractsWorkspace';
import DocumentActionOverview from '@/components/documents/DocumentActionOverview';
import DocumentMomentumCard from '@/components/documents/DocumentMomentumCard';
import DocumentMetricLink from '@/components/documents/DocumentMetricLink';
import TemplatesWorkspace from '@/components/documents/TemplatesWorkspace';
import InfoTip from '@/components/InfoTip';
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
  getCommercialDocumentShareState,
  getCommercialDocument,
  issueReceiptFromPayment,
  listCommercialDocuments,
  listDocumentTemplates,
  listVendorBookingOptions,
  listVendorListingOptions,
  recordCommercialDocumentPayment,
  refreshCommercialDocumentShareToken,
  revokeCommercialDocumentShareToken,
  saveCommercialDocumentItems,
  updateCommercialDocument,
  updateDocumentTemplate,
  type CommercialDocumentDetail,
  type CommercialDocumentPaymentMethod,
  type CommercialDocumentRecord,
  type CommercialDocumentShareState,
  type CommercialDocumentStatus,
  type CommercialDocumentType,
  type ProfessionalDocumentTemplateRecord,
  type SaveCommercialDocumentItemInput,
  type VendorBookingOption,
  type VendorListingOption,
} from '@/lib/commercialDocuments';
import { buildDocumentMomentumSummary } from '@/lib/documentMomentum';
import {
  listIncomingDocumentRequests,
  markDocumentRequestViewed,
  respondToDocumentRequest,
  type DocumentRequestRecord,
} from '@/lib/documentRequests';

type CreateDocumentDraft = {
  documentType: CommercialDocumentType;
  title: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  weddingName: string;
  vendorListingId: string;
  vendorId: string;
  templateId: string;
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

type VendorDocumentsPrefillState = {
  createDocumentForVendorId?: string;
  createDocumentRecipientName?: string;
  createDocumentRecipientEmail?: string | null;
  createDocumentRecipientPhone?: string | null;
  createDocumentWeddingName?: string | null;
  createDocumentBookingLabel?: string | null;
};

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

function isTokenActive(expiresAt?: string | null, revokedAt?: string | null) {
  if (revokedAt) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export default function VendorDocuments() {
  const { toast } = useToast();
  const location = useLocation();
  const routePrefill = (location.state as VendorDocumentsPrefillState | null) ?? null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<CommercialDocumentRecord[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestRecord[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CommercialDocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vendorListings, setVendorListings] = useState<VendorListingOption[]>([]);
  const [vendorBookings, setVendorBookings] = useState<VendorBookingOption[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<ProfessionalDocumentTemplateRecord[]>([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState(false);
  const [issuingReceiptId, setIssuingReceiptId] = useState<string | null>(null);
  const [sharingDocumentId, setSharingDocumentId] = useState<string | null>(null);
  const [shareState, setShareState] = useState<CommercialDocumentShareState | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDocumentDraft>({
    documentType: 'quote',
    title: '',
    recipientName: '',
    recipientEmail: '',
    recipientPhone: '',
    weddingName: '',
    vendorListingId: '',
    vendorId: '',
    templateId: '',
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
  const [hasAppliedRoutePrefill, setHasAppliedRoutePrefill] = useState(false);

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
      role: 'vendor',
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
        const [listingsResult, bookingsResult, templatesResult, requestsResult] = await Promise.allSettled([
          listVendorListingOptions(),
          listVendorBookingOptions(),
          listDocumentTemplates({ role: 'vendor' }),
          listIncomingDocumentRequests('vendor'),
        ]);

        const listings = listingsResult.status === 'fulfilled' ? listingsResult.value : [];
        const bookings = bookingsResult.status === 'fulfilled' ? bookingsResult.value : [];
        const templates = templatesResult.status === 'fulfilled' ? templatesResult.value : [];
        const requests = requestsResult.status === 'fulfilled' ? requestsResult.value : [];

        if (cancelled) return;

        setVendorListings(listings);
        setVendorBookings(bookings);
        setDocumentTemplates(templates.filter((template) => template.templateType !== 'contract'));
        setDocumentRequests(requests);
        setCreateDraft((current) => ({
          ...current,
          vendorListingId: current.vendorListingId || listings[0]?.id || '',
        }));

        if (bookingsResult.status === 'rejected') {
          console.error('Could not load vendor booking options:', bookingsResult.reason);
        }
        if (listingsResult.status === 'rejected') {
          console.error('Could not load vendor listing options:', listingsResult.reason);
        }
        if (templatesResult.status === 'rejected') {
          console.error('Could not load vendor template options:', templatesResult.reason);
        }
        if (requestsResult.status === 'rejected') {
          console.error('Could not load vendor document requests:', requestsResult.reason);
        }

        await loadDocuments();
      } catch (error) {
        console.error('Could not load vendor documents workspace:', error);
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
        console.error('Could not refresh vendor documents:', error);
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

  const bookingOptions = useMemo(() => {
    const prefillVendorId = routePrefill?.createDocumentForVendorId?.trim();
    if (!prefillVendorId) return vendorBookings;
    if (vendorBookings.some((booking) => booking.id === prefillVendorId)) return vendorBookings;

    return [
      {
        id: prefillVendorId,
        label: routePrefill?.createDocumentBookingLabel?.trim() || routePrefill?.createDocumentRecipientName?.trim() || 'Workspace relationship',
        coupleName: routePrefill?.createDocumentRecipientName?.trim() || 'Couple account',
        paymentStatus: null,
        quotedAmount: null,
      },
      ...vendorBookings,
    ];
  }, [routePrefill?.createDocumentBookingLabel, routePrefill?.createDocumentForVendorId, routePrefill?.createDocumentRecipientName, vendorBookings]);

  const selectedBooking = useMemo(
    () => bookingOptions.find((booking) => booking.id === createDraft.vendorId) ?? null,
    [bookingOptions, createDraft.vendorId],
  );

  const selectedTemplate = useMemo(
    () => documentTemplates.find((template) => template.id === createDraft.templateId) ?? null,
    [documentTemplates, createDraft.templateId],
  );

  useEffect(() => {
    if (!selectedBooking) return;
    setCreateDraft((current) => ({
      ...current,
      weddingName: current.weddingName || selectedBooking.coupleName,
      title:
        current.title ||
        `${commercialDocumentTypeLabel(current.documentType)} for ${selectedBooking.coupleName}`,
    }));
  }, [selectedBooking]);

  useEffect(() => {
    if (loading || hasAppliedRoutePrefill) return;

    const prefillVendorId = routePrefill?.createDocumentForVendorId?.trim();
    const recipientName = routePrefill?.createDocumentRecipientName?.trim();
    const recipientEmail = routePrefill?.createDocumentRecipientEmail?.trim() || '';
    const recipientPhone = routePrefill?.createDocumentRecipientPhone?.trim() || '';
    const weddingName = routePrefill?.createDocumentWeddingName?.trim() || '';

    if (!prefillVendorId && !recipientName && !recipientEmail && !recipientPhone && !weddingName) {
      setHasAppliedRoutePrefill(true);
      return;
    }

    setCreateDraft((current) => ({
      ...current,
      vendorId: prefillVendorId || current.vendorId,
      recipientName: recipientName || current.recipientName,
      recipientEmail: recipientEmail || current.recipientEmail,
      recipientPhone: recipientPhone || current.recipientPhone,
      weddingName: weddingName || current.weddingName,
      title:
        current.title ||
        `${commercialDocumentTypeLabel(current.documentType)} for ${recipientName || weddingName || 'this wedding'}`,
    }));
    setCreateOpen(true);
    setHasAppliedRoutePrefill(true);
  }, [hasAppliedRoutePrefill, loading, routePrefill]);

  useEffect(() => {
    if (!selectedTemplate) return;

    setCreateDraft((current) => ({
      ...current,
      templateId: selectedTemplate.id,
      documentType: selectedTemplate.templateType === 'contract' ? current.documentType : selectedTemplate.templateType,
      title: selectedTemplate.defaultTitle || current.title || `${commercialDocumentTypeLabel(selectedTemplate.templateType)} for ${selectedBooking?.coupleName ?? 'this wedding'}`,
      notes: selectedTemplate.defaultNotes || current.notes,
      terms: selectedTemplate.defaultTerms || current.terms,
    }));
  }, [selectedTemplate?.id]);

  const createMomentum = useMemo(
    () =>
      buildDocumentMomentumSummary({
        documentType: createDraft.documentType,
        title: createDraft.title,
        recipientName: createDraft.recipientName,
        issueDate: createDraft.issueDate,
        dueDate: createDraft.dueDate,
        notes: createDraft.notes,
        terms: createDraft.terms,
      }),
    [createDraft],
  );

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
        role: 'vendor',
        documentType: createDraft.documentType,
        title: createDraft.title.trim(),
        recipientName: createDraft.recipientName.trim(),
        recipientEmail: createDraft.recipientEmail.trim() || null,
        recipientPhone: createDraft.recipientPhone.trim() || null,
        weddingName: createDraft.weddingName.trim() || null,
        vendorListingId: createDraft.vendorListingId || null,
        vendorId: createDraft.vendorId || null,
        issueDate: createDraft.issueDate || null,
        dueDate: createDraft.documentType === 'receipt' ? null : createDraft.dueDate || null,
        notes: createDraft.notes.trim() || null,
        terms: createDraft.terms.trim() || null,
        status: defaultStatusFor(createDraft.documentType),
        metadata: {
          ...(selectedTemplate
            ? {
              sourceTemplateId: selectedTemplate.id,
              sourceTemplateName: selectedTemplate.name,
            }
            : {}),
          ...(activeRequestId ? { documentRequestId: activeRequestId } : {}),
        },
      });

      if (selectedTemplate) {
        if (selectedTemplate.defaultItems.length > 0) {
          await saveCommercialDocumentItems(
            created.id,
            selectedTemplate.defaultItems.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              sortOrder: index,
            })),
          );
        }
        const currentUseCount = Number(selectedTemplate.metadata?.useCount ?? 0);
        await updateDocumentTemplate(selectedTemplate.id, {
          metadata: {
            ...selectedTemplate.metadata,
            useCount: Number.isFinite(currentUseCount) ? currentUseCount + 1 : 1,
            lastUsedAt: new Date().toISOString(),
          },
        });
      }

      if (activeRequestId) {
        const answeredRequest = await respondToDocumentRequest(activeRequestId, { documentId: created.id });
        setDocumentRequests((current) =>
          current.map((request) => (request.id === answeredRequest.id ? answeredRequest : request)),
        );
      }

      await loadDocuments(created.id);
      setCreateOpen(false);
      setActiveRequestId(null);
      setCreateDraft((current) => ({
        ...current,
        title: '',
        recipientName: '',
        recipientEmail: '',
        recipientPhone: '',
        weddingName: '',
        vendorId: '',
        templateId: '',
        issueDate: todayIso(),
        dueDate: nextDueDateValue(current.documentType),
        notes: '',
        terms: '',
      }));
      toast({
        title: `${commercialDocumentTypeLabel(created.documentType)} created`,
        description: selectedTemplate
          ? `${created.documentNumber} started from ${selectedTemplate.name}.`
          : `${created.documentNumber} is ready for line items and payment tracking.`,
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

  const handleOpenDocumentRequest = async (request: DocumentRequestRecord) => {
    if (request.responseDocumentId) {
      setSelectedDocumentId(request.responseDocumentId);
      return;
    }

    try {
      const viewed = await markDocumentRequestViewed(request.id);
      setDocumentRequests((current) =>
        current.map((item) => (item.id === viewed.id ? viewed : item)),
      );
    } catch (error) {
      console.error('Could not mark vendor document request as viewed:', error);
    }

    setActiveRequestId(request.id);
    setCreateDraft({
      documentType: 'quote',
      title: request.title,
      recipientName: request.requesterName,
      recipientEmail: request.requesterEmail ?? '',
      recipientPhone: request.requesterPhone ?? '',
      weddingName: request.weddingName ?? request.requesterName,
      vendorListingId: request.vendorListingId ?? vendorListings[0]?.id ?? '',
      vendorId: request.vendorId ?? '',
      templateId: documentTemplates.find((template) => template.templateType === 'quote')?.id ?? '',
      issueDate: todayIso(),
      dueDate: nextDueDateValue('quote'),
      notes: request.message ?? '',
      terms: '',
    });
    setCreateOpen(true);
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
      setShareState(await getCommercialDocumentShareState(selectedDetail.id));
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
      setShareState(await getCommercialDocumentShareState(selectedDetail.id));
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

  const handleRefreshShareLink = async () => {
    if (!selectedDetail) return;
    setSharingDocumentId(selectedDetail.id);
    try {
      const state = await refreshCommercialDocumentShareToken(selectedDetail.id);
      setShareState(state);
      toast({
        title: 'Share link refreshed',
        description: 'A new commercial document link is ready to share.',
      });
    } catch (error) {
      console.error('Could not refresh share link:', error);
      toast({
        title: 'Could not refresh share link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharingDocumentId(null);
    }
  };

  const handleRevokeShareLink = async () => {
    if (!selectedDetail) return;
    setSharingDocumentId(selectedDetail.id);
    try {
      const state = await revokeCommercialDocumentShareToken(selectedDetail.id);
      setShareState(state);
      toast({
        title: 'Share link revoked',
        description: 'The current commercial document link is now inactive.',
      });
    } catch (error) {
      console.error('Could not revoke share link:', error);
      toast({
        title: 'Could not revoke share link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharingDocumentId(null);
    }
  };

  useEffect(() => {
    if (!selectedDetail) {
      setShareState(null);
      return;
    }

    void getCommercialDocumentShareState(selectedDetail.id)
      .then(setShareState)
      .catch(() => setShareState(null));
  }, [selectedDetail]);

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
      ? 'Create and track quotes without the rest of the money workflow crowding the page.'
      : activeSection === 'invoices'
        ? 'Stay focused on what is due, what is paid, and what still needs follow-up.'
        : activeSection === 'receipts'
          ? 'Keep issued receipts in one clean record for every real payment you log.'
          : activeSection === 'contracts'
            ? 'Keep agreements separate from billing so your money trail and service terms do not compete for attention.'
            : activeSection === 'templates'
              ? 'Keep reusable starting points together so new documents are faster to prepare.'
              : 'Use the left menu to move between your overview, quotes, invoices, receipts, contracts, and templates.';

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

  const documentPrimaryAction = selectedDetail
    ? selectedDetail.documentType === 'invoice' && selectedDetail.balanceDue > 0
      ? {
          title: 'Record the next payment update',
          body: `${selectedDetail.documentNumber} still has ${formatCurrency(selectedDetail.balanceDue)} outstanding. Record the next payment or share the invoice with the couple so the balance keeps moving.`,
          actionLabel: 'Record payment',
          actionType: 'payment' as const,
        }
      : {
          title: `Keep ${selectedDetail.documentNumber} polished`,
          body: `Update line items, send the share link, print a clean copy, or tighten the document status without leaving this workspace.`,
          actionLabel: 'Copy share link',
          actionType: 'share' as const,
        }
    : {
        title: activeSection === 'quotes'
          ? 'Start the next quote'
          : activeSection === 'invoices'
            ? 'Keep invoice follow-up moving'
            : activeSection === 'receipts'
              ? 'Keep the payment trail complete'
              : 'Keep your document workspace ready',
        body: activeSection === 'quotes'
          ? 'Create a fresh quote for a couple, then convert it once the booking is confirmed.'
          : activeSection === 'invoices'
            ? 'Track what is due, what has been paid, and what still needs a nudge from the invoice workspace.'
            : activeSection === 'receipts'
              ? 'Receipts appear once real payments are recorded, keeping your client-facing money trail tidy.'
              : 'Quotes, invoices, and receipts all stay together here so vendor paperwork feels operational, not scattered.',
        actionLabel: 'New document',
        actionType: 'create' as const,
      };
  const selectedShareActive = isTokenActive(shareState?.expiresAt, shareState?.revokedAt);
  const selectedShareUrl = shareState
    ? buildCommercialDocumentShareUrl(shareState.shareToken, window.location.origin)
    : '';
  const detailMomentum =
    selectedDetail && headerDraft
      ? buildDocumentMomentumSummary({
          documentType: selectedDetail.documentType,
          status: headerDraft.status,
          title: headerDraft.title,
          recipientName: headerDraft.recipientName,
          issueDate: headerDraft.issueDate,
          dueDate: headerDraft.dueDate,
          notes: headerDraft.notes,
          terms: headerDraft.terms,
          items: itemDrafts.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity ?? 1),
            unitPrice: Number(item.unitPrice ?? 0),
          })),
          totalAmount: selectedDetail.totalAmount,
          amountPaid: selectedDetail.amountPaid,
          shareActive: selectedShareActive,
        })
      : null;

  if (activeSection === 'contracts') {
    return (
      <ContractsWorkspace
        role="vendor"
        vendorListings={vendorListings}
        vendorBookings={vendorBookings}
      />
    );
  }

  if (activeSection === 'templates') {
    return <TemplatesWorkspace role="vendor" />;
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-28">
      <Card className="border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.08),rgba(255,255,255,0.98)_32%,rgba(255,247,242,0.9))] shadow-card">
        <CardContent className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Commercial documents</p>
                <InfoTip content={pageDescription} />
              </div>
              <CardTitle className="font-display text-3xl text-foreground sm:text-4xl">{pageTitle}</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Create, send, and track client paperwork in one place.
              </CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DocumentMetricLink to="/vendor-documents" label="All documents" value={stats.total} hint="Open everything" />
              <DocumentMetricLink to="/vendor-documents/quotes" label="Quotes" value={stats.quotes} hint="Open quotes" />
              <DocumentMetricLink to="/vendor-documents/receipts" label="Money received" value={formatCurrency(stats.collected)} hint="Open receipts" tone="success" />
              <DocumentMetricLink to="/vendor-documents/invoices" label="Money still due" value={formatCurrency(stats.outstanding)} hint="Open invoices" tone="warning" />
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-border/70 bg-white/85 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Next Best Move</p>
              <InfoTip content={documentPrimaryAction.body} />
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-foreground">{documentPrimaryAction.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Best next move right now.</p>
            <div className="mt-5 space-y-3">
              <Button
                onClick={() => {
                  if (documentPrimaryAction.actionType === 'payment') {
                    setPaymentOpen(true);
                    return;
                  }
                  if (documentPrimaryAction.actionType === 'share') {
                    void handleCopyShareLink();
                    return;
                  }
                  setCreateOpen(true);
                }}
                className="w-full gap-2"
                disabled={documentPrimaryAction.actionType === 'share' && !!selectedDetail && sharingDocumentId === selectedDetail.id}
              >
                <FilePlus2 className="h-4 w-4" />
                {documentPrimaryAction.actionLabel}
              </Button>
              <div className="rounded-2xl border border-border/70 bg-muted/15 p-4 text-sm text-muted-foreground">
                {documents.length === 0
                  ? 'No live documents yet.'
                  : `${documents.length} document${documents.length === 1 ? '' : 's'} visible in this section.`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeSection === 'overview' && (
        <DocumentActionOverview
          requests={documentRequests}
          documents={documents}
          loading={loading}
          onOpenRequest={(request) => void handleOpenDocumentRequest(request)}
          onOpenDocument={setSelectedDocumentId}
        />
      )}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl">Document library</CardTitle>
                <CardDescription>Filter your live documents.</CardDescription>
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
              <div className="flex min-h-12 items-center rounded-xl border border-border bg-muted/20 px-4 py-2 text-sm leading-5 text-muted-foreground">
                Viewing <span className="mx-1 break-words font-medium text-foreground">{pageTitle}</span> · {documents.length} result{documents.length === 1 ? '' : 's'}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                <FileSpreadsheet className="mx-auto mb-3 h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">No documents yet</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyStateCopy}</p>
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
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{document.documentNumber}</p>
                          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{document.title}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium leading-5 text-foreground">{document.recipientName}</p>
                          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{document.weddingName || 'No wedding label'}</p>
                        </div>
                        <div className="text-sm font-semibold text-foreground">{formatCurrency(document.totalAmount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {document.documentType !== 'receipt' && document.dueDate
                            ? new Date(document.dueDate).toLocaleDateString()
                            : 'No due date'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{commercialDocumentTypeLabel(document.documentType)}</Badge>
                          <Badge variant={document.status === 'paid' || document.status === 'accepted' || document.status === 'issued' ? 'success' : 'warning'}>
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                <>
                <div className="flex w-full flex-col gap-4 lg:w-auto lg:max-w-[520px] lg:items-end">
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
                    disabled={sharingDocumentId === selectedDetail.id || (!!shareState && !selectedShareActive)}
                  >
                    {sharingDocumentId === selectedDetail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleEmailShare}
                    disabled={sharingDocumentId === selectedDetail.id || (!!shareState && !selectedShareActive)}
                  >
                    <Mail className="h-4 w-4" />
                    Email link
                  </Button>
                  <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
                <div className="w-full rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedShareActive ? 'success' : 'outline'}>
                      {selectedShareActive ? 'Share link active' : 'Share link inactive'}
                    </Badge>
                    {shareState?.expiresAt && (
                      <span className="text-xs text-muted-foreground">
                        Expires {new Date(shareState.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    {typeof shareState?.accessCount === 'number' && (
                      <span className="text-xs text-muted-foreground">
                        {shareState.accessCount} public open{shareState.accessCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {selectedShareUrl ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Input readOnly value={selectedShareUrl} className="text-xs" />
                      <Button size="icon" variant="outline" disabled={!selectedShareActive} onClick={handleCopyShareLink}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {shareState?.lastAccessedAt
                      ? `Last opened ${new Date(shareState.lastAccessedAt).toLocaleString()}`
                      : 'No public opens recorded yet.'}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button variant="outline" className="gap-2" onClick={handleRefreshShareLink} disabled={sharingDocumentId === selectedDetail.id}>
                      {sharingDocumentId === selectedDetail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                      Refresh Link
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={handleRevokeShareLink}
                      disabled={sharingDocumentId === selectedDetail.id || !shareState || !selectedShareActive}
                    >
                      <ShieldOff className="h-4 w-4" />
                      Revoke Link
                    </Button>
                  </div>
                </div>
                </div>
                </>
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
                {detailMomentum && (
                  <DocumentMomentumCard
                    title="Document momentum"
                    subtitle="This tracks how ready the document is to share, convert, or collect against."
                    summary={detailMomentum}
                  />
                )}
                <section className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-document-title">Title</Label>
                    <Input
                      id="vendor-document-title"
                      value={headerDraft.title}
                      onChange={(event) => setHeaderDraft((current) => current ? { ...current, title: event.target.value } : current)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-document-status">Status</Label>
                    <Select
                      value={headerDraft.status}
                      onValueChange={(value) =>
                        setHeaderDraft((current) =>
                          current ? { ...current, status: value as CommercialDocumentStatus } : current,
                        )
                      }
                    >
                      <SelectTrigger id="vendor-document-status" aria-label="Status">
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
                    <Label htmlFor="vendor-document-recipient-name">Recipient name</Label>
                    <Input
                      id="vendor-document-recipient-name"
                      value={headerDraft.recipientName}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, recipientName: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-document-wedding-name">Wedding name</Label>
                    <Input
                      id="vendor-document-wedding-name"
                      value={headerDraft.weddingName}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, weddingName: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-document-recipient-email">Recipient email</Label>
                    <Input
                      id="vendor-document-recipient-email"
                      type="email"
                      value={headerDraft.recipientEmail}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, recipientEmail: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-document-recipient-phone">Recipient phone</Label>
                    <Input
                      id="vendor-document-recipient-phone"
                      value={headerDraft.recipientPhone}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, recipientPhone: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-document-issue-date">Issue date</Label>
                    <Input
                      id="vendor-document-issue-date"
                      type="date"
                      value={headerDraft.issueDate}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, issueDate: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-document-due-date">Due date</Label>
                    <Input
                      id="vendor-document-due-date"
                      type="date"
                      value={headerDraft.dueDate}
                      disabled={selectedDetail.documentType === 'receipt'}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, dueDate: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="vendor-document-notes">Notes</Label>
                    <Textarea
                      id="vendor-document-notes"
                      rows={3}
                      value={headerDraft.notes}
                      onChange={(event) =>
                        setHeaderDraft((current) => current ? { ...current, notes: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="vendor-document-terms">Terms</Label>
                    <Textarea
                      id="vendor-document-terms"
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
                              <Label htmlFor={`vendor-line-item-description-${index}`}>Description</Label>
                              <Input
                                id={`vendor-line-item-description-${index}`}
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
                              <Label htmlFor={`vendor-line-item-quantity-${index}`}>Qty</Label>
                              <Input
                                id={`vendor-line-item-quantity-${index}`}
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
                              <Label htmlFor={`vendor-line-item-unit-price-${index}`}>Unit price</Label>
                              <Input
                                id={`vendor-line-item-unit-price-${index}`}
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
                    <div className="rounded-2xl border border-[hsl(var(--info-soft-border))] bg-[hsl(var(--info-soft))] p-4 text-sm text-info">
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setActiveRequestId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeRequestId ? 'Review quote request' : 'Create a commercial document'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start from template</Label>
              <Select
                value={createDraft.templateId || 'none'}
                onValueChange={(value) =>
                  setCreateDraft((current) => ({
                    ...current,
                    templateId: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose reusable starter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Start blank</SelectItem>
                  {documentTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Document type</Label>
              <Select
                value={createDraft.documentType}
                onValueChange={(value) =>
                  setCreateDraft((current) => ({
                    ...current,
                    documentType: value as CommercialDocumentType,
                    templateId:
                      current.templateId &&
                      documentTemplates.find((template) => template.id === current.templateId)?.templateType === value
                        ? current.templateId
                        : '',
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
              <Label>Vendor listing</Label>
              <Select
                value={createDraft.vendorListingId || 'none'}
                onValueChange={(value) =>
                  setCreateDraft((current) => ({
                    ...current,
                    vendorListingId: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose listing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No listing link</SelectItem>
                  {vendorListings.map((listing) => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.label}
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
                placeholder="e.g. Photography quote for Mary & James"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient name</Label>
              <Input
                value={createDraft.recipientName}
                onChange={(event) => setCreateDraft((current) => ({ ...current, recipientName: event.target.value }))}
                placeholder="Couple, planner, or contact name"
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
            <div className="space-y-2">
              <Label>Link to vendor booking</Label>
              <Select
                value={createDraft.vendorId || 'none'}
                onValueChange={(value) =>
                  setCreateDraft((current) => ({ ...current, vendorId: value === 'none' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose booking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No booking link</SelectItem>
                  {vendorBookings.map((booking) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="md:col-span-2">
              <DocumentMomentumCard
                title="Document momentum"
                subtitle="Fill the key fields now so the document starts in a send-ready state."
                summary={createMomentum}
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
              <Label htmlFor="vendor-payment-amount">Amount</Label>
              <Input
                id="vendor-payment-amount"
                type="number"
                min="0"
                value={paymentDraft.amount}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-payment-date">Payment date</Label>
              <Input
                id="vendor-payment-date"
                type="date"
                value={paymentDraft.paymentDate}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-payment-method">Payment method</Label>
              <Select
                value={paymentDraft.paymentMethod}
                onValueChange={(value) =>
                  setPaymentDraft((current) => ({
                    ...current,
                    paymentMethod: value as CommercialDocumentPaymentMethod,
                  }))
                }
              >
                <SelectTrigger id="vendor-payment-method" aria-label="Payment method">
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
              <Label htmlFor="vendor-payment-reference">Reference</Label>
              <Input
                id="vendor-payment-reference"
                value={paymentDraft.reference}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))}
                placeholder="M-Pesa code, bank ref, or note"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-payment-notes">Notes</Label>
              <Textarea
                id="vendor-payment-notes"
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
