import { describe, expect, it } from "vitest";
import { withoutUnansweredHistoricalRequests } from "../../supabase/functions/_shared/assistantMessages";

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
