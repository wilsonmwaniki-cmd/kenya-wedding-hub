import { describe, expect, it } from "vitest";

import { getSafeAuthRouteTarget } from "@/lib/authRouting";
import {
  isLockedSignupEntry,
  resolveAuthSignInAudience,
  resolveSignupEntryStep,
} from "@/lib/authEntryFlows";

describe("getSafeAuthRouteTarget", () => {
  it("returns the provided role target when available", () => {
    expect(
      getSafeAuthRouteTarget({
        role: "planner",
        plannerType: "committee",
      }),
    ).toEqual({
      role: "planner",
      plannerType: "committee",
    });
  });

  it("falls back to a safe couple home target when callback metadata is incomplete", () => {
    expect(getSafeAuthRouteTarget(null)).toEqual({
      role: "couple",
      plannerType: null,
    });
  });
});

describe("resolveAuthSignInAudience", () => {
  it("preserves an explicit couple or professional sign-in audience", () => {
    expect(resolveAuthSignInAudience("couple")).toBe("couple");
    expect(resolveAuthSignInAudience("professional")).toBe("professional");
  });

  it("leaves generic and invalid sign-in entries unscoped", () => {
    expect(resolveAuthSignInAudience(null)).toBeNull();
    expect(resolveAuthSignInAudience("admin")).toBeNull();
  });
});

describe("signup URL entry state", () => {
  it("starts broad couple and professional signup links at step one", () => {
    expect(resolveSignupEntryStep({
      mode: "signup",
      audience: "couple",
      role: "couple",
    })).toBe("method");
    expect(resolveSignupEntryStep({
      mode: "signup",
      audience: "professional",
    })).toBe("method");
  });

  it("keeps explicit onboarding flows locked to their intended track", () => {
    const lockedEntries = [
      { mode: "signup", flow: "join_wedding", audience: "couple" },
      { mode: "signup", flow: "vendor_claim", audience: "professional", role: "vendor" },
      { mode: "signup", flow: "estimator", audience: "couple", role: "couple" },
      { mode: "signup", audience: "professional", role: "planner" },
      { mode: "signup", audience: "professional", role: "vendor" },
    ];

    for (const entry of lockedEntries) {
      expect(isLockedSignupEntry(entry)).toBe(true);
      expect(resolveSignupEntryStep(entry)).toBe("account");
    }
  });
});
