import { describe, expect, it, vi } from "vitest";

import {
  assertActiveAuthSession,
  assertOAuthClientAccessToken,
  AuthSessionError,
} from "../../supabase/functions/_shared/sessionGuard";

function token(claims: Record<string, unknown>) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `Bearer ${encode({ alg: "none" })}.${encode(claims)}.signature`;
}

describe("session guards", () => {
  it("accepts a verified OAuth client token without applying browser device trust", () => {
    expect(assertOAuthClientAccessToken(
      token({ session_id: "7df6bb97-ae88-48c9-8118-021451555180", client_id: "mcp-inspector" }),
    )).toEqual({
      sessionId: "7df6bb97-ae88-48c9-8118-021451555180",
      clientId: "mcp-inspector",
    });
  });

  it("rejects a regular app token at the OAuth boundary", () => {
    expect(() => assertOAuthClientAccessToken(
      token({ session_id: "7df6bb97-ae88-48c9-8118-021451555180" }),
    )).toThrow(AuthSessionError);
  });

  it("keeps the trusted-device check for first-party sessions", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    await expect(assertActiveAuthSession(
      { rpc },
      token({ session_id: "7df6bb97-ae88-48c9-8118-021451555180" }),
      "d6639086-069f-4b44-8394-f092e5a89a17",
    )).rejects.toBeInstanceOf(AuthSessionError);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
