import type { AiAssistantMessage } from '@/lib/aiAssistant';

export const AI_REQUEST_MESSAGE_LIMIT = 24;
export const AI_REQUEST_HISTORY_MESSAGE_LIMIT = 5_500;
export const AI_REQUEST_TOTAL_CONTENT_LIMIT = 24_000;

const HISTORY_TRUNCATION_SUFFIX = '\n\n[Earlier response shortened for context.]';

export function limitAiRequestMessages(
  messages: AiAssistantMessage[],
  limit = AI_REQUEST_MESSAGE_LIMIT,
): AiAssistantMessage[] {
  const recent = messages.length <= limit ? messages : messages.slice(-limit);
  const bounded = recent.map((message, index) => {
    if (index === recent.length - 1 || message.content.length <= AI_REQUEST_HISTORY_MESSAGE_LIMIT) {
      return message;
    }
    return {
      ...message,
      content: `${message.content.slice(0, AI_REQUEST_HISTORY_MESSAGE_LIMIT - HISTORY_TRUNCATION_SUFFIX.length)}${HISTORY_TRUNCATION_SUFFIX}`,
    };
  });

  const selected: AiAssistantMessage[] = [];
  let contentLength = 0;
  for (let index = bounded.length - 1; index >= 0; index -= 1) {
    const message = bounded[index];
    if (selected.length > 0 && contentLength + message.content.length > AI_REQUEST_TOTAL_CONTENT_LIMIT) {
      continue;
    }
    selected.unshift(message);
    contentLength += message.content.length;
  }

  const unchanged = selected.length === messages.length
    && selected.every((message, index) => message === messages[index]);
  return unchanged ? messages : selected;
}
