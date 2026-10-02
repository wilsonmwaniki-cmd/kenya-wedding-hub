import type { DocumentTemplateItem } from '@/lib/commercialDocuments';

export type ContractSection = DocumentTemplateItem & {
  content?: string;
};

const normalizeTitle = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ');

export function sectionId(title: string, index: number) {
  const slug = title
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `standard-term-${slug || index + 1}`;
}

export function compileContractSections(items: ContractSection[]) {
  return items
    .filter((item) => item.description.trim() || item.content?.trim())
    .map((item) => {
      const title = item.description.trim() || 'Untitled section';
      const content = item.content?.trim() || '';
      return `## ${title}${content ? `\n\n${content}` : ''}`;
    })
    .join('\n\n');
}

function parseMarkdownSections(terms: string) {
  const matches = [...terms.matchAll(/^##\s+(.+)$/gm)];
  if (!matches.length) return [];
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? terms.length;
    return {
      description: match[1].trim(),
      content: terms.slice(start, end).trim(),
      quantity: 1,
      unitPrice: 0,
    } satisfies ContractSection;
  });
}

export function hydrateContractSections(items: ContractSection[], terms: string) {
  const markdownSections = parseMarkdownSections(terms);
  if (markdownSections.length) return markdownSections;

  const titledItems = items.filter((item) => item.description.trim());
  if (!titledItems.length) {
    return terms.trim()
      ? [{ description: 'Standard terms', content: terms.trim(), quantity: 1, unitPrice: 0 }]
      : [{ description: '', content: '', quantity: 1, unitPrice: 0 }];
  }

  const lines = terms.split('\n');
  const starts = titledItems.map((item) => lines.findIndex((line) => normalizeTitle(line) === normalizeTitle(item.description)));

  return titledItems.map((item, index) => {
    if (item.content?.trim()) return item;
    const start = starts[index];
    if (start < 0) return { ...item, content: '' };
    const laterStarts = starts.slice(index + 1).filter((value) => value > start);
    const end = laterStarts.length ? Math.min(...laterStarts) : lines.length;
    return { ...item, content: lines.slice(start + 1, end).join('\n').trim() };
  });
}

export function syncSectionsFromTerms(items: ContractSection[], terms: string) {
  const parsed = parseMarkdownSections(terms);
  if (!parsed.length) return items;
  const byTitle = new Map(parsed.map((section) => [normalizeTitle(section.description), section]));
  const retained = items.map((item) => byTitle.get(normalizeTitle(item.description)) ?? item);
  const retainedTitles = new Set(retained.map((item) => normalizeTitle(item.description)));
  return [...retained, ...parsed.filter((item) => !retainedTitles.has(normalizeTitle(item.description)))];
}
