import { describe, expect, it } from 'vitest';
import { normaliseContactEmail, normaliseContactEmails } from '@/lib/professionalContacts';

describe('professional contact email helpers', () => {
  it('normalises a valid email and rejects malformed values', () => {
    expect(normaliseContactEmail('  Client@Example.com ')).toBe('client@example.com');
    expect(normaliseContactEmail('not-an-email')).toBeNull();
  });

  it('keeps only unique valid secondary recipients', () => {
    expect(normaliseContactEmails(['SECOND@example.com', 'second@example.com', 'bad', 'primary@example.com'], 'primary@example.com'))
      .toEqual(['second@example.com']);
  });
});
