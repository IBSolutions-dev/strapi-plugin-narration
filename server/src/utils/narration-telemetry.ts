import { randomUUID } from "node:crypto";

import type { Core } from "@strapi/strapi";

import { PLUGIN_LOG_TAG } from "../plugin-metadata";

const TAG = PLUGIN_LOG_TAG;

export type NarrationLogLevel = "debug" | "info" | "warn" | "error";

/** Correlate all logs for one admin generate / TTS attempt (grep this id in server logs). */
export function createNarrationRequestId(): string {
  return randomUUID();
}

function serializePayload(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ serializeError: true });
  }
}

/**
 * Single-line structured logs for grep and support tickets.
 * Never pass full narration text or API keys here.
 */
export function logNarrationEvent(
  strapi: Core.Strapi,
  level: NarrationLogLevel,
  event: string,
  payload: Record<string, unknown>
): void {
  const line = `${TAG} ${event} ${serializePayload({
    ...payload,
    at: new Date().toISOString(),
  })}`;
  strapi.log[level](line);
}

/** Response headers useful for ElevenLabs billing / support (no secrets). */
export function pickUpstreamHeadersForLog(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const allow = new Set(
    [
      "content-type",
      "content-length",
      "cf-ray",
      "date",
      "request-id",
      "x-request-id",
      "x-trace-id",
      "x-ratelimit-remaining",
      "x-ratelimit-limit",
      "x-ratelimit-reset",
    ].map((s) => s.toLowerCase())
  );

  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (allow.has(k) || k.startsWith("x-")) {
      out[k] = value.length > 500 ? `${value.slice(0, 500)}…` : value;
    }
  });
  return out;
}

/**
 * Field names whose key shape suggests a credential. These are masked in logs
 * even though the plugin never logs values themselves — defense in depth in
 * case a downstream log pipeline later starts ingesting the key list.
 *
 * Pattern set is intentionally additive: extend by appending here, never by
 * inlining a regex at call sites.
 */
export const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /api[_-]?key/i,
  /access[_-]?key/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /token/i,
  /authorization/i,
  /auth[_-]?header/i,
  /bearer/i,
  /cookie/i,
  /session[_-]?id/i,
  /private[_-]?key/i,
  /client[_-]?secret/i,
];

export const REDACTED_KEY_LABEL = "[redacted]" as const;

export function isSecretLikeKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}

export type SummarizedValueKeys = {
  valueFieldCount: number;
  valueFieldKeys: string[];
  redactedKeyCount: number;
};

/**
 * Summarize entry-form values for telemetry.
 *
 * Returns the count + a capped list of field key names. Keys that match
 * {@link SECRET_KEY_PATTERNS} are replaced with {@link REDACTED_KEY_LABEL}
 * so that copy-pasted log lines never reveal credential-shaped attribute
 * names from the host content type.
 */
export function summarizeValuesKeys(
  values: Record<string, unknown> | null | undefined
): SummarizedValueKeys {
  if (!values || typeof values !== "object") {
    return { valueFieldCount: 0, valueFieldKeys: [], redactedKeyCount: 0 };
  }
  const keys = Object.keys(values);
  const max = 40;
  let redactedKeyCount = 0;
  const valueFieldKeys = keys.slice(0, max).map((k) => {
    if (isSecretLikeKey(k)) {
      redactedKeyCount += 1;
      return REDACTED_KEY_LABEL;
    }
    return k;
  });
  return {
    valueFieldCount: keys.length,
    valueFieldKeys,
    redactedKeyCount,
  };
}
