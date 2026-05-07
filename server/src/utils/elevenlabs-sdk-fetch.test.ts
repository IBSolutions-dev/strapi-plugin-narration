import type { Core } from "@strapi/strapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createElevenLabsSdkFetch, withElevenLabsSdkFetchContext } from "./elevenlabs-sdk-fetch";
import { resetElevenLabsProxyAgentForTesting } from "./elevenlabs-proxy";

function mockStrapi() {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as Core.Strapi;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetElevenLabsProxyAgentForTesting();
  delete process.env.HTTPS_PROXY;
  delete process.env.ELEVENLABS_HTTPS_PROXY;
});

describe("createElevenLabsSdkFetch", () => {
  it("delegates to globalThis.fetch when no proxy is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([7]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const strapi = mockStrapi();
    const sdkFetch = createElevenLabsSdkFetch(strapi);
    const res = await withElevenLabsSdkFetchContext(
      { narrationRequestId: "rid-no-proxy", operation: "test" },
      () => sdkFetch("https://api.elevenlabs.io/v1/voices")
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs and wraps fetch failures in ElevenLabsNetworkError", async () => {
    const transport = new Error("boom");
    const fetchMock = vi.fn().mockRejectedValue(transport);
    vi.stubGlobal("fetch", fetchMock);
    const strapi = mockStrapi();
    const sdkFetch = createElevenLabsSdkFetch(strapi);
    await expect(
      withElevenLabsSdkFetchContext({ narrationRequestId: "rid-fail", operation: "test" }, () =>
        sdkFetch("https://api.elevenlabs.io/v1/voices")
      )
    ).rejects.toMatchObject({ name: "ElevenLabsNetworkError" });
    expect(strapi.log.error).toHaveBeenCalled();
  });

  it("uses the undici proxy dispatcher when HTTPS_PROXY is set", async () => {
    process.env.HTTPS_PROXY = "http://example.invalid:3128";
    const strapi = mockStrapi();
    const sdkFetch = createElevenLabsSdkFetch(strapi);
    // We expect the proxy path to throw a network error (the proxy host is
    // unreachable) — but the important assertion is that the wrapper went
    // through the `useProxy` branch.
    await expect(
      withElevenLabsSdkFetchContext({ narrationRequestId: "rid-proxy", operation: "test" }, () =>
        sdkFetch("https://api.elevenlabs.io/v1/voices")
      )
    ).rejects.toMatchObject({ name: "ElevenLabsNetworkError" });
    const fetchStartLog = (strapi.log.info as ReturnType<typeof vi.fn>).mock.calls.find((call) =>
      String(call[0] ?? "").includes("elevenlabs.fetch.start")
    );
    expect(fetchStartLog?.[0]).toContain('"httpsProxyConfigured":true');
  });

  it("falls back to defaults when no AsyncLocalStorage context is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const strapi = mockStrapi();
    const sdkFetch = createElevenLabsSdkFetch(strapi);
    await sdkFetch("https://api.elevenlabs.io/v1/voices");
    const startLog = (strapi.log.info as ReturnType<typeof vi.fn>).mock.calls.find((call) =>
      String(call[0] ?? "").includes("elevenlabs.fetch.start")
    );
    expect(startLog?.[0]).toContain('"narrationRequestId":"n/a"');
    expect(startLog?.[0]).toContain('"operation":"sdk_http"');
  });
});
