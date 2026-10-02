export function commercialDocumentPrintTitle(documentNumber: string, title: string) {
  const parts = [documentNumber.trim(), title.trim()].filter(Boolean);
  return parts.join(' — ') || 'Document';
}

export function contractPrintTitle(title: string) {
  return title.trim() || 'Service agreement';
}
