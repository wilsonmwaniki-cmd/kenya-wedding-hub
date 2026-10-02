import type { ProfessionalDocumentTemplateRecord } from '@/lib/commercialDocuments';

export function getTemplateUseCount(template: ProfessionalDocumentTemplateRecord) {
  const raw = template.metadata?.useCount;
  const count = Number(raw ?? 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}
