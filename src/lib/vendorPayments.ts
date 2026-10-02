import { supabase } from '@/integrations/supabase/client';

export const vendorPaymentStatuses = [
  'unpaid',
  'deposit_due',
  'deposit_paid',
  'part_paid',
  'paid_full',
] as const;

export type VendorPaymentStatus = typeof vendorPaymentStatuses[number];

export function deriveVendorPaymentStatus(input: {
  totalCost?: number | string | null;
  depositRequired?: number | string | null;
  totalPaid?: number | string | null;
}): VendorPaymentStatus {
  const totalCost = Math.max(Number(input.totalCost ?? 0), 0);
  const depositRequired = Math.max(Number(input.depositRequired ?? 0), 0);
  const totalPaid = Math.max(Number(input.totalPaid ?? 0), 0);

  if (totalCost > 0 && totalPaid >= totalCost) return 'paid_full';
  if (totalPaid <= 0) return depositRequired > 0 ? 'deposit_due' : 'unpaid';
  if (depositRequired > 0 && totalPaid === depositRequired) return 'deposit_paid';
  return 'part_paid';
}

export function totalRecordedVendorPayments(
  payments: Array<{ amount: number | string | null | undefined }>,
) {
  return payments.reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
}

export function vendorPaymentStatusLabel(status: VendorPaymentStatus | string | null | undefined) {
  switch (status) {
    case 'deposit_due':
      return 'Deposit due';
    case 'deposit_paid':
      return 'Deposit paid';
    case 'part_paid':
      return 'Part paid';
    case 'paid_full':
      return 'Paid in full';
    case 'unpaid':
    default:
      return 'Unpaid';
  }
}

export function vendorPaymentStatusTone(status: VendorPaymentStatus | string | null | undefined) {
  switch (status) {
    case 'paid_full':
      return 'default' as const;
    case 'deposit_paid':
    case 'part_paid':
      return 'secondary' as const;
    case 'deposit_due':
      return 'outline' as const;
    case 'unpaid':
    default:
      return 'destructive' as const;
  }
}

export async function updateVendorPaymentState(input: {
  vendorId: string;
  contractAmount?: number | null;
  depositAmount?: number;
  amountPaid?: number;
  paymentStatus?: VendorPaymentStatus;
  paymentDueDate?: string | null;
}) {
  const { data, error } = await supabase.rpc('update_vendor_payment_state', {
    vendor_id_input: input.vendorId,
    contract_amount_input: input.contractAmount ?? null,
    deposit_amount_input: input.depositAmount ?? 0,
    amount_paid_input: input.amountPaid ?? 0,
    payment_status_input: input.paymentStatus ?? 'unpaid',
    payment_due_date_input: input.paymentDueDate ?? null,
  });

  if (error) throw error;
  return data;
}
