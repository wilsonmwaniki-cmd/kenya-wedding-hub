export type ContractPlaceholderField = 'summary' | 'terms';

export type ContractPlaceholder = {
  id: string;
  field: ContractPlaceholderField;
  label: string;
  raw: string;
  start: number;
  end: number;
};

function friendlyPlaceholderLabel(value: string) {
  const cleaned = value
    .replace(/^enter\s+/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Missing detail';
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
}

function placeholdersIn(field: ContractPlaceholderField, value: string): ContractPlaceholder[] {
  const matches = value.matchAll(/\[([^\]\n]+)\]/g);

  return Array.from(matches, (match, index) => ({
    id: `${field}-${match.index ?? 0}-${index}`,
    field,
    label: friendlyPlaceholderLabel(match[1]),
    raw: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

export function getContractPlaceholders(input: { summary: string; terms: string }) {
  return [
    ...placeholdersIn('summary', input.summary),
    ...placeholdersIn('terms', input.terms),
  ];
}
