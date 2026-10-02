export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

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
