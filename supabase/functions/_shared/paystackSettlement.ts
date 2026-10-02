export type ZaniaPaySettlementStatus = 'pending' | 'scheduled' | 'paid' | 'failed';

type JsonRecord = Record<string, unknown>;

export type PaystackSettlementSummary = {
  id: string;
  status: ZaniaPaySettlementStatus;
  settlementDate: string | null;
  paidAt: string | null;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function mapPaystackSettlementStatus(value: unknown): ZaniaPaySettlementStatus {
  switch (text(value).toLowerCase()) {
    case 'success': return 'paid';
    case 'processing': return 'scheduled';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

export function parsePaystackSettlements(value: unknown): PaystackSettlementSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const id = row && (typeof row.id === 'number' || typeof row.id === 'string') ? String(row.id) : '';
    if (!id) return [];
    const status = mapPaystackSettlementStatus(row.status);
    const settlementDate = text(row.settlement_date) || null;
    return [{
      id,
      status,
      settlementDate,
      paidAt: status === 'paid' ? text(row.updatedAt) || settlementDate : null,
    }];
  });
}

export function paystackTransactionsIncludeReference(value: unknown, reference: string) {
  if (!Array.isArray(value) || !reference) return false;
  return value.some((item) => text(asRecord(item)?.reference) === reference);
}
