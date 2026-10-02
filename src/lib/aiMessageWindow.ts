import type { AiAssistantMessage } from '@/lib/aiAssistant';

export const AI_REQUEST_MESSAGE_LIMIT = 24;

export function limitAiRequestMessages(
  messages: AiAssistantMessage[],
  limit = AI_REQUEST_MESSAGE_LIMIT,
): AiAssistantMessage[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}
