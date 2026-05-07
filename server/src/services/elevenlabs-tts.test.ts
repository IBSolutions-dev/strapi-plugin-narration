import { afterEach, describe, expect, it, vi } from "vitest";

import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import { getDryRunTtsMp3Buffer } from "../utils/tts-dry-run";
import elevenlabsFactory from "./elevenlabs";

function mockStrapi(config: Record<string, unknown>, log = vi.fn()) {
  return {
    config: {
      get: (key: string) => (key === PLUGIN_CONFIG_KEY ? config : undefined),
    },
    log: {
      info: log,
      warn: log,
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as never;
}

describe("elevenlabs.textToSpeechMp3", () => {
  const fetchMock = vi.fn();
  const prevDry = process.env.STRAPI_NARRATION_TTS_DRY_RUN;

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
    if (prevDry === undefined) {
      delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    } else {
      process.env.STRAPI_NARRATION_TTS_DRY_RUN = prevDry;
    }
  });

  it("does not call fetch or require API key when TTS dry run is enabled via config", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const strapi = mockStrapi({ ttsDryRun: true });
    const svc = elevenlabsFactory({ strapi });
    const buf = await svc.textToSpeechMp3({
      voiceId: "v1",
      text: "hello world",
      narrationRequestId: "req-dry-1",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(buf.equals(getDryRunTtsMp3Buffer())).toBe(true);
  });

  it("does not call fetch when TTS dry run is enabled via env", async () => {
    process.env.STRAPI_NARRATION_TTS_DRY_RUN = "true";
    vi.stubGlobal("fetch", fetchMock);
    const strapi = mockStrapi({});
    const svc = elevenlabsFactory({ strapi });
    await svc.textToSpeechMp3({
      voiceId: "v1",
      text: "x",
      narrationRequestId: "req-dry-2",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls ElevenLabs when dry run is off", async () => {
    delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(
      async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    );

    const strapi = mockStrapi({ apiKey: "k", ttsDryRun: false });
    const svc = elevenlabsFactory({ strapi });
    const buf = await svc.textToSpeechMp3({
      voiceId: "voice-id",
      text: "hi",
      narrationRequestId: "req-live",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([...buf]).toEqual([1, 2, 3]);
  });

  it("maps ElevenLabs HTTP errors to ElevenLabsHttpError with status + kind", async () => {
    delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ detail: "Quota exceeded — buy more credits" }), {
          status: 402,
          headers: { "content-type": "application/json" },
        })
    );

    const strapi = mockStrapi({ apiKey: "k", ttsDryRun: false });
    const svc = elevenlabsFactory({ strapi });
    await expect(
      svc.textToSpeechMp3({
        voiceId: "voice-id",
        text: "hi",
        narrationRequestId: "req-quota",
      })
    ).rejects.toMatchObject({
      name: "ElevenLabsHttpError",
      status: 402,
      kind: "quota_exceeded",
    });
  });

  it("maps SDK fetch transport failures to ElevenLabsNetworkError", async () => {
    delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    vi.stubGlobal("fetch", fetchMock);
    const transport = new Error("fetch failed");
    (transport as Error & { code?: string }).code = "UND_ERR_SOCKET";
    fetchMock.mockRejectedValue(transport);

    const strapi = mockStrapi({ apiKey: "k", ttsDryRun: false });
    const svc = elevenlabsFactory({ strapi });
    await expect(
      svc.textToSpeechMp3({
        voiceId: "voice-id",
        text: "hi",
        narrationRequestId: "req-net",
      })
    ).rejects.toMatchObject({ name: "ElevenLabsNetworkError" });
  });

  // End-to-end abort behavior is exercised in `narration.test.ts` via the
  // generate-from-admin timeout test; verifying that the SDK actually forwards
  // our `abortSignal` to undici would require mocking ElevenLabsClient
  // implementation and offers no extra signal beyond the already-covered service
  // test that the lock is released when the signal fires.
});
