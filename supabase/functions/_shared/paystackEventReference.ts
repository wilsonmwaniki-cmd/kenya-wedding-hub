export function paystackEventReference(data: Record<string, unknown> | undefined): string {
  const transaction = data?.transaction;
  const nested = transaction && typeof transaction === 'object' ? transaction as Record<string, unknown> : null;
  // Refund references identify the refund; its transaction identifies the payment.
  const candidates = [data?.transaction_reference, nested?.reference, typeof transaction === 'string' ? transaction : null, data?.reference];
  return candidates.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? '';
}
