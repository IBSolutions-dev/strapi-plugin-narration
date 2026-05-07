import type { Context } from "koa";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import { PLUGIN_INFO } from "../plugin-version";
import narrationControllerFactory from "./narration";

function mockContext(
  partial: Partial<Context> & {
    request?: { body?: Record<string, unknown> };
    query?: Record<string, string>;
  } = {}
): Context {
  const query = partial.query ?? {};
  return {
    request: { body: partial.request?.body ?? {}, query },
    query,
    state: { ...(partial.state ?? { user: { id: 1 } }) },
    status: 200,
    body: undefined,
    ...partial,
  } as Context;
}

describe("narration controller testTts", () => {
  it("returns 400 when providerId is openai (not live yet)", async () => {
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as never;
    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({
      request: { body: { voiceId: "v1", providerId: "openai" } },
    });
    await ctrl.testTts(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body).toMatchObject({
      error: expect.objectContaining({
        status: 400,
        message: expect.stringContaining("not available"),
        details: expect.objectContaining({ providerId: "openai" }),
      }),
    });
  });

  it("returns 400 when voiceId is missing", async () => {
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as never;
    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({ request: { body: {} } });
    await ctrl.testTts(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body).toMatchObject({
      error: expect.objectContaining({
        status: 400,
        message: expect.stringContaining("voiceId"),
      }),
    });
    expect(
      (ctx.body as { error?: { details?: { narrationRequestId?: string } } })?.error?.details
        ?.narrationRequestId
    ).toBeDefined();
  });

  it("returns base64 MP3 payload when narration.synthesizeSpeechMp3 succeeds", async () => {
    const synthesizeSpeechMp3 = vi.fn().mockResolvedValue(Buffer.from([0x49, 0x44, 0x33]));
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      config: {
        get: (key: string) => (key === PLUGIN_CONFIG_KEY ? { ttsDryRun: false } : undefined),
      },
      plugin: () => ({
        service: (name: string) => (name === "narration" ? { synthesizeSpeechMp3 } : {}),
      }),
    } as never;

    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({
      request: { body: { voiceId: "voice-demo-1" } },
    });

    await ctrl.testTts(ctx);

    expect(synthesizeSpeechMp3).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceId: "voice-demo-1",
        text: "Hello",
      })
    );
    expect(ctx.status).toBe(200);
    const body = ctx.body as {
      data: {
        audioBase64: string;
        byteLength: number;
        mimeType: string;
        dryRun: boolean;
        narrationRequestId: string;
      };
    };
    expect(body.data.mimeType).toBe("audio/mpeg");
    expect(body.data.byteLength).toBe(3);
    expect(body.data.dryRun).toBe(false);
    expect(body.data.audioBase64).toBe(Buffer.from([0x49, 0x44, 0x33]).toString("base64"));
  });

  it("accepts explicit providerId elevenlabs", async () => {
    const synthesizeSpeechMp3 = vi.fn().mockResolvedValue(Buffer.from([0x01]));
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      config: {
        get: (key: string) => (key === PLUGIN_CONFIG_KEY ? { ttsDryRun: false } : undefined),
      },
      plugin: () => ({
        service: (name: string) => (name === "narration" ? { synthesizeSpeechMp3 } : {}),
      }),
    } as never;

    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({
      request: { body: { voiceId: "v2", providerId: "elevenlabs" } },
    });

    await ctrl.testTts(ctx);

    expect(ctx.status).toBe(200);
    expect(synthesizeSpeechMp3).toHaveBeenCalled();
  });
});

describe("narration controller voices", () => {
  it("returns 400 when provider is unknown", async () => {
    const strapi = {} as never;
    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({ query: { provider: "acme-corp" } });
    await ctrl.voices(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body).toMatchObject({
      error: expect.objectContaining({
        message: expect.stringContaining("Unknown"),
        details: expect.objectContaining({ providerId: "acme-corp" }),
      }),
    });
  });

  it("returns 400 when provider is openai", async () => {
    const strapi = {} as never;
    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({ query: { provider: "openai" } });
    await ctrl.voices(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body).toMatchObject({
      error: expect.objectContaining({
        details: expect.objectContaining({ providerId: "openai" }),
      }),
    });
  });

  it("lists voices for default elevenlabs provider", async () => {
    const listVoices = vi.fn().mockResolvedValue([{ voice_id: "a", name: "A" }]);
    const strapi = {
      plugin: () => ({
        service: (name: string) => (name === "elevenlabs" ? { listVoices } : {}),
      }),
    } as never;

    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({ query: {} });
    await ctrl.voices(ctx);

    expect(listVoices).toHaveBeenCalled();
    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({
      data: [{ voice_id: "a", name: "A" }],
    });
  });
});

describe("narration controller providers", () => {
  it("returns public provider list", async () => {
    const strapi = {
      config: {
        get: () => undefined,
      },
      plugin: () => ({
        service: (name: string) =>
          name === "elevenlabs" ? { isApiKeyConfigured: () => false } : {},
      }),
    } as never;

    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext();
    await ctrl.providers(ctx);

    expect(ctx.status).toBe(200);
    const body = ctx.body as {
      data: Array<{ id: string; showInAdminTab: boolean }>;
    };
    expect(body.data.map((p) => p.id)).toEqual(["elevenlabs", "openai"]);
    expect(body.data.every((p) => p.showInAdminTab === true)).toBe(true);
  });
});

describe("narration controller generate", () => {
  it("returns the service result and 200 status on success", async () => {
    const generateFromAdmin = vi
      .fn()
      .mockResolvedValue({ textLength: 5, fileId: 42, narrationRequestId: "rid-ok" });
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      plugin: () => ({
        service: (name: string) => (name === "narration" ? { generateFromAdmin } : {}),
      }),
    } as never;
    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({
      request: {
        body: {
          uid: "api::insight.insight",
          documentId: "doc-1",
          attributeName: "narration",
          voiceId: "voice-1",
        },
      },
    });
    await ctrl.generate(ctx);
    expect(generateFromAdmin).toHaveBeenCalled();
    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({
      data: { textLength: 5, fileId: 42, narrationRequestId: "rid-ok" },
    });
  });

  it("maps service errors through narrationAdminErrorResponse with the request id", async () => {
    const generateFromAdmin = vi.fn().mockRejectedValue(new Error("boom"));
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      plugin: () => ({
        service: (name: string) => (name === "narration" ? { generateFromAdmin } : {}),
      }),
    } as never;
    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext({
      request: {
        body: {
          uid: "api::insight.insight",
          documentId: "doc-1",
          attributeName: "narration",
          voiceId: "voice-1",
        },
      },
    });
    await ctrl.generate(ctx);
    expect(ctx.status).toBe(400);
    expect(ctx.body).toMatchObject({
      error: expect.objectContaining({
        message: "boom",
        details: expect.objectContaining({ narrationRequestId: expect.any(String) }),
      }),
    });
  });
});

describe("narration controller pluginInfo", () => {
  it("returns the package metadata SSOT without touching strapi", async () => {
    const strapi = {} as never;
    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext();
    await ctrl.pluginInfo(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({ data: PLUGIN_INFO });
    expect((ctx.body as { data: { version: string } }).data.version).toBe(PLUGIN_INFO.version);
    expect((ctx.body as { data: { packageName: string } }).data.packageName).toBe(
      "strapi-plugin-narration"
    );
  });
});

describe("narration controller settingsStatus", () => {
  let prevDry: string | undefined;

  beforeEach(() => {
    prevDry = process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
  });

  afterEach(() => {
    if (prevDry === undefined) delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    else process.env.STRAPI_NARRATION_TTS_DRY_RUN = prevDry;
  });

  it("returns non-secret connection snapshot", async () => {
    const strapi = {
      config: {
        get: (key: string) =>
          key === PLUGIN_CONFIG_KEY
            ? {
                modelId: "custom-model",
                maxChars: 42_000,
                voiceCatalog: [],
                ttsDryRun: false,
              }
            : undefined,
      },
      plugin: () => ({
        service: (name: string) =>
          name === "elevenlabs" ? { isApiKeyConfigured: () => true } : {},
      }),
    } as never;

    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext();
    await ctrl.settingsStatus(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({
      data: {
        apiKeyConfigured: true,
        modelId: "custom-model",
        staticVoiceCatalogActive: false,
        maxChars: 42_000,
      },
    });
  });

  it("detects static voice catalog and missing API key without exposing secrets", async () => {
    const strapi = {
      config: {
        get: (key: string) =>
          key === PLUGIN_CONFIG_KEY
            ? {
                voiceCatalog: [{ voice_id: "s1", name: "Static" }],
                ttsDryRun: true,
              }
            : undefined,
      },
      plugin: () => ({
        service: (name: string) =>
          name === "elevenlabs" ? { isApiKeyConfigured: () => false } : {},
      }),
    } as never;

    const ctrl = narrationControllerFactory({ strapi });
    const ctx = mockContext();
    await ctrl.settingsStatus(ctx);

    expect(ctx.body).toEqual({
      data: {
        apiKeyConfigured: false,
        modelId: "eleven_multilingual_v2",
        staticVoiceCatalogActive: true,
        maxChars: 50_000,
      },
    });
  });
});
