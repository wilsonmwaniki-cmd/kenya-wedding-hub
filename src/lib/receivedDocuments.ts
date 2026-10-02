import { supabase } from '@/integrations/supabase/client';

export type ReceivedDocument = {
  id: string;
  document_type: 'quote' | 'invoice' | 'receipt' | 'contract';
  document_number: string | null;
  title: string;
  status: string;
  currency: string | null;
  total_amount: number | null;
  updated_at: string;
  share_token: string;
};

export async function listReceivedDocuments(): Promise<ReceivedDocument[]> {
  const { data, error } = await (supabase as any).rpc('list_received_documents');
  if (error) throw error;
  return data ?? [];
}

export function receivedDocumentPath(document: ReceivedDocument) {
  const prefix = document.document_type === 'contract' ? 'contracts' : 'documents';
  return `/${prefix}/share/${encodeURIComponent(document.share_token)}`;
}
