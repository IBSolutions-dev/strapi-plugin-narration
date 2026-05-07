import type { Core } from "@strapi/strapi";
import type { Context } from "koa";

import { PLUGIN_CONFIG_KEY, STRAPI_PLUGIN_ID } from "../plugin-metadata";
import { getPluginInfo } from "../plugin-version";
import { narrationAdminErrorResponse } from "../utils/narration-admin-error-response";
import {
  createNarrationRequestId,
  logNarrationEvent,
  summarizeValuesKeys,
} from "../utils/narration-telemetry";
import { isTtsDryRunEnabled } from "../utils/tts-dry-run";
import { type NarrationPluginConfig, resolveStaticVoiceCatalog } from "../utils/voice-catalog";
import { listPublicTtsProviders, resolveLiveTtsProvider } from "../tts/tts-providers";

const DEFAULT_MAX_CHARS = 50_000;
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Safe, non-secret snapshot for the plugin admin home page (env-backed setup guidance).
   */
  async settingsStatus(ctx: Context) {
    const cfg = strapi.config.get(PLUGIN_CONFIG_KEY) as NarrationPluginConfig | undefined;
    const catalog = resolveStaticVoiceCatalog(strapi);
    const apiKeyConfigured = strapi
      .plugin(STRAPI_PLUGIN_ID)
      .service("elevenlabs")
      .isApiKeyConfigured();
    const modelId =
      typeof cfg?.modelId === "string" && cfg.modelId.trim().length > 0
        ? cfg.modelId.trim()
        : DEFAULT_MODEL_ID;
    const maxChars =
      typeof cfg?.maxChars === "number" && Number.isFinite(cfg.maxChars) && cfg.maxChars > 0
        ? cfg.maxChars
        : DEFAULT_MAX_CHARS;

    ctx.body = {
      data: {
        apiKeyConfigured,
        modelId,
        staticVoiceCatalogActive: catalog != null && catalog.length > 0,
        maxChars,
      },
    };
  },

  async providers(ctx: Context) {
    ctx.body = { data: listPublicTtsProviders(strapi) };
  },

  /** Public, non-secret plugin metadata (package name, version) for the admin footer. */
  async pluginInfo(ctx: Context) {
    ctx.body = { data: getPluginInfo() };
  },

  async voices(ctx: Context) {
    const q = ctx.query as { provider?: string; providerId?: string };
    const raw = q.providerId ?? q.provider;
    const resolved = resolveLiveTtsProvider(raw);
    if (resolved.ok === false) {
      const fail = resolved;
      const message =
        fail.reason === "unknown"
          ? `Unknown TTS provider "${fail.providerId}".`
          : `TTS provider "${fail.providerId}" is not available for voice listing yet.`;
      ctx.status = 400;
      ctx.body = {
        data: null,
        error: {
          status: 400,
          name: "ValidationError",
          message,
          details: { providerId: fail.providerId },
        },
      };
      return;
    }

    try {
      const list = await strapi.plugin(STRAPI_PLUGIN_ID).service("elevenlabs").listVoices();
      ctx.body = { data: list };
    } catch (err) {
      const { status, body } = narrationAdminErrorResponse(err);
      ctx.status = status;
      ctx.body = body;
    }
  },

  async generate(ctx: Context) {
    const body = ctx.request.body as {
      uid?: string;
      documentId?: string;
      attributeName?: string;
      locale?: string | null;
      values?: Record<string, unknown> | null;
      voiceId?: string;
    };
    const narrationRequestId = createNarrationRequestId();
    const user = ctx.state.user as { id?: number } | undefined;
    const { valueFieldCount, valueFieldKeys } = summarizeValuesKeys(body.values);
    logNarrationEvent(strapi, "info", "narration.http.generate_received", {
      narrationRequestId,
      uid: body.uid,
      documentId: body.documentId,
      attributeName: body.attributeName,
      locale: body.locale ?? null,
      voiceId: body.voiceId,
      userId: user?.id,
      valueFieldCount,
      valueFieldKeys,
    });
    try {
      const result = await strapi
        .plugin(STRAPI_PLUGIN_ID)
        .service("narration")
        .generateFromAdmin(
          {
            uid: body.uid ?? "",
            documentId: body.documentId ?? "",
            attributeName: body.attributeName ?? "",
            locale: body.locale,
            values: body.values,
            voiceId: body.voiceId ?? "",
          },
          { user, narrationRequestId }
        );
      ctx.body = { data: result };
    } catch (err) {
      const { status, body } = narrationAdminErrorResponse(err, {
        narrationRequestId,
      });
      ctx.status = status;
      ctx.body = body;
    }
  },

  /** Tech demo: synthesize fixed phrase "Hello" via ElevenLabs (settings page). */
  async testTts(ctx: Context) {
    const body = ctx.request.body as { voiceId?: string; providerId?: string };
    const voiceId = body.voiceId?.trim() ?? "";
    const narrationRequestId = createNarrationRequestId();
    const user = ctx.state.user as { id?: number } | undefined;

    const providerResolved = resolveLiveTtsProvider(body.providerId);
    if (providerResolved.ok === false) {
      const fail = providerResolved;
      const message =
        fail.reason === "unknown"
          ? `Unknown TTS provider "${fail.providerId}".`
          : `TTS provider "${fail.providerId}" is not available for testing yet.`;
      ctx.status = 400;
      ctx.body = {
        data: null,
        error: {
          status: 400,
          name: "ValidationError",
          message,
          details: { narrationRequestId, providerId: fail.providerId },
        },
      };
      return;
    }

    logNarrationEvent(strapi, "info", "narration.http.test_tts_received", {
      narrationRequestId,
      voiceId: voiceId || null,
      userId: user?.id,
      hasVoiceId: voiceId.length > 0,
      providerId: providerResolved.providerId,
    });

    if (!voiceId) {
      ctx.status = 400;
      ctx.body = {
        data: null,
        error: {
          status: 400,
          name: "ValidationError",
          message: "voiceId is required to run the test.",
          details: { narrationRequestId },
        },
      };
      return;
    }

    try {
      const buf = await strapi.plugin(STRAPI_PLUGIN_ID).service("narration").synthesizeSpeechMp3({
        voiceId,
        text: "Hello",
        narrationRequestId,
      });

      logNarrationEvent(strapi, "info", "narration.http.test_tts_ok", {
        narrationRequestId,
        voiceId,
        byteLength: buf.length,
        dryRun: isTtsDryRunEnabled(strapi),
      });

      ctx.body = {
        data: {
          audioBase64: buf.toString("base64"),
          byteLength: buf.length,
          mimeType: "audio/mpeg",
          narrationRequestId,
          dryRun: isTtsDryRunEnabled(strapi),
        },
      };
    } catch (err) {
      const { status, body } = narrationAdminErrorResponse(err, {
        narrationRequestId,
      });
      ctx.status = status;
      ctx.body = body;
    }
  },
});
