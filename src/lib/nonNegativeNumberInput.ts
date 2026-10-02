export function formatNonNegativeNumberInputText(value: string) {
  const normalized = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!normalized) return '';

  const hasDecimal = normalized.includes('.');
  const [whole = '', ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, 2);

  return hasDecimal ? `${whole || '0'}.${fraction}` : whole;
}

export function parseNonNegativeNumberInput(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function formatNonNegativeNumberInputValue(value: number) {
  return Number.isFinite(value) && value >= 0 ? String(value) : '0';
}
