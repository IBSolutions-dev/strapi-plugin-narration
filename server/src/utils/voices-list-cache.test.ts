import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCachedVoicesList,
  resetVoicesListCacheForTesting,
  setCachedVoicesList,
} from "./voices-list-cache";

afterEach(() => {
  resetVoicesListCacheForTesting();
});

describe("voices-list-cache", () => {
  it("returns null when empty", () => {
    expect(getCachedVoicesList(60_000)).toBeNull();
  });

  it("returns voices within TTL", () => {
    setCachedVoicesList([
      { voice_id: "a", name: "A" },
      { voice_id: "b", name: "B", category: "premade" },
    ]);
    const hit = getCachedVoicesList(60_000);
    expect(hit).toHaveLength(2);
    expect(hit?.[0].voice_id).toBe("a");
  });

  it("expires after TTL", () => {
    vi.useFakeTimers();
    setCachedVoicesList([{ voice_id: "x", name: "X" }]);
    expect(getCachedVoicesList(1_000)).not.toBeNull();
    vi.advanceTimersByTime(1_001);
    expect(getCachedVoicesList(1_000)).toBeNull();
    vi.useRealTimers();
  });

  it("skips cache when ttl is 0", () => {
    setCachedVoicesList([{ voice_id: "x", name: "X" }]);
    expect(getCachedVoicesList(0)).toBeNull();
  });
});
