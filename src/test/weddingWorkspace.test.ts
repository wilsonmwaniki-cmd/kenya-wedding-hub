import { beforeEach, describe, expect, it } from "vitest";

import {
  getWeddingInviteDeliveryFailureMessage,
  getPendingWeddingSetup,
  hasPendingWeddingSetup,
  isPendingWeddingSetupReadyForCompletion,
  persistPendingWeddingSetup,
} from "@/lib/weddingWorkspace";

describe("pending wedding setup", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("reads a matching session-scoped pending setup", () => {
    persistPendingWeddingSetup({
      intent: "join_wedding",
      email: "couple@example.com",
      weddingCode: "ZN-12345",
    });

    expect(
      getPendingWeddingSetup(null, "couple@example.com"),
    ).toEqual({
      intent: "join_wedding",
      email: "couple@example.com",
      weddingCode: "ZN-12345",
    });
  });

  it("ignores session setup created for a different signed-in email", () => {
    persistPendingWeddingSetup({
      intent: "join_wedding",
      email: "one@example.com",
      weddingCode: "ZN-12345",
    });

    expect(getPendingWeddingSetup(null, "two@example.com")).toBeNull();
    expect(hasPendingWeddingSetup(null, "two@example.com")).toBe(false);
  });

  it("falls back to auth metadata when session state is not present", () => {
    expect(
      getPendingWeddingSetup({
        signup_intent: "create_wedding",
        wedding_setup_completed: false,
        wedding_owner_role: "bride",
        partner_email: "Partner@Example.com",
        wedding_name: "Mary & James",
      }),
    ).toEqual({
      intent: "create_wedding",
      email: null,
      weddingOwnerRole: "bride",
      partnerEmail: "partner@example.com",
      weddingName: "Mary & James",
      weddingCode: null,
      weddingCounty: null,
      weddingTown: null,
      weddingDate: null,
      planningMode: "local",
      planningCountry: null,
      referenceCurrency: null,
      ownerTimezone: null,
    });
  });

  it("requires the minimum fields before completion can run", () => {
    expect(
      isPendingWeddingSetupReadyForCompletion({
        intent: "create_wedding",
        email: "couple@example.com",
        weddingName: "Mary & James",
      }),
    ).toBe(false);

    expect(
      isPendingWeddingSetupReadyForCompletion({
        intent: "create_wedding",
        email: "couple@example.com",
        weddingName: "Mary & James",
        weddingOwnerRole: "bride",
      }),
    ).toBe(true);
  });

  it("preserves resend cooldown errors instead of flattening them into delivery failures", () => {
    expect(
      getWeddingInviteDeliveryFailureMessage(new Error("This invite was already sent recently. Please wait 2 minutes before resending it.")),
    ).toBe("This invite was already sent recently. Please wait 2 minutes before resending it.");
  });

  it("preserves hourly rate limit messages with the remaining wait time", () => {
    expect(
      getWeddingInviteDeliveryFailureMessage(new Error("Too many partner invite attempts were made recently. Please wait 14 minutes before sending more.")),
    ).toBe("Too many partner invite attempts were made recently. Please wait 14 minutes before sending more.");
  });

  it("hides low-level edge function transport errors behind a human message", () => {
    expect(
      getWeddingInviteDeliveryFailureMessage(new Error("Edge Function returned a non-2xx status code")),
    ).toBe("The invite was created, but Zania could not send the email right now. You can still share the wedding code manually.");
  });
});
