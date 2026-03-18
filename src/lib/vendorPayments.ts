import { supabase } from '@/integrations/supabase/client';

export const vendorPaymentStatuses = [
  'unpaid',
  'deposit_due',
  'deposit_paid',
  'part_paid',
  'paid_full',
] as const;

export type VendorPaymentStatus = typeof vendorPaymentStatuses[number];

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
