import { supabase } from '@/integrations/supabase/client';

export type VendorEnquiryResponseChoice = 'available' | 'unavailable' | 'needs_details';

export type VendorEnquiryResponse = {
  response: VendorEnquiryResponseChoice;
  message: string | null;
  quoteAmount: number | null;
  quoteCurrency: string | null;
  quoteValidUntil: string | null;
  createdAt: string;
};

export type VendorEnquiryResponseContext = {
  available: boolean;
  canRespond: boolean;
  vendorName?: string;
  recipientName?: string;
  senderName?: string;
  subject?: string;
  message?: string;
  expiresAt?: string;
  latestResponse?: VendorEnquiryResponse | null;
};

const db = supabase as any;

export async function getVendorEnquiryResponseContext(token: string) {
  const { data, error } = await db.rpc('get_vendor_enquiry_response_context', { _response_token: token });
  if (error) throw error;
  return data as VendorEnquiryResponseContext;
}

export async function respondToVendorEnquiry(input: {
  token: string;
  response: VendorEnquiryResponseChoice;
  message?: string;
  quoteAmount?: number | null;
  quoteCurrency?: string;
  quoteValidUntil?: string | null;
}) {
  const { data, error } = await db.rpc('respond_to_vendor_enquiry', {
    _response_token: input.token,
    _response: input.response,
    _message: input.message?.trim() || null,
    _quote_amount: input.response === 'available' ? input.quoteAmount ?? null : null,
    _quote_currency: input.quoteCurrency?.trim().toUpperCase() || 'KES',
    _quote_valid_until: input.response === 'available' ? input.quoteValidUntil || null : null,
  });
  if (error) throw error;
  return data as VendorEnquiryResponse;
}

export function vendorEnquiryResponseLabel(response: string | null | undefined) {
  if (response === 'available') return 'Available';
  if (response === 'unavailable') return 'Unavailable';
  if (response === 'needs_details') return 'Needs more details';
  return 'Awaiting response';
}
