import { describe, expect, it } from 'vitest';
import {
  AI_REQUEST_HISTORY_MESSAGE_LIMIT,
  AI_REQUEST_MESSAGE_LIMIT,
  AI_REQUEST_TOTAL_CONTENT_LIMIT,
  limitAiRequestMessages,
} from '@/lib/aiMessageWindow';

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

  it('shortens a long historical answer while preserving the current request', () => {
    const currentRequest = 'Refresh the task counts.';
    const result = limitAiRequestMessages([
      { role: 'user', content: 'Give me a detailed briefing.' },
      { role: 'assistant', content: 'x'.repeat(12_000) },
      { role: 'user', content: currentRequest },
    ]);

    expect(result[1].content.length).toBe(AI_REQUEST_HISTORY_MESSAGE_LIMIT);
    expect(result[1].content).toContain('[Earlier response shortened for context.]');
    expect(result.at(-1)?.content).toBe(currentRequest);
  });

  it('drops the oldest bounded history when the total context is too large', () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `${index}:`.padEnd(4_000, 'x'),
    }));

    const result = limitAiRequestMessages(messages);

    expect(result.reduce((total, message) => total + message.content.length, 0))
      .toBeLessThanOrEqual(AI_REQUEST_TOTAL_CONTENT_LIMIT);
    expect(result.at(-1)?.content).toBe(messages.at(-1)?.content);
    expect(result[0]).not.toBe(messages[0]);
  });
});
