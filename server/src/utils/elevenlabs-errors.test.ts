import { describe, expect, it } from "vitest";
import {
  createElevenLabsHttpError,
  createElevenLabsNetworkError,
  ElevenLabsHttpError,
  ElevenLabsNetworkError,
  findElevenLabsNetworkErrorInCauseChain,
  formatElevenLabsErrorResponse,
  inferElevenLabsErrorKind,
} from "./elevenlabs-errors";

describe("formatElevenLabsErrorResponse", () => {
  it("extracts detail.message from ElevenLabs JSON", () => {
    const body = JSON.stringify({
      detail: {
        status: "missing_permissions",
        message:
          "The API key you used is missing the permission voices_read to execute this operation.",
      },
    });
    expect(formatElevenLabsErrorResponse(401, body)).toBe(
      "ElevenLabs (401): The API key you used is missing the permission voices_read to execute this operation."
    );
  });

  it("handles string detail", () => {
    expect(formatElevenLabsErrorResponse(403, '{"detail":"nope"}')).toBe("ElevenLabs (403): nope");
  });

  it("falls back to raw snippet when not JSON", () => {
    expect(formatElevenLabsErrorResponse(500, "upstream failed")).toBe(
      "ElevenLabs (500): upstream failed"
    );
  });
});

describe("inferElevenLabsErrorKind", () => {
  const fmt = (s: number, b: string) => formatElevenLabsErrorResponse(s, b);

  it("classifies credit / quota responses as quota_exceeded", () => {
    const body = JSON.stringify({
      detail:
        "This request exceeds your API key quota of 10. You have 10 credits remaining, while 8026 credits are required.",
    });
    const formatted = fmt(401, body);
    expect(inferElevenLabsErrorKind(401, body, formatted)).toBe("quota_exceeded");
  });

  it("classifies 429 as rate_limited", () => {
    const body = '{"detail":"Too many requests"}';
    const formatted = fmt(429, body);
    expect(inferElevenLabsErrorKind(429, body, formatted)).toBe("rate_limited");
  });

  it("classifies missing permission as forbidden", () => {
    const body = JSON.stringify({
      detail: {
        message:
          "The API key you used is missing the permission voices_read to execute this operation.",
      },
    });
    const formatted = fmt(401, body);
    expect(inferElevenLabsErrorKind(401, body, formatted)).toBe("forbidden");
  });

  it("classifies plain 401 without quota/permission hints as unauthorized", () => {
    const body = '{"detail":"Invalid API key"}';
    const formatted = fmt(401, body);
    expect(inferElevenLabsErrorKind(401, body, formatted)).toBe("unauthorized");
  });
});

describe("createElevenLabsHttpError", () => {
  it("sets kind quota_exceeded and a helpful message for credit errors", () => {
    const body = JSON.stringify({
      detail:
        "This request exceeds your API key quota of 10. You have 10 credits remaining, while 8026 credits are required.",
    });
    const err = createElevenLabsHttpError(401, body);
    expect(err).toBeInstanceOf(ElevenLabsHttpError);
    expect(err.kind).toBe("quota_exceeded");
    expect(err.status).toBe(401);
    expect(err.message).toContain("Not enough ElevenLabs credits");
    expect(err.message).toContain("Technical detail:");
    expect(err.formatted).toContain("ElevenLabs (401):");
  });
});

describe("createElevenLabsNetworkError", () => {
  it("wraps fetch failed with guidance and structured formatted detail", () => {
    const err = createElevenLabsNetworkError(new TypeError("fetch failed"));
    expect(err).toBeInstanceOf(ElevenLabsNetworkError);
    expect(err.kind).toBe("network");
    expect(err.message).toContain("Could not reach ElevenLabs");
    expect(err.message).toContain("api.elevenlabs.io");
    expect(err.formatted).toContain("fetch failed");
  });

  it("extracts errno code from Error cause chain", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:443"), {
      code: "ECONNREFUSED",
    });
    const top = new TypeError("fetch failed", { cause });
    const err = createElevenLabsNetworkError(top);
    expect(err.code).toBe("ECONNREFUSED");
    expect(err.formatted).toMatch(/ECONNREFUSED/);
    expect(err.formatted).toMatch(/fetch failed/);
  });
});

describe("findElevenLabsNetworkErrorInCauseChain", () => {
  it("returns nested network error from SDK-style TypeError wrapper", () => {
    const inner = createElevenLabsNetworkError(
      Object.assign(new Error("other side closed"), {
        code: "UND_ERR_SOCKET",
      })
    );
    const wrapped = new TypeError("fetch failed", { cause: inner });
    expect(findElevenLabsNetworkErrorInCauseChain(wrapped)).toBe(inner);
  });

  it("returns undefined when no network error is in the chain", () => {
    expect(findElevenLabsNetworkErrorInCauseChain(new Error("plain"))).toBeUndefined();
  });
});
