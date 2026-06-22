export type ConciergeContextValue = string | number | boolean | null | undefined;

export type ConciergeContextSection = {
  title: string;
  items: Array<[string, ConciergeContextValue]>;
};

export type ConciergeContextInput = {
  page: string;
  role?: string | null;
  weddingName?: string | null;
  primaryGoal?: string | null;
  nextBestAction?: string | null;
  risks?: string[];
  facts?: Array<[string, ConciergeContextValue]>;
  sections?: ConciergeContextSection[];
};

function formatContextValue(value: ConciergeContextValue) {
  if (value === null || value === undefined || value === '') return 'not set';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function formatContextItems(items: Array<[string, ConciergeContextValue]>) {
  return items
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `- ${label}: ${formatContextValue(value)}`)
    .join('\n');
}

export function buildConciergeContext(input: ConciergeContextInput) {
  const lines = [
    'Concierge brief for Zania AI:',
    `Page: ${input.page}`,
    input.role ? `User role: ${input.role}` : null,
    input.weddingName ? `Wedding: ${input.weddingName}` : null,
    input.primaryGoal ? `Primary page goal: ${input.primaryGoal}` : null,
    input.nextBestAction ? `Recommended next action: ${input.nextBestAction}` : null,
    '',
    'Behavior instructions:',
    '- Be specific to this workspace, not generic.',
    '- Start with the most useful next move.',
    '- Explain why the move matters in one short sentence.',
    '- Offer 2-4 concrete actions the user can take in Zania.',
    '- If data is missing, say what Zania needs from the user next.',
  ].filter(Boolean);

  const facts = input.facts ? formatContextItems(input.facts) : '';
  if (facts) {
    lines.push('', 'Known workspace signals:', facts);
  }

  if (input.risks?.length) {
    lines.push('', 'Current risks or gaps:', ...input.risks.map((risk) => `- ${risk}`));
  }

  input.sections?.forEach((section) => {
    const sectionItems = formatContextItems(section.items);
    if (sectionItems) {
      lines.push('', section.title, sectionItems);
    }
  });

  return lines.join('\n');
}
