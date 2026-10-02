import { supabase } from '@/integrations/supabase/client';

export const EXTERNAL_CONTRACT_MAX_BYTES = 10 * 1024 * 1024;

export type ExternalContractPayment = {
  title: string;
  amount: string;
  dueDate: string;
  confidence?: number;
};

export type ExternalContractFacts = {
  vendorName: string | null;
  clientName: string | null;
  eventDate: string | null;
  location: string | null;
  currency: string | null;
  totalAmount: string | null;
  depositAmount: string | null;
  paymentSchedule: ExternalContractPayment[];
  serviceScope: string[];
  deliverables: string[];
  cancellation: string | null;
  postponement: string | null;
  forceMajeure: string | null;
  overtime: string | null;
  travel: string | null;
  termination: string | null;
  disputeResolution: string | null;
  unknowns: string[];
  overallConfidence?: number;
};

export type ExternalContractIngestion = {
  id: string;
  owner_user_id: string;
  wedding_id: string;
  agreement_id: string | null;
  original_filename: string;
  storage_path: string;
  status: 'awaiting_upload' | 'processing' | 'extracted_pending_cleanup' | 'extracted' | 'confirmed' | 'failed' | 'discarded';
  extracted_data: ExternalContractFacts | null;
  confirmed_data: ExternalContractFacts | null;
  failure_message: string | null;
  file_deleted_at: string | null;
  created_at: string;
};

export type AgreementOption = { id: string; vendorName: string; title: string };

export function validateExternalContractFile(file: Pick<File, 'name' | 'type' | 'size'>) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'Choose a PDF contract.';
  if (file.size <= 0) return 'The selected PDF is empty.';
  if (file.size > EXTERNAL_CONTRACT_MAX_BYTES) return 'The PDF must be 10 MB or smaller.';
  return null;
}
export async function listExternalContractIngestions(weddingId: string): Promise<ExternalContractIngestion[]> {
  const { data, error } = await (supabase as any).from('external_contract_ingestions')
    .select('id,owner_user_id,wedding_id,agreement_id,original_filename,storage_path,status,extracted_data,confirmed_data,failure_message,file_deleted_at,created_at')
    .eq('wedding_id', weddingId).neq('status', 'discarded').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAgreementOptions(weddingId: string): Promise<AgreementOption[]> {
  const { data, error } = await (supabase as any).rpc('get_agreement_review', { _wedding_id: weddingId });
  if (error) throw error;
  return (Array.isArray(data?.agreements) ? data.agreements : []).map((agreement: any) => ({
    id: String(agreement.id),
    vendorName: String(agreement.vendorName || 'Vendor'),
    title: String(agreement.acceptedQuote?.title || agreement.contractTitle || 'Accepted agreement'),
  }));
}

export async function uploadAndAnalyzeExternalContract(input: {
  weddingId: string;
  agreementId?: string | null;
  file: File;
}) {
  const validation = validateExternalContractFile(input.file);
  if (validation) throw new Error(validation);
  const { data: created, error: createError } = await (supabase as any).rpc('create_external_contract_ingestion', {
    _wedding_id: input.weddingId,
    _agreement_id: input.agreementId || null,
    _filename: input.file.name,
    _mime_type: 'application/pdf',
    _size_bytes: input.file.size,
  });
  if (createError || !created?.id || !created?.storagePath) throw createError ?? new Error('Could not prepare the contract upload.');
  const { error: uploadError } = await supabase.storage.from('external-contract-ingestion')
    .upload(created.storagePath, input.file, { contentType: 'application/pdf', upsert: false });
  if (uploadError) {
    await (supabase as any).rpc('discard_external_contract_ingestion', { _ingestion_id: created.id });
    throw uploadError;
  }
  const { data, error } = await supabase.functions.invoke('analyze-external-contract', { body: { ingestionId: created.id } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { id: String(created.id), extraction: data?.extraction as ExternalContractFacts };
}

export async function retryExternalContractAnalysis(ingestionId: string) {
  const { data, error } = await supabase.functions.invoke('analyze-external-contract', { body: { ingestionId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function confirmExternalContractFacts(ingestionId: string, facts: ExternalContractFacts) {
  const { data, error } = await (supabase as any).rpc('confirm_external_contract_ingestion', {
    _ingestion_id: ingestionId,
    _confirmed_data: facts,
  });
  if (error) throw error;
  return data;
}

export async function discardExternalContractIngestion(ingestion: ExternalContractIngestion) {
  if (!ingestion.file_deleted_at) {
    await supabase.storage.from('external-contract-ingestion').remove([ingestion.storage_path]);
  }
  const { error } = await (supabase as any).rpc('discard_external_contract_ingestion', { _ingestion_id: ingestion.id });
  if (error) throw error;
}
