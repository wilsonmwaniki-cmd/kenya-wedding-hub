import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/professionalSetupState", () => ({
  readPendingProfessionalSetup: vi.fn(),
}));

import { readPendingProfessionalSetup } from "@/lib/professionalSetupState";
import { getHomeRouteForRole, isProfessionalSetupPending } from "@/lib/roles";

const mockedReadPendingProfessionalSetup = vi.mocked(readPendingProfessionalSetup);

describe("getHomeRouteForRole", () => {
  it("routes committee planners into the shared dashboard", () => {
    expect(getHomeRouteForRole("planner", "committee")).toBe("/dashboard");
  });

  it("routes professional planners into the client workspace", () => {
    expect(getHomeRouteForRole("planner", "professional")).toBe("/clients");
  });

  it("routes vendors and admins to their dedicated homes", () => {
    expect(getHomeRouteForRole("vendor", null)).toBe("/vendor-settings");
    expect(getHomeRouteForRole("admin", null)).toBe("/admin");
  });

  it("defaults unknown roles to the couple dashboard", () => {
    expect(getHomeRouteForRole(null, null)).toBe("/dashboard");
  });
});

describe("isProfessionalSetupPending", () => {
  it("returns true when a professional signup is intentionally left unlocked", () => {
    mockedReadPendingProfessionalSetup.mockReturnValue(false);

    expect(
      isProfessionalSetupPending({
        signup_intent: "professional",
        professional_role_locked: false,
      }),
    ).toBe(true);
  });

  it("returns true when pending setup is stored locally for the email", () => {
    mockedReadPendingProfessionalSetup.mockReturnValue(true);

    expect(
      isProfessionalSetupPending(
        {
          signup_intent: "professional",
          professional_role_locked: true,
        },
        "planner",
        "planner@example.com",
      ),
    ).toBe(true);
  });

  it("returns false when neither metadata nor local state requires setup", () => {
    mockedReadPendingProfessionalSetup.mockReturnValue(false);

    expect(
      isProfessionalSetupPending(
        {
          signup_intent: "couple",
          professional_role_locked: true,
        },
        "couple",
        "couple@example.com",
      ),
    ).toBe(false);
  });
});
