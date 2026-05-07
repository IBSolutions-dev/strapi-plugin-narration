import { describe, expect, it } from "vitest";
import {
  isSecretLikeKey,
  pickUpstreamHeadersForLog,
  REDACTED_KEY_LABEL,
  SECRET_KEY_PATTERNS,
  summarizeValuesKeys,
} from "./narration-telemetry";

describe("pickUpstreamHeadersForLog", () => {
  it("keeps allowlisted and x-* headers", () => {
    const h = new Headers();
    h.set("Content-Type", "audio/mpeg");
    h.set("Content-Length", "12345");
    h.set("X-Request-Id", "req-abc");
    h.set("Set-Cookie", "secret=1");
    const out = pickUpstreamHeadersForLog(h);
    expect(out["content-type"]).toBe("audio/mpeg");
    expect(out["content-length"]).toBe("12345");
    expect(out["x-request-id"]).toBe("req-abc");
    expect(out["set-cookie"]).toBeUndefined();
  });

  it("truncates very long x-* values", () => {
    const h = new Headers();
    const long = "x".repeat(600);
    h.set("X-Debug", long);
    const out = pickUpstreamHeadersForLog(h);
    expect(out["x-debug"]?.length).toBeLessThanOrEqual(501);
    expect(out["x-debug"]?.endsWith("…")).toBe(true);
  });
});

describe("summarizeValuesKeys", () => {
  it("returns empty for nullish", () => {
    expect(summarizeValuesKeys(null)).toEqual({
      valueFieldCount: 0,
      valueFieldKeys: [],
      redactedKeyCount: 0,
    });
    expect(summarizeValuesKeys(undefined)).toEqual({
      valueFieldCount: 0,
      valueFieldKeys: [],
      redactedKeyCount: 0,
    });
  });

  it("caps listed keys", () => {
    const values: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) values[`k${i}`] = i;
    const { valueFieldCount, valueFieldKeys, redactedKeyCount } = summarizeValuesKeys(values);
    expect(valueFieldCount).toBe(50);
    expect(valueFieldKeys).toHaveLength(40);
    expect(redactedKeyCount).toBe(0);
  });

  it("redacts credential-shaped keys", () => {
    const values: Record<string, unknown> = {
      title: "post",
      description: "ok",
      apiKey: "x",
      api_key: "x",
      "X-API-Key": "x",
      password: "x",
      passwd: "x",
      sessionId: "x",
      authorization: "x",
      bearer_token: "x",
      cookie: "x",
      privateKey: "x",
      clientSecret: "x",
      access_key: "x",
    };
    const { valueFieldKeys, redactedKeyCount, valueFieldCount } = summarizeValuesKeys(values);
    expect(valueFieldCount).toBe(Object.keys(values).length);
    expect(valueFieldKeys).toContain("title");
    expect(valueFieldKeys).toContain("description");
    expect(valueFieldKeys.filter((k) => k === REDACTED_KEY_LABEL).length).toBe(redactedKeyCount);
    expect(redactedKeyCount).toBe(12);
  });

  it("isSecretLikeKey delegates to SECRET_KEY_PATTERNS", () => {
    expect(SECRET_KEY_PATTERNS.length).toBeGreaterThan(0);
    expect(isSecretLikeKey("title")).toBe(false);
    expect(isSecretLikeKey("Authorization")).toBe(true);
    expect(isSecretLikeKey("CLIENT_SECRET")).toBe(true);
    expect(isSecretLikeKey("private-key")).toBe(true);
  });
});
