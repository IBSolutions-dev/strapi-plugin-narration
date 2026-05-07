import type { Core } from "@strapi/strapi";
import { describe, expect, it, vi } from "vitest";

import destroy from "./destroy";
import { resolveElevenLabsProxyUrl, getElevenLabsProxyAgent } from "./utils/elevenlabs-proxy";
import {
  acquireNarrationGenerateLock,
  makeNarrationGenerateLockKey,
} from "./utils/narration-generate-lock";
import { getCachedVoicesList, setCachedVoicesList } from "./utils/voices-list-cache";

function mockStrapi() {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as Core.Strapi;
}

describe("destroy()", () => {
  it("clears in-memory voices cache", () => {
    setCachedVoicesList([{ voice_id: "a", name: "A" }]);
    expect(getCachedVoicesList(60_000)).not.toBeNull();
    destroy({ strapi: mockStrapi() });
    expect(getCachedVoicesList(60_000)).toBeNull();
  });

  it("clears in-memory generate locks", () => {
    const key = makeNarrationGenerateLockKey({
      uid: "u",
      documentId: "d",
      attributeName: "n",
      locale: "",
      voiceId: "v",
    });
    acquireNarrationGenerateLock(key);
    destroy({ strapi: mockStrapi() });
    expect(() => acquireNarrationGenerateLock(key)).not.toThrow();
  });

  it("disposes the cached proxy agent without throwing when none was created", () => {
    expect(resolveElevenLabsProxyUrl()).toBeUndefined();
    expect(() => destroy({ strapi: mockStrapi() })).not.toThrow();
  });

  it("disposes a previously cached proxy agent", () => {
    const prev = process.env.HTTPS_PROXY;
    process.env.HTTPS_PROXY = "http://example.invalid:3128";
    try {
      const agent = getElevenLabsProxyAgent();
      expect(agent).toBeDefined();
      destroy({ strapi: mockStrapi() });
      // After destroy, `resolveElevenLabsProxyUrl` still sees the env, but the
      // cache was cleared so a subsequent call constructs a fresh agent.
      const next = getElevenLabsProxyAgent();
      expect(next).toBeDefined();
      expect(next).not.toBe(agent);
    } finally {
      if (prev === undefined) delete process.env.HTTPS_PROXY;
      else process.env.HTTPS_PROXY = prev;
      destroy({ strapi: mockStrapi() });
    }
  });
});
