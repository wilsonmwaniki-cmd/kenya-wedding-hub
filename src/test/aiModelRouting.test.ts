import { describe, expect, it } from 'vitest';

import { getDefaultModelPricing, selectAiModelRoute } from '../../supabase/functions/_shared/aiModelRouting';

const models = {
  routine: 'gpt-5.6-luna',
  balanced: 'gpt-5.6-terra',
  complex: 'gpt-5.6-sol',
} as const;

describe('AI model routing', () => {
  it.each([
    'Show my pending tasks',
    'Add Kamau to the guest list',
    'How many vendors do I have?',
    'Mark book photographer as complete',
  ])('routes routine work to Luna: %s', (content) => {
    expect(selectAiModelRoute([{ role: 'user', content }], models)).toMatchObject({
      tier: 'routine',
      model: 'gpt-5.6-luna',
    });
  });

  it('routes ordinary advice to Terra', () => {
    expect(selectAiModelRoute([
      { role: 'user', content: 'Help me decide what I should focus on this week.' },
    ], models)).toMatchObject({ tier: 'balanced', model: 'gpt-5.6-terra' });
  });

  it('routes multi-domain strategic work to Sol', () => {
    expect(selectAiModelRoute([{
      role: 'user',
      content: 'Analyze our budget and vendor trade-offs, identify timeline risks, and recommend a contingency strategy.',
    }], models)).toMatchObject({ tier: 'complex', model: 'gpt-5.6-sol' });
  });

  it('promotes long, constrained workflows to Sol', () => {
    const content = `Build a complete plan for the next month. ${'Balance our priorities carefully; '.repeat(30)}`;
    expect(selectAiModelRoute([{ role: 'user', content }], models).tier).toBe('complex');
  });

  it('uses current per-model cache pricing defaults', () => {
    expect(getDefaultModelPricing('gpt-5.6-luna')).toEqual({
      input: 0.2,
      cachedInput: 0.02,
      cacheWrite: 0.25,
      output: 1.2,
    });
    expect(getDefaultModelPricing('gpt-5.6-sol')).toEqual({
      input: 5,
      cachedInput: 0.5,
      cacheWrite: 6.25,
      output: 30,
    });
  });
});
