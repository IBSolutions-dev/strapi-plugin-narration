import type { Core } from "@strapi/strapi";

import { PLUGIN_CONFIG_KEY, STRAPI_PLUGIN_ID } from "../plugin-metadata";
import type { NarrationPluginConfig } from "../utils/voice-catalog";

/** Supported TTS provider identifiers (single source of truth for admin + routes). */
export const TTS_PROVIDER_IDS = ["elevenlabs", "openai"] as const;
export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number];

export type TtsImplementationStatus = "live" | "coming_soon";

export type PublicTtsProvider = {
  id: TtsProviderId;
  label: string;
  implementationStatus: TtsImplementationStatus;
  configured: boolean;
  /** Whether this provider may appear as a tab in the plugin admin (from `adminProviderTabs` + defaults). */
  showInAdminTab: boolean;
  docsUrl?: string;
};

const DEFINITIONS: ReadonlyArray<{
  id: TtsProviderId;
  label: string;
  implementationStatus: TtsImplementationStatus;
  docsUrl?: string;
}> = [
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    implementationStatus: "live",
    docsUrl: "https://elevenlabs.io/docs",
  },
  {
    id: "openai",
    label: "OpenAI",
    implementationStatus: "coming_soon",
    docsUrl: "https://platform.openai.com/docs/guides/text-to-speech",
  },
];

export function isTtsProviderId(value: string): value is TtsProviderId {
  return (TTS_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Normalize query/body `provider` / `providerId` (default elevenlabs).
 */
export function normalizeTtsProviderParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return "elevenlabs";
  const t = v.trim().toLowerCase();
  return t.length > 0 ? t : "elevenlabs";
}

export type ProviderResolution =
  | { ok: true; providerId: TtsProviderId }
  | {
      ok: false;
      reason: "unknown" | "not_live";
      providerId: string;
    };

export function resolveLiveTtsProvider(raw: string | string[] | undefined): ProviderResolution {
  const normalized = normalizeTtsProviderParam(raw);
  if (!isTtsProviderId(normalized)) {
    return {
      ok: false as const,
      reason: "unknown" as const,
      providerId: normalized,
    };
  }
  const def = DEFINITIONS.find((d) => d.id === normalized);
  if (!def || def.implementationStatus !== "live") {
    return {
      ok: false as const,
      reason: "not_live" as const,
      providerId: normalized,
    };
  }
  return { ok: true as const, providerId: normalized };
}

/**
 * Provider ids allowed as admin tabs: full catalog when `adminProviderTabs` is unset/empty;
 * otherwise only known ids from that list (deduped, order preserved).
 */
export function getAdminTabProviderIds(strapi: Core.Strapi): TtsProviderId[] {
  const cfg = strapi.config.get(PLUGIN_CONFIG_KEY) as NarrationPluginConfig | undefined;
  const raw = cfg?.adminProviderTabs;
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return [...TTS_PROVIDER_IDS];
  }
  const out: TtsProviderId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim().toLowerCase();
    if (!isTtsProviderId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : [...TTS_PROVIDER_IDS];
}

export function listPublicTtsProviders(strapi: Core.Strapi): PublicTtsProvider[] {
  const elevenConfigured = strapi
    .plugin(STRAPI_PLUGIN_ID)
    .service("elevenlabs")
    .isApiKeyConfigured();

  const tabIds = new Set(getAdminTabProviderIds(strapi));

  return DEFINITIONS.map((d) => ({
    id: d.id,
    label: d.label,
    implementationStatus: d.implementationStatus,
    docsUrl: d.docsUrl,
    showInAdminTab: tabIds.has(d.id),
    configured: d.id === "elevenlabs" ? elevenConfigured : false,
  }));
}
