export function parseCurrencyInput(value: string) {
  const normalized = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  const [whole = '', ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, 2);
  const amount = Number(`${whole || '0'}${normalized.includes('.') ? `.${fraction}` : ''}`);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatCurrencyInputText(value: string) {
  const normalized = sanitizeCurrencyInputText(value);
  if (!normalized) return '';

  const hasDecimal = normalized.includes('.');
  const [wholePart = '', ...fractionParts] = normalized.split('.');
  const whole = wholePart.replace(/^0+(?=\d)/, '') || '0';
  const grouped = Number(whole).toLocaleString('en-KE', { maximumFractionDigits: 0 });
  const fraction = fractionParts.join('').slice(0, 2);

  return hasDecimal ? `${grouped}.${fraction}` : grouped;
}

/**
 * Keeps a currency field editable without moving the caret. Grouping is applied
 * after the field loses focus, rather than on every keystroke.
 */
export function sanitizeCurrencyInputText(value: string) {
  const normalized = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!normalized) return '';

  const [whole = '', ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, 2);
  return normalized.includes('.') ? `${whole}.${fraction}` : whole;
}

export function formatCurrencyInputValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  return value.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
