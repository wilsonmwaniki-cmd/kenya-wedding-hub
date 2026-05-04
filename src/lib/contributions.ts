export const contributionTypeOptions = ['cash', 'in_kind'] as const;
export type ContributionType = (typeof contributionTypeOptions)[number];

export const contributionStatusOptions = ['pledged', 'partial', 'paid', 'in_kind', 'cancelled'] as const;
export type ContributionStatus = (typeof contributionStatusOptions)[number];

export const contributionPaymentMethodOptions = ['mpesa', 'cash', 'bank', 'other', 'in_kind'] as const;
export type ContributionPaymentMethod = (typeof contributionPaymentMethodOptions)[number];

export type ContributionSummaryRow = {
  contributor_name?: string | null;
  contributor_phone?: string | null;
  contributor_group?: string | null;
  contribution_type?: string | null;
  status?: string | null;
  pledged_amount?: number | null;
  paid_amount?: number | null;
  in_kind_value?: number | null;
  purpose?: string | null;
};

export type ContributionReminderRow = ContributionSummaryRow & {
  id?: string | null;
};

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return `KES ${amount.toLocaleString()}`;
}

export function contributionStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'pledged':
      return 'Pledged';
    case 'partial':
      return 'Partially paid';
    case 'paid':
      return 'Paid';
    case 'in_kind':
      return 'In-kind';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

export function contributionStatusTone(status: string | null | undefined) {
  switch (status) {
    case 'paid':
    case 'in_kind':
      return 'secondary' as const;
    case 'partial':
      return 'default' as const;
    case 'cancelled':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

export function contributionTypeLabel(type: string | null | undefined) {
  return type === 'in_kind' ? 'In-kind support' : 'Cash contribution';
}

export function contributionPaymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case 'mpesa':
      return 'M-Pesa';
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank';
    case 'other':
      return 'Other';
    case 'in_kind':
      return 'In-kind';
    default:
      return 'Not set';
  }
}

export function summarizeContributions(rows: ContributionSummaryRow[]) {
  const normalized = rows.map((row) => ({
    contributorName: row.contributor_name?.trim() || null,
    type: row.contribution_type === 'in_kind' ? 'in_kind' : 'cash',
    status: row.status ?? 'pledged',
    pledged: Number(row.pledged_amount ?? 0),
    paid: Number(row.paid_amount ?? 0),
    inKind: Number(row.in_kind_value ?? 0),
  }));

  const pledgedCash = normalized.reduce((sum, row) => sum + row.pledged, 0);
  const collectedCash = normalized.reduce((sum, row) => sum + row.paid, 0);
  const inKindValue = normalized.reduce((sum, row) => sum + row.inKind, 0);
  const totalSupport = collectedCash + inKindValue;
  const outstandingPledges = Math.max(
    normalized.reduce((sum, row) => {
      if (row.status === 'cancelled' || row.type === 'in_kind') return sum;
      return sum + Math.max(row.pledged - row.paid, 0);
    }, 0),
    0,
  );
  const pendingCount = normalized.filter((row) => row.status === 'pledged' || row.status === 'partial').length;
  const contributorCount = new Set(
    normalized.map((row) => row.contributorName).filter((value): value is string => Boolean(value)),
  ).size;

  return {
    pledgedCash,
    collectedCash,
    inKindValue,
    totalSupport,
    outstandingPledges,
    pendingCount,
    contributorCount,
  };
}

export function getOutstandingContributionAmount(row: ContributionSummaryRow) {
  const pledged = Number(row.pledged_amount ?? 0);
  const paid = Number(row.paid_amount ?? 0);
  if (row.contribution_type === 'in_kind' || row.status === 'cancelled') return 0;
  return Math.max(pledged - paid, 0);
}

export function buildContributionReminderMessage(
  row: ContributionReminderRow,
  workspaceName: string,
) {
  const outstanding = getOutstandingContributionAmount(row);
  const paid = Number(row.paid_amount ?? 0);
  const pledged = Number(row.pledged_amount ?? 0);
  const contributorName = row.contributor_name?.trim() || 'there';
  const purpose = row.purpose?.trim() ? ` for ${row.purpose.trim()}` : '';
  const paidLine = paid > 0 ? ` We have already received ${formatCurrency(paid)} from your pledge.` : '';
  return [
    `Hello ${contributorName},`,
    ``,
    `Warm reminder from the ${workspaceName} committee.`,
    `You pledged ${formatCurrency(pledged)}${purpose}.${paidLine}`,
    `The remaining balance is ${formatCurrency(outstanding)}.`,
    `Please let us know when you expect to send it. Thank you for supporting the wedding.`,
  ].join('\n');
}
