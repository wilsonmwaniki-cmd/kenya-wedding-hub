import { describe, expect, it } from 'vitest';

import { summarizeProfessionalReviews } from '@/lib/professionalReviews';

describe('summarizeProfessionalReviews', () => {
  it('returns an empty summary when there are no published reviews', () => {
    expect(summarizeProfessionalReviews([])).toEqual({ average: null, count: 0 });
  });

  it('calculates the public average and count', () => {
    expect(summarizeProfessionalReviews([{ rating: 5 }, { rating: 4 }, { rating: 3 }])).toEqual({
      average: 4,
      count: 3,
    });
  });
});
