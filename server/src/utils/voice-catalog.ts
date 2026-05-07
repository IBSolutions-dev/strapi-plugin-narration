import type { Core } from "@strapi/strapi";

import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import type { VoicesListCacheVoice } from "./voices-list-cache";

const DAY_MS = 86_400_000;

export type NarrationPluginConfig = {
  apiKey?: string;
  modelId?: string;
  maxChars?: number;
  /**
   * If true, `textToSpeechMp3` returns a placeholder MP3 and never calls ElevenLabs (no TTS spend).
   * Dev-oriented: not shown on the plugin admin Connection card; use env / this config only.
   */
  ttsDryRun?: boolean;
  /** If non-empty, skip ElevenLabs GET /v1/voices and use this list for admin pickers. */
  voiceCatalog?: VoicesListCacheVoice[];
  /** TTL for in-memory cache of GET /v1/voices (0 = always refetch). Default 24h. */
  voicesListCacheTtlMs?: number;
  /**
   * Optional allowlist of provider ids (`elevenlabs`, `openai`, …) for tabs on the plugin
   * admin home page. Omit or leave empty to show every known provider (default).
   */
  adminProviderTabs?: string[];
  /**
   * Hard timeout (ms) for a single ElevenLabs TTS request — see `server/src/config/index.ts`.
   * Bounds the in-memory generate-lock hold time so a stuck network call cannot
   * wedge the entry+field+voice tuple permanently.
   */
  ttsRequestTimeoutMs?: number;
};

function isVoiceRow(v: unknown): v is VoicesListCacheVoice {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.voice_id === "string" &&
    o.voice_id.length > 0 &&
    typeof o.name === "string" &&
    o.name.length > 0 &&
    (o.category === undefined || typeof o.category === "string")
  );
}

function normalizeCatalog(rows: unknown[]): VoicesListCacheVoice[] {
  const out: VoicesListCacheVoice[] = [];
  for (const r of rows) {
    if (!isVoiceRow(r)) continue;
    out.push({
      voice_id: r.voice_id,
      name: r.name,
      ...(r.category !== undefined ? { category: r.category } : {}),
    });
  }
  return out;
}

function parseEnvVoiceCatalogJson(): VoicesListCacheVoice[] | null {
  const raw = process.env.ELEVENLABS_VOICE_CATALOG_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const normalized = normalizeCatalog(parsed);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

/**
 * Static voice list: plugin config `voiceCatalog` wins; else `ELEVENLABS_VOICE_CATALOG_JSON`.
 * When returned list is non-empty, the server never calls ElevenLabs for listing.
 */
export function resolveStaticVoiceCatalog(strapi: Core.Strapi): VoicesListCacheVoice[] | null {
  const cfg = strapi.config.get(PLUGIN_CONFIG_KEY) as NarrationPluginConfig | undefined;
  const fromConfig = cfg?.voiceCatalog;
  if (Array.isArray(fromConfig) && fromConfig.length > 0) {
    const normalized = normalizeCatalog(fromConfig);
    if (normalized.length > 0) return normalized;
  }
  return parseEnvVoiceCatalogJson();
}

export const DEFAULT_TTS_REQUEST_TIMEOUT_MS = 8 * 60 * 1000;

export function getTtsRequestTimeoutMs(strapi: Core.Strapi): number {
  const cfg = strapi.config.get(PLUGIN_CONFIG_KEY) as NarrationPluginConfig | undefined;
  const fromConfig = cfg?.ttsRequestTimeoutMs;
  if (typeof fromConfig === "number" && Number.isFinite(fromConfig) && fromConfig > 0) {
    return Math.floor(fromConfig);
  }
  return DEFAULT_TTS_REQUEST_TIMEOUT_MS;
}

export function getVoicesListCacheTtlMs(strapi: Core.Strapi): number {
  const cfg = strapi.config.get(PLUGIN_CONFIG_KEY) as NarrationPluginConfig | undefined;
  const fromConfig = cfg?.voicesListCacheTtlMs;
  if (typeof fromConfig === "number" && Number.isFinite(fromConfig)) {
    return Math.max(0, fromConfig);
  }
  const fromEnv = process.env.ELEVENLABS_VOICES_CACHE_TTL_MS?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return DAY_MS;
}

export { DAY_MS as DEFAULT_VOICES_LIST_CACHE_TTL_MS };
