export function formatIntegerInput(value: number) {
  return value > 0 ? Math.round(value).toLocaleString('en-KE') : '';
}

export function parseIntegerInput(value: string) {
  const digits = sanitizeIntegerInput(value);
  return digits ? Number(digits) : 0;
}

export function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '');
}
