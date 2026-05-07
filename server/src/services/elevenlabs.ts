import type { Core } from "@strapi/strapi";
import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";

import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import {
  createElevenLabsHttpError,
  createElevenLabsNetworkError,
  ElevenLabsHttpError,
  ElevenLabsNetworkError,
  findElevenLabsNetworkErrorInCauseChain,
} from "../utils/elevenlabs-errors";
import {
  createElevenLabsSdkFetch,
  withElevenLabsSdkFetchContext,
} from "../utils/elevenlabs-sdk-fetch";
import {
  createNarrationRequestId,
  logNarrationEvent,
  pickUpstreamHeadersForLog,
} from "../utils/narration-telemetry";
import { readableStreamToBuffer } from "../utils/readable-stream-to-buffer";
import { getDryRunTtsMp3Buffer, isTtsDryRunEnabled } from "../utils/tts-dry-run";
import { getVoicesListCacheTtlMs, resolveStaticVoiceCatalog } from "../utils/voice-catalog";
import { getCachedVoicesList, setCachedVoicesList } from "../utils/voices-list-cache";

function getApiKey(strapi: Core.Strapi): string {
  const cfg = strapi.config.get(PLUGIN_CONFIG_KEY) as { apiKey?: string } | undefined;
  const fromConfig = (cfg?.apiKey ?? "").trim();
  if (fromConfig) return fromConfig;
  const fromEnv = process.env.ELEVENLABS_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return "";
}

function assertApiKey(strapi: Core.Strapi): string {
  const key = getApiKey(strapi);
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not set (or plugin config apiKey is empty)");
  }
  return key;
}

function createClient(strapi: Core.Strapi): ElevenLabsClient {
  return new ElevenLabsClient({
    apiKey: () => getApiKey(strapi),
    fetch: createElevenLabsSdkFetch(strapi),
    /** Avoid POST retries that could double-charge TTS. */
    maxRetries: 0,
  });
}

function headersForTelemetry(raw: { headers?: unknown }): Headers {
  const h = raw.headers;
  if (h instanceof Headers) return h;
  if (h != null && typeof h === "object") {
    return new Headers(h as Record<string, string>);
  }
  return new Headers();
}

function throwMappedSdkError(err: unknown): never {
  if (err instanceof ElevenLabsHttpError) throw err;
  if (err instanceof ElevenLabsNetworkError) throw err;
  const nestedNet = findElevenLabsNetworkErrorInCauseChain(err);
  if (nestedNet) throw nestedNet;
  if (err instanceof ElevenLabsError && err.statusCode != null) {
    const raw = err.body;
    const bodyText =
      typeof raw === "string" ? raw : raw !== undefined ? JSON.stringify(raw) : (err.message ?? "");
    throw createElevenLabsHttpError(err.statusCode, bodyText);
  }
  if (err instanceof Error) {
    throw createElevenLabsNetworkError(err);
  }
  throw err;
}

/** Map SDK voice model to the plugin’s snake_case API shape (admin, caches). */
function toPluginVoice(v: { voiceId: string; name?: string; category?: unknown }): ElevenLabsVoice {
  return {
    voice_id: v.voiceId,
    name: v.name ?? "",
    category:
      typeof v.category === "string"
        ? v.category
        : v.category != null
          ? String(v.category)
          : undefined,
  };
}

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category?: string;
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  isApiKeyConfigured(): boolean {
    return getApiKey(strapi).length > 0;
  },

  async listVoices(): Promise<ElevenLabsVoice[]> {
    const narrationRequestId = createNarrationRequestId();
    const staticCatalog = resolveStaticVoiceCatalog(strapi);
    if (staticCatalog !== null && staticCatalog.length > 0) {
      logNarrationEvent(strapi, "info", "elevenlabs.list_voices.static_catalog", {
        narrationRequestId,
        voiceCount: staticCatalog.length,
      });
      return staticCatalog.map((v) => ({ ...v }));
    }

    const ttlMs = getVoicesListCacheTtlMs(strapi);
    const cached = getCachedVoicesList(ttlMs);
    if (cached !== null) {
      logNarrationEvent(strapi, "info", "elevenlabs.list_voices.cache_hit", {
        narrationRequestId,
        voiceCount: cached.length,
        ttlMs,
      });
      return cached.map((v) => ({ ...v }));
    }

    assertApiKey(strapi);
    const client = createClient(strapi);

    try {
      const { data, rawResponse } = await withElevenLabsSdkFetchContext(
        { narrationRequestId, operation: "list_voices" },
        () => client.voices.getAll().withRawResponse()
      );

      logNarrationEvent(strapi, "info", "elevenlabs.http.response", {
        narrationRequestId,
        operation: "list_voices",
        status: rawResponse.status,
        ok: rawResponse.status >= 200 && rawResponse.status < 300,
        headers: pickUpstreamHeadersForLog(headersForTelemetry(rawResponse)),
      });

      const voices = (data.voices ?? []).map(toPluginVoice);
      setCachedVoicesList(voices);
      logNarrationEvent(strapi, "info", "elevenlabs.list_voices.complete", {
        narrationRequestId,
        voiceCount: voices.length,
        ttlMs,
      });
      return voices;
    } catch (err) {
      if (err instanceof ElevenLabsError && err.statusCode != null) {
        const raw = err.body;
        const bodyText =
          typeof raw === "string"
            ? raw
            : raw !== undefined
              ? JSON.stringify(raw)
              : (err.message ?? "");
        logNarrationEvent(strapi, "error", "elevenlabs.http.error_body", {
          narrationRequestId,
          operation: "list_voices",
          status: err.statusCode,
          bodyLength: bodyText.length,
          bodyPreview: bodyText.length > 800 ? `${bodyText.slice(0, 800)}…` : bodyText,
        });
      }
      throwMappedSdkError(err);
    }
  },

  async textToSpeechMp3(params: {
    voiceId: string;
    text: string;
    modelId?: string;
    /** Correlate with narration.generate.* logs (required for billing forensics). */
    narrationRequestId: string;
    /**
     * Optional abort signal — when fired, the SDK fetch is cancelled so the
     * caller's `finally` (lock release) runs in bounded time even on stuck
     * TTS network calls.
     */
    signal?: AbortSignal;
  }): Promise<Buffer> {
    const pluginCfg = strapi.config.get(PLUGIN_CONFIG_KEY) as { modelId?: string } | undefined;
    const modelId = params.modelId ?? pluginCfg?.modelId ?? "eleven_multilingual_v2";
    const { narrationRequestId, voiceId, signal } = params;
    const textLength = params.text.length;

    if (isTtsDryRunEnabled(strapi)) {
      logNarrationEvent(strapi, "warn", "elevenlabs.tts.dry_run", {
        narrationRequestId,
        operation: "text_to_speech",
        modelId,
        voiceId,
        textLength,
        note: "No ElevenLabs request; returning placeholder MP3. Unset STRAPI_NARRATION_TTS_DRY_RUN for real TTS (billable).",
      });
      return getDryRunTtsMp3Buffer();
    }

    assertApiKey(strapi);
    const client = createClient(strapi);

    const requestPayload = {
      text: params.text,
      modelId,
      outputFormat: "mp3_44100_128" as const,
    };
    logNarrationEvent(strapi, "info", "elevenlabs.tts.request", {
      narrationRequestId,
      operation: "text_to_speech",
      modelId,
      voiceId,
      textLength,
      requestBodyBytes: Buffer.byteLength(
        JSON.stringify({
          text: params.text,
          model_id: modelId,
          output_format: requestPayload.outputFormat,
        }),
        "utf8"
      ),
    });

    try {
      const { data: stream, rawResponse } = await withElevenLabsSdkFetchContext(
        { narrationRequestId, operation: "text_to_speech" },
        () =>
          client.textToSpeech
            .convert(voiceId, requestPayload, signal ? { abortSignal: signal } : undefined)
            .withRawResponse()
      );

      logNarrationEvent(strapi, "info", "elevenlabs.http.response", {
        narrationRequestId,
        operation: "text_to_speech",
        status: rawResponse.status,
        ok: rawResponse.status >= 200 && rawResponse.status < 300,
        headers: pickUpstreamHeadersForLog(headersForTelemetry(rawResponse)),
      });

      let audioBytes = 0;
      try {
        const buf = await readableStreamToBuffer(stream);
        audioBytes = buf.byteLength;
        logNarrationEvent(strapi, "info", "elevenlabs.tts.billed_audio_received", {
          narrationRequestId,
          operation: "text_to_speech",
          audioBytes,
          textLength,
          voiceId,
          modelId,
          note: "ElevenLabs typically charges when audio is generated. If the admin request still fails, check later pipeline stages (temp file, upload plugin, document update) in logs for this narrationRequestId.",
        });
        return buf;
      } catch (readErr) {
        logNarrationEvent(strapi, "error", "elevenlabs.tts.body_read_failed", {
          narrationRequestId,
          operation: "text_to_speech",
          readErrorName: readErr instanceof Error ? readErr.name : typeof readErr,
          readErrorMessage: readErr instanceof Error ? readErr.message : String(readErr),
          readErrorStack: readErr instanceof Error ? readErr.stack : undefined,
          note: "HTTP status was OK but reading the audio body failed; upstream may still have charged — compare timestamp with ElevenLabs usage dashboard.",
        });
        throw readErr;
      }
    } catch (err) {
      if (err instanceof ElevenLabsError && err.statusCode != null) {
        const raw = err.body;
        const bodyText =
          typeof raw === "string"
            ? raw
            : raw !== undefined
              ? JSON.stringify(raw)
              : (err.message ?? "");
        logNarrationEvent(strapi, "error", "elevenlabs.http.error_body", {
          narrationRequestId,
          operation: "text_to_speech",
          status: err.statusCode,
          bodyLength: bodyText.length,
          bodyPreview: bodyText.length > 800 ? `${bodyText.slice(0, 800)}…` : bodyText,
        });
      }
      throwMappedSdkError(err);
    }
  },
});
