import { describe, expect, it } from "vitest";
import {
  MODEL_HISTORY_MESSAGE_LIMIT,
  MODEL_HISTORY_TOTAL_LIMIT,
  compactAssistantMessagesForModel,
  withoutUnansweredHistoricalRequests,
} from "../../supabase/functions/_shared/assistantMessages";

describe("withoutUnansweredHistoricalRequests", () => {
  it("keeps completed exchanges and the current request", () => {
    const messages = [
      { role: "user" as const, content: "How is planning going?" },
      { role: "assistant" as const, content: "Here is the summary." },
      { role: "user" as const, content: "Create an old task" },
      { role: "user" as const, content: "Give me advice for this week" },
    ];

    expect(withoutUnansweredHistoricalRequests(messages)).toEqual([
      messages[0],
      messages[1],
      messages[3],
    ]);
  });

  it("keeps ordinary alternating conversation history", () => {
    const messages = [
      { role: "user" as const, content: "First question" },
      { role: "assistant" as const, content: "First answer" },
      { role: "user" as const, content: "Follow-up" },
    ];

    expect(withoutUnansweredHistoricalRequests(messages)).toEqual(messages);
  });
});

describe("compactAssistantMessagesForModel", () => {
  it("shortens a long historical response while preserving the current request", () => {
    const currentRequest = { role: "user" as const, content: "Refresh the task counts." };
    const messages = [
      { role: "user" as const, content: "Create a detailed plan." },
      { role: "assistant" as const, content: "A".repeat(12_000) },
      currentRequest,
    ];

    const result = compactAssistantMessagesForModel(messages);

    expect(result.at(-1)).toBe(currentRequest);
    expect(result[1].content.length).toBe(MODEL_HISTORY_MESSAGE_LIMIT);
    expect(result.reduce((total, message) => total + message.content.length, 0)).toBeLessThanOrEqual(
      MODEL_HISTORY_TOTAL_LIMIT,
    );
  });
});
