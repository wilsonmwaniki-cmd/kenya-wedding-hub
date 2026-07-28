import { describe, expect, it } from "vitest";

import { describeAiInvokeError, describeBillingError } from "@/lib/invokeErrors";

describe("describeBillingError", () => {
  it("turns expired auth into an actionable checkout message", () => {
    expect(describeBillingError("checkout_start", 401, "Unauthorized")).toContain("Sign in again");
  });

  it("explains billing misconfiguration clearly during sync", () => {
    expect(
      describeBillingError(
        "checkout_sync",
        500,
        "Checkout sync environment variables are not fully configured.",
      ),
    ).toContain("not fully configured");
  });

  it("turns network edge-function failures into retry guidance", () => {
    expect(
      describeBillingError(
        "checkout_start",
        null,
        "Failed to send a request to the Edge Function",
      ),
    ).toContain("card was not charged");
  });
});

describe("describeAiInvokeError", () => {
  it("does not mislabel provider credit failures as workspace payment failures", () => {
    expect(describeAiInvokeError(402, "OpenAI credits exhausted. Please top up later."))
      .toContain("not a subscription issue");
  });

  it("describes upstream AI outages without blaming workspace access", () => {
    expect(describeAiInvokeError(503, "AI service unavailable"))
      .toContain("workspace access is not the issue");
  });

  it("maps quota failures into admin-actionable language", () => {
    expect(describeAiInvokeError(429, "quota")).toContain("raise the limit");
  });

  it("describes internal cost ceilings as an included assistant allowance", () => {
    expect(describeAiInvokeError(429, "You have reached this month's assistant fair-use allowance."))
      .toContain("included Zania Assistant allowance");
  });

  it("maps missing AI configuration into a clear setup message", () => {
    expect(describeAiInvokeError(500, "OPENAI_API_KEY is not configured")).toContain("not fully configured");
  });
});
