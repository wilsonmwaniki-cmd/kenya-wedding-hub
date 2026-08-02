import { supabase } from '@/integrations/supabase/client';
import {
  buildProfessionalContractShareUrl,
  professionalContractStatusLabel,
  type ProfessionalContractStatus,
} from '@/lib/commercialDocuments';

export type CoupleVendorContract = {
  contractId: string;
  title: string;
  status: ProfessionalContractStatus;
  sentAt: string | null;
  signedAt: string | null;
  updatedAt: string;
  shareToken: string | null;
  shareExpiresAt: string | null;
};

type CoupleVendorContractRow = {
  contract_id: string;
  title: string;
  status: ProfessionalContractStatus;
  sent_at: string | null;
  signed_at: string | null;
  updated_at: string;
  share_token: string | null;
  share_expires_at: string | null;
};

type ContractRpcClient = {
  rpc: (
    functionName: 'get_couple_vendor_contract',
    parameters: { _vendor_id: string },
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export async function getCoupleVendorContract(vendorId: string): Promise<CoupleVendorContract | null> {
  const { data, error } = await (supabase as unknown as ContractRpcClient).rpc('get_couple_vendor_contract', {
    _vendor_id: vendorId,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as CoupleVendorContractRow | null | undefined;
  if (!row) return null;

  return {
    contractId: row.contract_id,
    title: row.title,
    status: row.status,
    sentAt: row.sent_at,
    signedAt: row.signed_at,
    updatedAt: row.updated_at,
    shareToken: row.share_token,
    shareExpiresAt: row.share_expires_at,
  };
}

export function coupleVendorContractStatusLabel(contract: CoupleVendorContract) {
  switch (contract.status) {
    case 'draft':
      return 'Being prepared';
    case 'sent':
    case 'awaiting_signature':
      return 'Ready for your signature';
    case 'countersigned':
      return 'Signed by you';
    case 'completed':
      return 'Complete';
    case 'cancelled':
      return 'Cancelled';
    default:
      return professionalContractStatusLabel(contract.status);
  }
}

export function coupleVendorContractMessage(contract: CoupleVendorContract) {
  switch (contract.status) {
    case 'draft':
      return 'The vendor is preparing this contract. It will appear here when they send it.';
    case 'sent':
      return contract.shareToken
        ? 'The vendor has shared this contract for your review.'
        : 'The vendor sent this contract, but its private link is not currently available.';
    case 'awaiting_signature':
      return contract.shareToken
        ? 'This contract is ready for your review and signature.'
        : 'This contract is awaiting signature. Ask the vendor to refresh its private link.';
    case 'countersigned':
      return contract.shareToken
        ? 'You have signed this contract. The vendor has been asked to countersign it.'
        : 'You have signed this contract. The vendor has been asked to countersign it, but the private link is not currently available.';
    case 'completed':
      return contract.shareToken
        ? 'This contract is complete. You can open the signed copy here.'
        : 'This contract is complete. Ask the vendor to share a new private link if you need the signed copy.';
    case 'cancelled':
      return 'The vendor cancelled this contract. Ask them to create a new one if you are continuing together.';
    default:
      return 'Contract progress is managed by the vendor from their professional account.';
  }
}

export function coupleVendorContractShareUrl(contract: CoupleVendorContract, origin?: string) {
  if (!contract.shareToken) return null;
  return buildProfessionalContractShareUrl(contract.shareToken, origin);
}
