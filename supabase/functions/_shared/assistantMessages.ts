export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export const MODEL_HISTORY_MESSAGE_LIMIT = 5_500;
export const MODEL_HISTORY_TOTAL_LIMIT = 24_000;

const TRUNCATION_SUFFIX = "\n\n[Earlier response shortened to fit the conversation context.]";

/**
 * Keeps completed user/assistant exchanges and the current user request.
 * Earlier consecutive user messages have no assistant response, which means
 * they failed or were abandoned and must not be replayed as new instructions.
 */
export function withoutUnansweredHistoricalRequests<T extends AssistantMessage>(messages: T[]): T[] {
  if (messages.length < 2) return messages;

  const keep = messages.map(() => true);
  let pendingUserIndex: number | null = null;

  for (let index = 0; index < messages.length - 1; index++) {
    if (messages[index].role === "assistant") {
      pendingUserIndex = null;
      continue;
    }

    if (pendingUserIndex !== null) keep[pendingUserIndex] = false;
    pendingUserIndex = index;
  }

  if (messages.at(-1)?.role === "user" && pendingUserIndex !== null) {
    keep[pendingUserIndex] = false;
  }

  return messages.filter((_, index) => keep[index]);
}

/**
 * Keeps the newest useful exchanges within a bounded model context. Persisted
 * assistant responses can be much longer than a user's next request, so older
 * responses are shortened before the history is sent back to the model.
 */
export function compactAssistantMessagesForModel<T extends AssistantMessage>(messages: T[]): T[] {
  const filtered = withoutUnansweredHistoricalRequests(messages);
  if (filtered.length < 2) return filtered;

  const lastIndex = filtered.length - 1;
  const compacted = filtered.map((message, index) => {
    if (index === lastIndex || message.content.length <= MODEL_HISTORY_MESSAGE_LIMIT) {
      return message;
    }

    const retainedLength = Math.max(0, MODEL_HISTORY_MESSAGE_LIMIT - TRUNCATION_SUFFIX.length);
    return {
      ...message,
      content: `${message.content.slice(0, retainedLength)}${TRUNCATION_SUFFIX}`,
    };
  });

  const selected: T[] = [];
  let totalContentLength = 0;

  for (let index = compacted.length - 1; index >= 0; index--) {
    const message = compacted[index];
    const isCurrentRequest = index === lastIndex;

    if (!isCurrentRequest && totalContentLength + message.content.length > MODEL_HISTORY_TOTAL_LIMIT) {
      continue;
    }

    selected.push(message);
    totalContentLength += message.content.length;
  }

  return selected.reverse();
}
