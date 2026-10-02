import { describe, expect, it, vi } from 'vitest';
import { searchExternalVendorsWithOpenAi } from '../../supabase/functions/_shared/externalVendorDiscovery';

describe('external vendor discovery adapter', () => {
  it('keeps only source-backed vendors and preserves clickable evidence', async () => {
    const officialUrl = 'https://nairobilight.example/services';
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      output: [
        {
          type: 'web_search_call',
          action: { type: 'search', query: 'Nairobi wedding photographer', sources: [{ url: officialUrl, title: 'Nairobi Light Studio' }] },
        },
        {
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({ vendors: [
              {
                businessName: 'Nairobi Light Studio', category: 'Photographer', location: 'Nairobi',
                website: officialUrl, summary: 'Wedding photography studio.',
                matchReasons: ['Works in Nairobi'], unknowns: ['Current price and availability are unknown'],
                sourceUrls: [officialUrl],
              },
              {
                businessName: 'Uncited Studio', category: 'Photographer', location: 'Nairobi',
                website: 'https://uncited.example', summary: '', matchReasons: [], unknowns: [],
                sourceUrls: ['https://uncited.example'],
              },
            ] }),
            annotations: [{ type: 'url_citation', url: officialUrl, title: 'Nairobi Light Studio' }],
          }],
        },
      ],
      usage: { input_tokens: 2000, input_tokens_details: { cached_tokens: 500 }, output_tokens: 100 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const result = await searchExternalVendorsWithOpenAi({
      apiKey: 'test-key', model: 'gpt-5.5', intent: { category: 'photographer', location: 'Nairobi' },
      fetcher, now: new Date('2026-10-01T12:00:00Z'),
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      businessName: 'Nairobi Light Studio', website: officialUrl,
      sources: [{ url: officialUrl, sourceKind: 'official_website', observedAt: '2026-10-01T12:00:00.000Z' }],
    });
    expect(result.usage).toMatchObject({
      model: 'gpt-5.5', providerRequestCount: 1, webSearchCallCount: 1,
      inputTokens: 2000, cachedInputTokens: 500, outputTokens: 100,
    });
    expect(result.usage.estimatedCostUsd).toBeCloseTo(0.02075, 8);
    expect(fetcher).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.objectContaining({ method: 'POST' }));
  });

  it('fails closed when the provider does not return valid JSON', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json', annotations: [] }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    await expect(searchExternalVendorsWithOpenAi({
      apiKey: 'test-key', model: 'test-model', intent: { category: 'caterer' }, fetcher,
    })).rejects.toThrow('invalid structured result');
  });
});
