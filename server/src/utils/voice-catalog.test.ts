import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_VOICES_LIST_CACHE_TTL_MS,
  getVoicesListCacheTtlMs,
  resolveStaticVoiceCatalog,
} from "./voice-catalog";

function mockStrapi(config: unknown) {
  return {
    config: {
      get: (_key: string) => config,
    },
  } as never;
}

describe("resolveStaticVoiceCatalog", () => {
  afterEach(() => {
    delete process.env.ELEVENLABS_VOICE_CATALOG_JSON;
  });

  it("returns null when not configured", () => {
    expect(resolveStaticVoiceCatalog(mockStrapi({}))).toBeNull();
  });

  it("uses plugin voiceCatalog when set", () => {
    const strapi = mockStrapi({
      voiceCatalog: [
        { voice_id: "v1", name: "One" },
        { voice_id: "v2", name: "Two", category: "cloned" },
        { bad: true },
      ],
    });
    const list = resolveStaticVoiceCatalog(strapi);
    expect(list).toEqual([
      { voice_id: "v1", name: "One" },
      { voice_id: "v2", name: "Two", category: "cloned" },
    ]);
  });

  it("falls back to ELEVENLABS_VOICE_CATALOG_JSON", () => {
    process.env.ELEVENLABS_VOICE_CATALOG_JSON = JSON.stringify([{ voice_id: "env1", name: "Env" }]);
    expect(resolveStaticVoiceCatalog(mockStrapi({}))).toEqual([{ voice_id: "env1", name: "Env" }]);
  });

  it("prefers plugin config over env", () => {
    process.env.ELEVENLABS_VOICE_CATALOG_JSON = JSON.stringify([{ voice_id: "env1", name: "Env" }]);
    const strapi = mockStrapi({
      voiceCatalog: [{ voice_id: "cfg1", name: "Cfg" }],
    });
    expect(resolveStaticVoiceCatalog(strapi)).toEqual([{ voice_id: "cfg1", name: "Cfg" }]);
  });
});

describe("getVoicesListCacheTtlMs", () => {
  afterEach(() => {
    delete process.env.ELEVENLABS_VOICES_CACHE_TTL_MS;
  });

  it("defaults to 24h", () => {
    expect(getVoicesListCacheTtlMs(mockStrapi({}))).toBe(DEFAULT_VOICES_LIST_CACHE_TTL_MS);
  });

  it("reads plugin voicesListCacheTtlMs", () => {
    expect(getVoicesListCacheTtlMs(mockStrapi({ voicesListCacheTtlMs: 5_000 }))).toBe(5_000);
  });

  it("clamps negative ttl to 0", () => {
    expect(getVoicesListCacheTtlMs(mockStrapi({ voicesListCacheTtlMs: -10 }))).toBe(0);
  });

  it("reads ELEVENLABS_VOICES_CACHE_TTL_MS", () => {
    process.env.ELEVENLABS_VOICES_CACHE_TTL_MS = "120000";
    expect(getVoicesListCacheTtlMs(mockStrapi({}))).toBe(120_000);
  });
});
