import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import { resetVoicesListCacheForTesting } from "../utils/voices-list-cache";
import elevenlabsFactory from "./elevenlabs";

function mockStrapi(config: Record<string, unknown>, log = vi.fn()) {
  return {
    config: {
      get: (key: string) => (key === PLUGIN_CONFIG_KEY ? config : undefined),
    },
    log: {
      info: log,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as never;
}

describe("elevenlabs.isApiKeyConfigured", () => {
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = prevKey;
  });

  it("returns false when config has no key and env is unset", () => {
    const svc = elevenlabsFactory({ strapi: mockStrapi({}) });
    expect(svc.isApiKeyConfigured()).toBe(false);
  });

  it("returns true when apiKey is set in plugin config", () => {
    const svc = elevenlabsFactory({
      strapi: mockStrapi({ apiKey: "from-config" }),
    });
    expect(svc.isApiKeyConfigured()).toBe(true);
  });

  it("returns true when ELEVENLABS_API_KEY env is set", () => {
    process.env.ELEVENLABS_API_KEY = "from-env";
    const svc = elevenlabsFactory({ strapi: mockStrapi({}) });
    expect(svc.isApiKeyConfigured()).toBe(true);
  });
});

describe("elevenlabs.listVoices", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetVoicesListCacheForTesting();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetVoicesListCacheForTesting();
  });

  it("does not call fetch when voiceCatalog is set", async () => {
    const svc = elevenlabsFactory({
      strapi: mockStrapi({
        voiceCatalog: [{ voice_id: "static-1", name: "Static" }],
        voicesListCacheTtlMs: 60_000,
      }),
    });
    const voices = await svc.listVoices();
    expect(voices).toEqual([{ voice_id: "static-1", name: "Static" }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches ElevenLabs response until TTL expires", async () => {
    vi.useFakeTimers();
    const strapi = mockStrapi({
      voicesListCacheTtlMs: 60_000,
      apiKey: "test-key",
    });
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            voices: [{ voice_id: "a", name: "A" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );

    const svc = elevenlabsFactory({ strapi });
    await svc.listVoices();
    await svc.listVoices();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_001);
    await svc.listVoices();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("uses ttl 0 to skip cache", async () => {
    const strapi = mockStrapi({
      voicesListCacheTtlMs: 0,
      apiKey: "k",
    });
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ voices: [{ voice_id: "x", name: "X" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );

    const svc = elevenlabsFactory({ strapi });
    await svc.listVoices();
    await svc.listVoices();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
