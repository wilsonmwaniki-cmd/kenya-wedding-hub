export const committeeResponsibilityOptions = [
  'Photography',
  'Catering',
  'Decor',
  'Venue',
  'Transport',
  'Entertainment',
  'Guest Coordination',
  'Finance',
  'Protocol / MC',
  'Bridal Logistics',
  'Aesthetics Coordinator',
  'Stationery Coordinator',
  'Edibles Coordinator',
  'Experience Coordinator',
  'Logistics Coordinator',
  'Best Man',
  'Best Lady',
] as const;

export const contractStatusOptions = [
  'not_started',
  'drafting',
  'sent',
  'signed',
  'not_required',
] as const;

export type ContractStatus = (typeof contractStatusOptions)[number];

export function contractStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'drafting':
      return 'Drafting';
    case 'sent':
      return 'Sent';
    case 'signed':
      return 'Signed';
    case 'not_required':
      return 'Not required';
    default:
      return 'Not started';
  }
}

export function contractStatusTone(status: string | null | undefined): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'signed':
      return 'default';
    case 'sent':
      return 'secondary';
    default:
      return 'outline';
  }
}
