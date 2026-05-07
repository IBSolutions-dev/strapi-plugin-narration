import { describe, expect, it } from "vitest";
import { createElevenLabsHttpError, ElevenLabsNetworkError } from "./elevenlabs-errors";
import { narrationAdminErrorResponse } from "./narration-admin-error-response";

describe("narrationAdminErrorResponse", () => {
  it("uses 502 and passes message for ElevenLabsNetworkError", () => {
    const err = new ElevenLabsNetworkError(
      "Could not reach ElevenLabs over the network. Technical detail: x",
      {
        code: "UND_ERR_SOCKET",
        formatted: "UND_ERR_SOCKET: x",
      }
    );
    const { status, body } = narrationAdminErrorResponse(err, {
      narrationRequestId: "rid-1",
    });
    expect(status).toBe(502);
    expect(body.error.message).toContain("Could not reach ElevenLabs");
    expect(body.error.details.narrationRequestId).toBe("rid-1");
    expect(body.error.details.elevenLabs).toMatchObject({
      kind: "network",
      code: "UND_ERR_SOCKET",
    });
  });

  it("preserves upstream HTTP status for ElevenLabsHttpError", () => {
    const err = createElevenLabsHttpError(401, '{"detail":"nope"}');
    const { status, body } = narrationAdminErrorResponse(err);
    expect(status).toBe(401);
    expect(body.error.message.length).toBeGreaterThan(0);
    expect(body.error.details.elevenLabs).toBeDefined();
  });

  it("uses 400 for generic errors and attaches narrationRequestId", () => {
    const { status, body } = narrationAdminErrorResponse(new Error("bad input"), {
      narrationRequestId: "r2",
    });
    expect(status).toBe(400);
    expect(body.error.message).toBe("bad input");
    expect(body.error.details.narrationRequestId).toBe("r2");
  });

  it("uses 400 with stringified non-Error values when no narrationRequestId is provided", () => {
    const { status, body } = narrationAdminErrorResponse("plain-string-error");
    expect(status).toBe(400);
    expect(body.error.message).toBe("plain-string-error");
    expect(body.error.details).toEqual({});
  });

  it("falls back to 502 when ElevenLabsHttpError carries a non-HTTP status", () => {
    const httpErr = createElevenLabsHttpError(700, "weird");
    const { status, body } = narrationAdminErrorResponse(httpErr);
    expect(status).toBe(502);
    expect(body.error.status).toBe(502);
  });
});
