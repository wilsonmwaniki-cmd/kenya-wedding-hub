export function formatIntegerInput(value: number) {
  return value > 0 ? Math.round(value).toLocaleString('en-KE') : '';
}

export function parseIntegerInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}
