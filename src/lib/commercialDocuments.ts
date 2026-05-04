import { supabase } from '@/integrations/supabase/client';

export const commercialDocumentRoleOptions = ['vendor', 'planner'] as const;
export type CommercialDocumentRole = (typeof commercialDocumentRoleOptions)[number];

export const commercialDocumentTypeOptions = ['quote', 'invoice', 'receipt'] as const;
export type CommercialDocumentType = (typeof commercialDocumentTypeOptions)[number];

export const commercialDocumentPaymentMethodOptions = ['mpesa', 'bank', 'cash', 'card', 'other'] as const;
export type CommercialDocumentPaymentMethod = (typeof commercialDocumentPaymentMethodOptions)[number];

export const commercialDocumentStatuses = {
  quote: ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const,
  invoice: ['draft', 'sent', 'part_paid', 'paid', 'void'] as const,
  receipt: ['issued', 'void'] as const,
} as const;

export type QuoteStatus = (typeof commercialDocumentStatuses.quote)[number];
export type InvoiceStatus = (typeof commercialDocumentStatuses.invoice)[number];
export type ReceiptStatus = (typeof commercialDocumentStatuses.receipt)[number];
export type CommercialDocumentStatus = QuoteStatus | InvoiceStatus | ReceiptStatus;

export type CommercialDocumentRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  role: CommercialDocumentRole;
  documentType: CommercialDocumentType;
  documentNumber: string;
  title: string;
  status: CommercialDocumentStatus;
  currency: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  weddingName: string | null;
  clientId: string | null;
  vendorListingId: string | null;
  vendorId: string | null;
  quoteSourceId: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
  notes: string | null;
  terms: string | null;
  metadata: Record<string, unknown>;
};

export type CommercialDocumentItemRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  documentId: string;
  sortOrder: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  metadata: Record<string, unknown>;
};

export type CommercialDocumentPaymentRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  documentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: CommercialDocumentPaymentMethod;
  reference: string | null;
  notes: string | null;
  recordedBy: string;
  budgetPaymentId: string | null;
};

export type CommercialDocumentDetail = CommercialDocumentRecord & {
  items: CommercialDocumentItemRecord[];
  payments: CommercialDocumentPaymentRecord[];
};

export type CommercialDocumentListFilters = {
  role?: CommercialDocumentRole;
  documentType?: CommercialDocumentType;
  status?: CommercialDocumentStatus;
  clientId?: string | null;
  vendorListingId?: string | null;
  vendorId?: string | null;
  search?: string;
  limit?: number;
};

export type PlannerClientOption = {
  id: string;
  label: string;
  email: string | null;
  weddingDate: string | null;
  weddingLocation: string | null;
};

export type VendorListingOption = {
  id: string;
  label: string;
  category: string | null;
  primaryCounty: string | null;
  primaryTown: string | null;
};

export type VendorBookingOption = {
  id: string;
  label: string;
  coupleName: string;
  paymentStatus: string | null;
  quotedAmount: number | null;
};

export type CreateCommercialDocumentInput = {
  role: CommercialDocumentRole;
  documentType: CommercialDocumentType;
  title: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  clientId?: string | null;
  vendorListingId?: string | null;
  vendorId?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  weddingName?: string | null;
  status?: CommercialDocumentStatus | null;
  documentNumber?: string | null;
  currency?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateCommercialDocumentInput = Partial<
  Omit<
    CommercialDocumentRecord,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'userId'
    | 'documentType'
    | 'role'
    | 'documentNumber'
    | 'subtotal'
    | 'totalAmount'
    | 'amountPaid'
    | 'balanceDue'
    | 'paidDate'
  >
> & {
  metadata?: Record<string, unknown>;
};

export type SaveCommercialDocumentItemInput = {
  description: string;
  quantity?: number;
  unitPrice?: number;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};

export type RecordCommercialDocumentPaymentInput = {
  amount: number;
  paymentDate?: string | null;
  paymentMethod: CommercialDocumentPaymentMethod;
  reference?: string | null;
  notes?: string | null;
  budgetPaymentId?: string | null;
};

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapCommercialDocument(row: Record<string, unknown>): CommercialDocumentRecord {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    userId: String(row.user_id ?? ''),
    role: row.role === 'planner' ? 'planner' : 'vendor',
    documentType:
      row.document_type === 'invoice' || row.document_type === 'receipt' ? row.document_type : 'quote',
    documentNumber: String(row.document_number ?? ''),
    title: String(row.title ?? ''),
    status: String(row.status ?? 'draft') as CommercialDocumentStatus,
    currency: String(row.currency ?? 'KES'),
    recipientName: String(row.recipient_name ?? ''),
    recipientEmail: typeof row.recipient_email === 'string' ? row.recipient_email : null,
    recipientPhone: typeof row.recipient_phone === 'string' ? row.recipient_phone : null,
    weddingName: typeof row.wedding_name === 'string' ? row.wedding_name : null,
    clientId: typeof row.client_id === 'string' ? row.client_id : null,
    vendorListingId: typeof row.vendor_listing_id === 'string' ? row.vendor_listing_id : null,
    vendorId: typeof row.vendor_id === 'string' ? row.vendor_id : null,
    quoteSourceId: typeof row.quote_source_id === 'string' ? row.quote_source_id : null,
    subtotal: toNumber(row.subtotal),
    discountAmount: toNumber(row.discount_amount),
    taxAmount: toNumber(row.tax_amount),
    totalAmount: toNumber(row.total_amount),
    amountPaid: toNumber(row.amount_paid),
    balanceDue: toNumber(row.balance_due),
    issueDate: String(row.issue_date ?? ''),
    dueDate: typeof row.due_date === 'string' ? row.due_date : null,
    paidDate: typeof row.paid_date === 'string' ? row.paid_date : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    terms: typeof row.terms === 'string' ? row.terms : null,
    metadata: toObject(row.metadata),
  };
}

function mapCommercialDocumentItem(row: Record<string, unknown>): CommercialDocumentItemRecord {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    documentId: String(row.document_id ?? ''),
    sortOrder: toNumber(row.sort_order),
    description: String(row.description ?? ''),
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price),
    lineTotal: toNumber(row.line_total),
    metadata: toObject(row.metadata),
  };
}

function mapCommercialDocumentPayment(row: Record<string, unknown>): CommercialDocumentPaymentRecord {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    documentId: String(row.document_id ?? ''),
    amount: toNumber(row.amount),
    paymentDate: String(row.payment_date ?? ''),
    paymentMethod:
      row.payment_method === 'mpesa' ||
      row.payment_method === 'bank' ||
      row.payment_method === 'cash' ||
      row.payment_method === 'card'
        ? row.payment_method
        : 'other',
    reference: typeof row.reference === 'string' ? row.reference : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    recordedBy: String(row.recorded_by ?? ''),
    budgetPaymentId: typeof row.budget_payment_id === 'string' ? row.budget_payment_id : null,
  };
}

function mapCommercialDocumentDetail(row: Record<string, unknown>): CommercialDocumentDetail {
  const document = mapCommercialDocument(row);
  const items = Array.isArray(row.commercial_document_items)
    ? row.commercial_document_items.map((item) => mapCommercialDocumentItem(item as Record<string, unknown>))
    : [];
  const payments = Array.isArray(row.commercial_document_payments)
    ? row.commercial_document_payments.map((payment) =>
        mapCommercialDocumentPayment(payment as Record<string, unknown>),
      )
    : [];

  return {
    ...document,
    items: items.sort((a, b) => a.sortOrder - b.sortOrder),
    payments: payments.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)),
  };
}

export function commercialDocumentStatusOptionsFor(type: CommercialDocumentType) {
  return [...commercialDocumentStatuses[type]];
}

export function commercialDocumentTypeLabel(type: CommercialDocumentType | string | null | undefined) {
  switch (type) {
    case 'invoice':
      return 'Invoice';
    case 'receipt':
      return 'Receipt';
    case 'quote':
    default:
      return 'Quote';
  }
}

export function commercialDocumentStatusLabel(status: CommercialDocumentStatus | string | null | undefined) {
  switch (status) {
    case 'sent':
      return 'Sent';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'expired':
      return 'Expired';
    case 'part_paid':
      return 'Part paid';
    case 'paid':
      return 'Paid';
    case 'issued':
      return 'Issued';
    case 'void':
      return 'Void';
    case 'draft':
    default:
      return 'Draft';
  }
}

export function commercialDocumentPaymentMethodLabel(method: CommercialDocumentPaymentMethod | string | null | undefined) {
  switch (method) {
    case 'mpesa':
      return 'M-Pesa';
    case 'bank':
      return 'Bank';
    case 'cash':
      return 'Cash';
    case 'card':
      return 'Card';
    case 'other':
    default:
      return 'Other';
  }
}

export async function listCommercialDocuments(filters: CommercialDocumentListFilters = {}) {
  const db = supabase as any;
  let query = db
    .from('commercial_documents')
    .select('*')
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.documentType) query = query.eq('document_type', filters.documentType);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.vendorListingId) query = query.eq('vendor_listing_id', filters.vendorListingId);
  if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
  if (filters.limit) query = query.limit(filters.limit);
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(
      `document_number.ilike.%${search}%,title.ilike.%${search}%,recipient_name.ilike.%${search}%,wedding_name.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map(mapCommercialDocument);
}

export async function getCommercialDocument(documentId: string) {
  const db = supabase as any;
  const { data, error } = await db
    .from('commercial_documents')
    .select('*, commercial_document_items(*), commercial_document_payments(*)')
    .eq('id', documentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapCommercialDocumentDetail(data as Record<string, unknown>);
}

export async function createCommercialDocument(input: CreateCommercialDocumentInput) {
  const { data, error } = await (supabase as any).rpc('create_commercial_document', {
    _role: input.role,
    _document_type: input.documentType,
    _title: input.title,
    _recipient_name: input.recipientName,
    _recipient_email: input.recipientEmail ?? null,
    _recipient_phone: input.recipientPhone ?? null,
    _client_id: input.clientId ?? null,
    _vendor_listing_id: input.vendorListingId ?? null,
    _vendor_id: input.vendorId ?? null,
    _issue_date: input.issueDate ?? null,
    _due_date: input.dueDate ?? null,
    _notes: input.notes ?? null,
    _terms: input.terms ?? null,
    _wedding_name: input.weddingName ?? null,
    _status: input.status ?? null,
    _document_number: input.documentNumber ?? null,
    _currency: input.currency ?? 'KES',
    _metadata: input.metadata ?? {},
  });

  if (error) throw error;
  return mapCommercialDocument(data as Record<string, unknown>);
}

export async function updateCommercialDocument(documentId: string, input: UpdateCommercialDocumentInput) {
  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.status !== undefined) payload.status = input.status;
  if (input.currency !== undefined) payload.currency = input.currency;
  if (input.recipientName !== undefined) payload.recipient_name = input.recipientName;
  if (input.recipientEmail !== undefined) payload.recipient_email = input.recipientEmail;
  if (input.recipientPhone !== undefined) payload.recipient_phone = input.recipientPhone;
  if (input.weddingName !== undefined) payload.wedding_name = input.weddingName;
  if (input.clientId !== undefined) payload.client_id = input.clientId;
  if (input.vendorListingId !== undefined) payload.vendor_listing_id = input.vendorListingId;
  if (input.vendorId !== undefined) payload.vendor_id = input.vendorId;
  if (input.discountAmount !== undefined) payload.discount_amount = input.discountAmount;
  if (input.taxAmount !== undefined) payload.tax_amount = input.taxAmount;
  if (input.issueDate !== undefined) payload.issue_date = input.issueDate;
  if (input.dueDate !== undefined) payload.due_date = input.dueDate;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.terms !== undefined) payload.terms = input.terms;
  if (input.metadata !== undefined) payload.metadata = input.metadata;

  const db = supabase as any;
  const { data, error } = await db
    .from('commercial_documents')
    .update(payload)
    .eq('id', documentId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Could not update commercial document.');
  return mapCommercialDocument(data as Record<string, unknown>);
}

export async function deleteCommercialDocument(documentId: string) {
  const db = supabase as any;
  const { error } = await db.from('commercial_documents').delete().eq('id', documentId);
  if (error) throw error;
}

export async function saveCommercialDocumentItems(documentId: string, items: SaveCommercialDocumentItemInput[]) {
  const { data, error } = await (supabase as any).rpc('save_commercial_document_items', {
    _document_id: documentId,
    _items: items.map((item, index) => ({
      description: item.description,
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unitPrice ?? 0),
      sort_order: Number(item.sortOrder ?? index),
      metadata: item.metadata ?? {},
    })),
  });

  if (error) throw error;
  return mapCommercialDocument(data as Record<string, unknown>);
}

export async function recordCommercialDocumentPayment(
  documentId: string,
  input: RecordCommercialDocumentPaymentInput,
) {
  const { data, error } = await (supabase as any).rpc('record_commercial_document_payment', {
    _document_id: documentId,
    _amount: input.amount,
    _payment_date: input.paymentDate ?? null,
    _payment_method: input.paymentMethod,
    _reference: input.reference ?? null,
    _notes: input.notes ?? null,
    _budget_payment_id: input.budgetPaymentId ?? null,
  });

  if (error) throw error;
  return mapCommercialDocumentPayment(data as Record<string, unknown>);
}

export async function convertQuoteToInvoice(
  quoteId: string,
  options: { issueDate?: string | null; dueDate?: string | null } = {},
) {
  const { data, error } = await (supabase as any).rpc('convert_quote_to_invoice', {
    _quote_id: quoteId,
    _issue_date: options.issueDate ?? null,
    _due_date: options.dueDate ?? null,
  });

  if (error) throw error;
  return mapCommercialDocument(data as Record<string, unknown>);
}

export async function issueReceiptFromPayment(documentId: string, paymentId: string) {
  const { data, error } = await (supabase as any).rpc('issue_receipt_from_payment', {
    _document_id: documentId,
    _payment_id: paymentId,
  });

  if (error) throw error;
  return mapCommercialDocument(data as Record<string, unknown>);
}

export async function listPlannerClientOptions() {
  const db = supabase as any;
  const { data, error } = await db
    .from('planner_clients')
    .select('id, client_name, partner_name, email, wedding_date, wedding_location')
    .order('client_name', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const clientName = String(row.client_name ?? 'Client');
    const partnerName = typeof row.partner_name === 'string' ? row.partner_name : null;
    const label = partnerName ? `${clientName} & ${partnerName}` : clientName;

    return {
      id: String(row.id),
      label,
      email: typeof row.email === 'string' ? row.email : null,
      weddingDate: typeof row.wedding_date === 'string' ? row.wedding_date : null,
      weddingLocation: typeof row.wedding_location === 'string' ? row.wedding_location : null,
    } satisfies PlannerClientOption;
  });
}

export async function listVendorListingOptions() {
  const db = supabase as any;
  const { data, error } = await db
    .from('vendor_listings')
    .select('id, business_name, category, primary_county, primary_town')
    .order('business_name', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    label: String(row.business_name ?? 'Vendor listing'),
    category: typeof row.category === 'string' ? row.category : null,
    primaryCounty: typeof row.primary_county === 'string' ? row.primary_county : null,
    primaryTown: typeof row.primary_town === 'string' ? row.primary_town : null,
  })) as VendorListingOption[];
}

export async function listVendorBookingOptions() {
  const db = supabase as any;
  const { data, error } = await db
    .from('vendors')
    .select('id, name, quoted_amount, payment_status, wedding_id, weddings(name)')
    .order('name', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const wedding = Array.isArray(row.weddings)
      ? (row.weddings[0] as Record<string, unknown> | undefined)
      : (row.weddings as Record<string, unknown> | null | undefined);
    const coupleName = typeof wedding?.name === 'string' ? wedding.name : 'Wedding workspace';

    return {
      id: String(row.id),
      label: `${String(row.name ?? 'Booking')} · ${coupleName}`,
      coupleName,
      paymentStatus: typeof row.payment_status === 'string' ? row.payment_status : null,
      quotedAmount: row.quoted_amount == null ? null : toNumber(row.quoted_amount),
    } satisfies VendorBookingOption;
  });
}
