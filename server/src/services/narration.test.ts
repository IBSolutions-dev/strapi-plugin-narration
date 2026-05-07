import { afterEach, describe, expect, it, vi } from "vitest";
import { STRAPI_PLUGIN_ID } from "../plugin-metadata";
import { CUSTOM_FIELD_UID } from "../utils/narration-options";
import { resetNarrationGenerateLocksForTesting } from "../utils/narration-generate-lock";
import narrationFactory from "./narration";

const logFns = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

afterEach(() => {
  resetNarrationGenerateLocksForTesting();
});

describe("narration.synthesizeSpeechMp3", () => {
  it("delegates to elevenlabs.textToSpeechMp3", async () => {
    const textToSpeechMp3 = vi.fn().mockResolvedValue(Buffer.from("mp3"));
    const strapi = {
      plugin: vi.fn(() => ({
        service: (s: string) => (s === "elevenlabs" ? { textToSpeechMp3 } : {}),
      })),
      log: logFns(),
    };
    const svc = narrationFactory({ strapi } as never);
    const buf = await svc.synthesizeSpeechMp3({
      voiceId: "v1",
      text: "Hello",
      narrationRequestId: "rid-1",
    });
    expect(buf.toString()).toBe("mp3");
    expect(textToSpeechMp3).toHaveBeenCalledWith({
      voiceId: "v1",
      text: "Hello",
      narrationRequestId: "rid-1",
    });
  });
});

describe("narration.generateFromAdmin", () => {
  it("requires attributeName", async () => {
    const strapi = {
      getModel: vi.fn(),
      documents: vi.fn(),
      plugin: vi.fn(),
      config: { get: vi.fn(() => ({})) },
      log: logFns(),
    };
    const svc = narrationFactory({ strapi } as never);
    await expect(
      svc.generateFromAdmin(
        {
          uid: "api::insight.insight",
          documentId: "d1",
          attributeName: "",
          voiceId: "v",
        },
        {}
      )
    ).rejects.toThrow(/required/);
  });

  it("uploads audio and updates narration JSON on the attribute", async () => {
    const findOne = vi.fn().mockResolvedValue({
      title: "Hello narration",
      narration: { voiceId: "prev" },
    });
    const update = vi.fn().mockResolvedValue({});
    const upload = vi.fn().mockResolvedValue([{ id: 99 }]);
    const textToSpeechMp3 = vi.fn().mockResolvedValue(Buffer.from("fake-mp3"));

    const strapi = {
      getModel: vi.fn(() => ({
        attributes: {
          narration: {
            type: "json",
            customField: CUSTOM_FIELD_UID,
            options: {
              narrationSources: [{ field: "title", kind: "scalar" }],
            },
          },
        },
      })),
      config: { get: vi.fn(() => ({})) },
      documents: vi.fn(() => ({ findOne, update })),
      log: logFns(),
      plugin: vi.fn((name: string) => {
        if (name === STRAPI_PLUGIN_ID) {
          return {
            service: (s: string) => (s === "elevenlabs" ? { textToSpeechMp3 } : {}),
          };
        }
        if (name === "upload") {
          return { service: () => ({ upload }) };
        }
        return { service: () => ({}) };
      }),
    };

    const svc = narrationFactory({ strapi } as never);
    const result = await svc.generateFromAdmin(
      {
        uid: "api::insight.insight",
        documentId: "doc-1",
        attributeName: "narration",
        voiceId: "voice-1",
        values: null,
      },
      { user: { id: 1 }, narrationRequestId: "test-req-id" }
    );

    expect(textToSpeechMp3).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceId: "voice-1",
        text: "Hello narration",
        narrationRequestId: "test-req-id",
      })
    );
    const ttsCallArg = textToSpeechMp3.mock.calls[0]?.[0] as { signal?: AbortSignal };
    expect(ttsCallArg.signal).toBeInstanceOf(AbortSignal);
    expect(upload).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        data: {
          narration: { voiceId: "voice-1", audioFileId: 99 },
        },
      })
    );
    expect(result.fileId).toBe(99);
    expect(result.narrationRequestId).toBe("test-req-id");
  });

  it("rejects a second concurrent generate for the same entry field (no second TTS)", async () => {
    let finishTts!: (b: Buffer) => void;
    const ttsPromise = new Promise<Buffer>((resolve) => {
      finishTts = resolve;
    });
    const textToSpeechMp3 = vi.fn().mockImplementation(() => ttsPromise);

    const findOne = vi.fn().mockResolvedValue({
      title: "Hello narration",
      narration: { voiceId: "prev" },
    });
    const update = vi.fn().mockResolvedValue({});
    const upload = vi.fn().mockResolvedValue([{ id: 99 }]);

    const strapi = {
      getModel: vi.fn(() => ({
        attributes: {
          narration: {
            type: "json",
            customField: CUSTOM_FIELD_UID,
            options: {
              narrationSources: [{ field: "title", kind: "scalar" }],
            },
          },
        },
      })),
      config: { get: vi.fn(() => ({})) },
      documents: vi.fn(() => ({ findOne, update })),
      log: logFns(),
      plugin: vi.fn((name: string) => {
        if (name === STRAPI_PLUGIN_ID) {
          return {
            service: (s: string) => (s === "elevenlabs" ? { textToSpeechMp3 } : {}),
          };
        }
        if (name === "upload") {
          return { service: () => ({ upload }) };
        }
        return { service: () => ({}) };
      }),
    };

    const svc = narrationFactory({ strapi } as never);
    const body = {
      uid: "api::insight.insight",
      documentId: "doc-1",
      attributeName: "narration",
      voiceId: "voice-1",
      values: null,
    };
    const p1 = svc.generateFromAdmin(body, {
      user: { id: 1 },
      narrationRequestId: "a",
    });
    await Promise.resolve();
    await expect(
      svc.generateFromAdmin(body, { user: { id: 1 }, narrationRequestId: "b" })
    ).rejects.toThrow(/already running/);
    finishTts(Buffer.from("fake-mp3"));
    await p1;
    expect(textToSpeechMp3).toHaveBeenCalledTimes(1);
  });

  it("aborts TTS and releases the lock when the configured timeout fires", async () => {
    const findOne = vi.fn().mockResolvedValue({
      title: "Hello narration",
      narration: { voiceId: "prev" },
    });
    const update = vi.fn();
    const upload = vi.fn();
    const textToSpeechMp3 = vi.fn().mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise<Buffer>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(signal.reason ?? new Error("aborted"));
          });
        })
    );

    const strapi = {
      getModel: vi.fn(() => ({
        attributes: {
          narration: {
            type: "json",
            customField: CUSTOM_FIELD_UID,
            options: {
              narrationSources: [{ field: "title", kind: "scalar" }],
            },
          },
        },
      })),
      config: {
        get: vi.fn(() => ({ ttsRequestTimeoutMs: 1 })),
      },
      documents: vi.fn(() => ({ findOne, update })),
      log: logFns(),
      plugin: vi.fn((name: string) => {
        if (name === STRAPI_PLUGIN_ID) {
          return {
            service: (s: string) => (s === "elevenlabs" ? { textToSpeechMp3 } : {}),
          };
        }
        if (name === "upload") {
          return { service: () => ({ upload }) };
        }
        return { service: () => ({}) };
      }),
    };

    const svc = narrationFactory({ strapi } as never);
    await expect(
      svc.generateFromAdmin(
        {
          uid: "api::insight.insight",
          documentId: "doc-timeout",
          attributeName: "narration",
          voiceId: "voice-timeout",
          values: null,
        },
        { user: { id: 1 }, narrationRequestId: "rid-timeout" }
      )
    ).rejects.toThrow(/timeout|aborted/i);
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();

    // Lock must be released so the next call can proceed.
    upload.mockResolvedValueOnce([{ id: 7 }]);
    update.mockResolvedValueOnce({});
    textToSpeechMp3.mockReset();
    textToSpeechMp3.mockResolvedValueOnce(Buffer.from("ok"));
    const result = await svc.generateFromAdmin(
      {
        uid: "api::insight.insight",
        documentId: "doc-timeout",
        attributeName: "narration",
        voiceId: "voice-timeout",
        values: null,
      },
      { user: { id: 1 }, narrationRequestId: "rid-after-timeout" }
    );
    expect(result.fileId).toBe(7);
  });

  it("throws when narrationSources is empty", async () => {
    const findOne = vi.fn().mockResolvedValue({ title: "x" });
    const strapi = {
      getModel: vi.fn(() => ({
        attributes: {
          narration: {
            type: "json",
            customField: CUSTOM_FIELD_UID,
            options: { narrationSources: [] },
          },
        },
      })),
      config: { get: vi.fn(() => ({})) },
      documents: vi.fn(() => ({ findOne, update: vi.fn() })),
      log: logFns(),
      plugin: vi.fn(() => ({
        service: () => ({}),
      })),
    };
    const svc = narrationFactory({ strapi } as never);
    await expect(
      svc.generateFromAdmin(
        {
          uid: "api::x.x",
          documentId: "d",
          attributeName: "narration",
          voiceId: "v",
        },
        {}
      )
    ).rejects.toThrow(/no configured sources/);
  });
});
