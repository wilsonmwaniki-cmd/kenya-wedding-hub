import { describe, expect, it } from "vitest";

import { getSafeAuthRouteTarget } from "@/lib/authRouting";

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
