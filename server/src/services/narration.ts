import * as fs from "fs";
import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import type { Core } from "@strapi/strapi";
import { PLUGIN_CONFIG_KEY, STRAPI_PLUGIN_ID } from "../plugin-metadata";
import { extractNarrationPlainText } from "../utils/extract-plain-text";
import { findNarrationFieldOnSchema } from "../utils/schema";
import { CUSTOM_FIELD_UID, parseNarrationFieldValue } from "../utils/narration-options";
import {
  acquireNarrationGenerateLock,
  makeNarrationGenerateLockKey,
  releaseNarrationGenerateLock,
} from "../utils/narration-generate-lock";
import { createNarrationRequestId, logNarrationEvent } from "../utils/narration-telemetry";
import { getTtsRequestTimeoutMs } from "../utils/voice-catalog";

type GenerateBody = {
  uid: string;
  documentId: string;
  attributeName: string;
  locale?: string | null;
  /** Optional form values merged over DB document for extraction */
  values?: Record<string, unknown> | null;
  voiceId: string;
};

export default ({ strapi }: { strapi: Core.Strapi }) => {
  /**
   * Single path for ElevenLabs MP3 synthesis (`@elevenlabs/elevenlabs-js`).
   * Entry generation and the admin “Hello” demo both use this — no second TTS implementation.
   */
  const synthesizeSpeechMp3 = (params: {
    voiceId: string;
    text: string;
    narrationRequestId: string;
    signal?: AbortSignal;
  }): Promise<Buffer> =>
    strapi.plugin(STRAPI_PLUGIN_ID).service("elevenlabs").textToSpeechMp3(params);

  return {
    synthesizeSpeechMp3,

    async generateFromAdmin(
      body: GenerateBody,
      opts: { user?: { id: number }; narrationRequestId?: string }
    ): Promise<{
      textLength: number;
      fileId: number | string;
      narrationRequestId: string;
    }> {
      const narrationRequestId = opts.narrationRequestId ?? createNarrationRequestId();
      let phase = "validate_input" as
        | "validate_input"
        | "schema"
        | "load_document"
        | "extract_text"
        | "elevenlabs_tts"
        | "write_temp"
        | "upload"
        | "document_update"
        | "complete";

      const { uid, documentId, attributeName, locale, values, voiceId } = body;

      try {
        phase = "validate_input";
        if (!uid || !documentId || !voiceId || !attributeName?.trim()) {
          throw new Error("uid, documentId, attributeName, and voiceId are required");
        }

        const lockKey = makeNarrationGenerateLockKey({
          uid,
          documentId,
          attributeName: attributeName.trim(),
          locale,
          voiceId,
        });
        acquireNarrationGenerateLock(lockKey);
        try {
          logNarrationEvent(strapi, "info", "narration.generate.start", {
            narrationRequestId,
            uid,
            documentId,
            attributeName: attributeName.trim(),
            locale: locale ?? null,
            voiceId,
            userId: opts.user?.id,
            hasFormValuesOverlay: Boolean(values && Object.keys(values).length),
          });

          phase = "schema";
          const narration = findNarrationFieldOnSchema(strapi, uid, attributeName.trim());
          if (!narration) {
            throw new Error(
              `Content type ${uid} has no ${CUSTOM_FIELD_UID} field named "${attributeName}"`
            );
          }

          const { options } = narration;

          if (!options.narrationSources.length) {
            throw new Error("Narration field has no configured sources");
          }

          logNarrationEvent(strapi, "info", "narration.generate.schema_ok", {
            narrationRequestId,
            sourceCount: options.narrationSources.length,
            sourceFields: options.narrationSources.map((s) => s.field),
          });

          const pluginCfg = strapi.config.get(PLUGIN_CONFIG_KEY) as
            | { maxChars?: number }
            | undefined;
          const maxChars = pluginCfg?.maxChars ?? 50_000;

          const findParams: { documentId: string; locale?: string } = {
            documentId,
          };
          if (locale) findParams.locale = locale;

          phase = "load_document";
          const doc = await strapi.documents(uid as never).findOne(findParams);

          if (!doc) {
            throw new Error(`Document not found: ${documentId}`);
          }

          logNarrationEvent(strapi, "info", "narration.generate.document_loaded", {
            narrationRequestId,
            documentId,
            locale: locale ?? null,
          });

          phase = "extract_text";
          const flat = { ...(doc as Record<string, unknown>), ...(values ?? {}) };
          const text = extractNarrationPlainText(flat, options);
          if (!text) {
            throw new Error("No narratable text found for this entry");
          }
          if (text.length > maxChars) {
            throw new Error(`Text is ${text.length} characters; max allowed is ${maxChars}`);
          }

          logNarrationEvent(strapi, "info", "narration.generate.text_ready", {
            narrationRequestId,
            textLength: text.length,
            maxChars,
          });

          phase = "elevenlabs_tts";
          const ttsTimeoutMs = getTtsRequestTimeoutMs(strapi);
          const ttsController = new AbortController();
          const ttsTimeoutHandle = setTimeout(() => {
            ttsController.abort(
              new Error(
                `Narration TTS exceeded the configured timeout (${ttsTimeoutMs} ms). The lock has been released; retry the generation.`
              )
            );
          }, ttsTimeoutMs);
          ttsTimeoutHandle.unref?.();
          let audio: Buffer;
          try {
            audio = await synthesizeSpeechMp3({
              voiceId,
              text,
              narrationRequestId,
              signal: ttsController.signal,
            });
          } finally {
            clearTimeout(ttsTimeoutHandle);
          }

          logNarrationEvent(strapi, "info", "narration.generate.tts_buffer_ok", {
            narrationRequestId,
            audioBytes: audio.length,
          });

          const tmpRoot = await fse.mkdtemp(path.join(os.tmpdir(), "narration-"));
          const safeName = `narration-${documentId.slice(0, 8)}.mp3`;
          const tmpPath = path.join(tmpRoot, safeName);
          try {
            phase = "write_temp";
            await fs.promises.writeFile(tmpPath, audio);
            const stat = await fs.promises.stat(tmpPath);
            logNarrationEvent(strapi, "info", "narration.generate.temp_file_written", {
              narrationRequestId,
              tmpPathPattern: `${path.join(os.tmpdir(), "narration-*")}`,
              bytesOnDisk: stat.size,
              safeName,
            });

            const fileBlob = {
              filepath: tmpPath,
              originalFilename: safeName,
              mimetype: "audio/mpeg",
              size: stat.size,
            };

            phase = "upload";
            logNarrationEvent(strapi, "info", "narration.generate.upload_start", {
              narrationRequestId,
              uploadSize: stat.size,
              mimetype: fileBlob.mimetype,
            });

            const uploadService = strapi.plugin("upload").service("upload");
            const uploaded = await uploadService.upload(
              {
                data: {
                  fileInfo: {
                    name: safeName,
                    alternativeText: "Generated narration",
                    caption: "",
                  },
                },
                files: fileBlob,
              },
              { user: opts.user }
            );

            const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
            const fileId = file?.id;
            if (fileId == null) {
              throw new Error(
                `Upload did not return a file id (upload result: ${
                  uploaded == null
                    ? "null"
                    : Array.isArray(uploaded)
                      ? `array length ${uploaded.length}`
                      : typeof uploaded
                })`
              );
            }

            logNarrationEvent(strapi, "info", "narration.generate.upload_ok", {
              narrationRequestId,
              fileId,
            });

            const key = attributeName.trim();
            const prev = parseNarrationFieldValue(flat[key]);
            const numericId = typeof fileId === "number" ? fileId : Number(fileId);
            const audioFileId = Number.isFinite(numericId) ? numericId : undefined;
            const nextValue = {
              ...prev,
              voiceId,
              ...(audioFileId !== undefined ? { audioFileId } : {}),
            };

            const updateParams: {
              documentId: string;
              data: Record<string, unknown>;
              locale?: string;
            } = {
              documentId,
              data: { [key]: nextValue },
            };
            if (locale) updateParams.locale = locale;

            phase = "document_update";
            logNarrationEvent(strapi, "info", "narration.generate.document_update_start", {
              narrationRequestId,
              updateAttribute: key,
              nextValueKeys: Object.keys(nextValue),
              hasAudioFileId: audioFileId !== undefined,
            });

            await strapi.documents(uid as never).update(updateParams);

            phase = "complete";
            logNarrationEvent(strapi, "info", "narration.generate.complete", {
              narrationRequestId,
              textLength: text.length,
              fileId,
              uid,
              documentId,
            });

            return {
              textLength: text.length,
              fileId,
              narrationRequestId,
            };
          } finally {
            await fse.remove(tmpRoot).catch(() => undefined);
          }
        } finally {
          releaseNarrationGenerateLock(lockKey);
        }
      } catch (err) {
        logNarrationEvent(strapi, "error", "narration.generate.failed", {
          narrationRequestId,
          phase,
          uid,
          documentId,
          attributeName: attributeName?.trim(),
          locale: locale ?? null,
          voiceId,
          userId: opts.user?.id,
          errorName: err instanceof Error ? err.name : typeof err,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
        });
        throw err;
      }
    },
  };
};
