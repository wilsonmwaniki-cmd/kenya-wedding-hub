export function normalizeHumanName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => {
      if (!part) return part;

      return part
        .split(/([-'])/)
        .map((segment) => {
          if (segment === '-' || segment === '\'') return segment;
          if (!segment) return segment;
          return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
        })
        .join('');
    })
    .join(' ');
}

export function normalizeHumanNameInput(value: string) {
  const hasTrailingWhitespace = /\s$/.test(value);
  const normalized = normalizeHumanName(value);

  if (!normalized) {
    return hasTrailingWhitespace ? ' ' : '';
  }

  return hasTrailingWhitespace ? `${normalized} ` : normalized;
}
