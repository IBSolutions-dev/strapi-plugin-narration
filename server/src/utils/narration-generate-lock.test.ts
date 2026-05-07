import { afterEach, describe, expect, it } from "vitest";
import {
  acquireNarrationGenerateLock,
  clearNarrationGenerateLocks,
  DEFAULT_LOCK_TTL_MS,
  makeNarrationGenerateLockKey,
  releaseNarrationGenerateLock,
  resetNarrationGenerateLocksForTesting,
} from "./narration-generate-lock";

afterEach(() => {
  clearNarrationGenerateLocks();
});

describe("narration-generate-lock", () => {
  it("makeNarrationGenerateLockKey is stable for same inputs", () => {
    const a = makeNarrationGenerateLockKey({
      uid: "api::x.x",
      documentId: "d1",
      attributeName: "audio",
      locale: null,
      voiceId: "v1",
    });
    const b = makeNarrationGenerateLockKey({
      uid: "api::x.x",
      documentId: "d1",
      attributeName: "audio",
      locale: undefined,
      voiceId: "v1",
    });
    expect(a).toBe(b);
  });

  it("acquire then acquire throws", () => {
    const k = makeNarrationGenerateLockKey({
      uid: "u",
      documentId: "d",
      attributeName: "n",
      locale: "",
      voiceId: "v",
    });
    acquireNarrationGenerateLock(k);
    expect(() => acquireNarrationGenerateLock(k)).toThrow(/already running/);
    releaseNarrationGenerateLock(k);
    expect(() => acquireNarrationGenerateLock(k)).not.toThrow();
    releaseNarrationGenerateLock(k);
  });

  it("re-acquire succeeds when the prior entry is older than the TTL (stale takeover)", () => {
    const k = "stale-key";
    let now = 1_000_000;
    acquireNarrationGenerateLock(k, { now: () => now });
    expect(() => acquireNarrationGenerateLock(k, { now: () => now })).toThrow(/already running/);
    now += DEFAULT_LOCK_TTL_MS + 1;
    expect(() => acquireNarrationGenerateLock(k, { now: () => now })).not.toThrow();
  });

  it("custom staleAfterMs overrides DEFAULT_LOCK_TTL_MS", () => {
    const k = "ttl-key";
    let now = 0;
    acquireNarrationGenerateLock(k, { now: () => now, staleAfterMs: 50 });
    expect(() => acquireNarrationGenerateLock(k, { now: () => now, staleAfterMs: 50 })).toThrow(
      /already running/
    );
    now = 60;
    expect(() =>
      acquireNarrationGenerateLock(k, { now: () => now, staleAfterMs: 50 })
    ).not.toThrow();
  });

  it("clearNarrationGenerateLocks drops every entry", () => {
    acquireNarrationGenerateLock("a");
    acquireNarrationGenerateLock("b");
    clearNarrationGenerateLocks();
    expect(() => acquireNarrationGenerateLock("a")).not.toThrow();
    expect(() => acquireNarrationGenerateLock("b")).not.toThrow();
  });

  it("resetNarrationGenerateLocksForTesting still works as backward-compatible alias", () => {
    acquireNarrationGenerateLock("legacy");
    resetNarrationGenerateLocksForTesting();
    expect(() => acquireNarrationGenerateLock("legacy")).not.toThrow();
  });
});
