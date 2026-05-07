import type { Core } from "@strapi/strapi";

import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import type { NarrationPluginConfig } from "./voice-catalog";

/** Minimal valid-ish MP3 frame (LAME header); ~72 bytes — for upload pipeline tests only. */
const DRY_RUN_MP3_BASE64 =
  "/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

let cachedDryRunBuffer: Buffer | null = null;

export function getDryRunTtsMp3Buffer(): Buffer {
  if (cachedDryRunBuffer === null) {
    cachedDryRunBuffer = Buffer.from(DRY_RUN_MP3_BASE64, "base64");
  }
  return Buffer.from(cachedDryRunBuffer);
}

/**
 * When `STRAPI_NARRATION_TTS_DRY_RUN` is set to a non-empty value, it wins over plugin config.
 * Truthy: `1`, `true`, `yes`, `on` (case-insensitive). Falsy: `0`, `false`, `no`, `off`.
 * Other non-empty values are ignored (returns `null`) so the plugin config `ttsDryRun` still applies.
 */
export function parseNarrationTtsDryRunEnv(raw: string | undefined): boolean | null {
  const t = raw?.trim().toLowerCase();
  if (!t) return null;
  if (t === "1" || t === "true" || t === "yes" || t === "on") return true;
  if (t === "0" || t === "false" || t === "no" || t === "off") return false;
  return null;
}

export function isTtsDryRunEnabled(strapi: Core.Strapi): boolean {
  const fromEnv = parseNarrationTtsDryRunEnv(process.env.STRAPI_NARRATION_TTS_DRY_RUN);
  if (fromEnv !== null) return fromEnv;
  const cfg = strapi.config.get(PLUGIN_CONFIG_KEY) as NarrationPluginConfig | undefined;
  return cfg?.ttsDryRun === true;
}
