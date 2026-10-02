import { describe, expect, it } from 'vitest';
import { AI_REQUEST_MESSAGE_LIMIT, limitAiRequestMessages } from '@/lib/aiMessageWindow';

describe('limitAiRequestMessages', () => {
  it('keeps the newest messages within the server request limit', () => {
    const messages = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message-${index + 1}`,
    }));

    const result = limitAiRequestMessages(messages);

    expect(result).toHaveLength(AI_REQUEST_MESSAGE_LIMIT);
    expect(result[0].content).toBe('message-7');
    expect(result.at(-1)?.content).toBe('message-30');
  });

  it('does not copy a history that already fits', () => {
    const messages = [{ role: 'user' as const, content: 'Current request' }];

    expect(limitAiRequestMessages(messages)).toBe(messages);
  });
});
