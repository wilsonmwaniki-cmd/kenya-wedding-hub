import { afterEach, describe, expect, it } from "vitest";

import { getEntitlementDecision, hasActivePlanningPass } from "@/lib/entitlements";

describe("hasActivePlanningPass", () => {
  it("requires an active status", () => {
    expect(
      hasActivePlanningPass({
        planning_pass_status: "inactive",
        planning_pass_expires_at: null,
      }),
    ).toBe(false);
  });

  it("rejects expired planning passes", () => {
    expect(
      hasActivePlanningPass({
        planning_pass_status: "active",
        planning_pass_expires_at: "2020-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("accepts active passes that are still in date", () => {
    expect(
      hasActivePlanningPass({
        planning_pass_status: "active",
        planning_pass_expires_at: "2999-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});

describe("getEntitlementDecision", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("keeps the couple AI assistant available on Intimate", () => {
    const decision = getEntitlementDecision("couple.ai_assistant", {
      profile: {
        role: "couple",
        planning_pass_status: "inactive",
      },
      weddingEntitlements: {
        ai_wedding_assistant: false,
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });

  it("unlocks couple AI assistant when the wedding entitlement is active", () => {
    const decision = getEntitlementDecision("couple.ai_assistant", {
      profile: {
        role: "couple",
      },
      weddingEntitlements: {
        ai_wedding_assistant: true,
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });

  it("blocks additional planner weddings after the free limit", () => {
    const decision = getEntitlementDecision("planner.additional_weddings", {
      profile: {
        role: "planner",
        planner_type: "professional",
        planner_subscription_status: "inactive",
      },
      activeWeddingCount: 1,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain("Your free planner tier includes only 1 active wedding.");
  });

  it("uses the planner free wedding guardrail when provided", () => {
    const decision = getEntitlementDecision("planner.additional_weddings", {
      profile: {
        role: "planner",
        planner_type: "professional",
        planner_subscription_status: "inactive",
      },
      activeWeddingCount: 0,
      plannerFreeWeddingEligible: false,
      plannerFreeWeddingReason: "Your free planner tier already has its wedding workspace.",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain("Your free planner tier already has its wedding workspace.");
  });

  it("honors the global local bypass switch for QA", () => {
    window.localStorage.setItem("zania-unlock-all-features", "true");

    const decision = getEntitlementDecision("vendor.analytics", {
      profile: {
        role: "vendor",
      },
      vendorListing: {
        is_approved: false,
        is_verified: false,
        subscription_status: "inactive",
      },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows approved and verified free vendors to receive inquiries", () => {
    const decision = getEntitlementDecision("vendor.direct_leads", {
      vendorListing: {
        is_approved: true,
        is_verified: true,
        subscription_status: "inactive",
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });

  it("keeps vendor analytics behind Professional", () => {
    const decision = getEntitlementDecision("vendor.analytics", {
      vendorListing: {
        is_approved: true,
        is_verified: true,
        subscription_status: "inactive",
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.planName).toBe("Professional");
  });
});
