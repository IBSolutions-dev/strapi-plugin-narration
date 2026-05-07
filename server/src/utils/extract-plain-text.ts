import type { NarrationFieldOptions, StripDelimiterPair } from "./narration-options";
import { NARRATION_SOURCE_PAUSE_SECONDS_LIMITS } from "./narration-options";

const SKIP_BLOCK_TYPES = new Set(["code", "code-block"]);

/** SSML-ish break duration for ElevenLabs (seconds suffix). */
export function formatNarrationSourceBreakTime(seconds: number): string {
  const { min, max } = NARRATION_SOURCE_PAUSE_SECONDS_LIMITS;
  if (!Number.isFinite(seconds)) return `${min}s`;
  const clamped = Math.min(max, Math.max(min, seconds));
  const rounded = Math.round(clamped * 100) / 100;
  return `${rounded}s`;
}

/** Join narration source excerpts; optional SSML silence between segments. */
export function joinNarrationSourcesWithPause(
  parts: readonly string[],
  pauseSeconds: number
): string {
  if (parts.length === 0) return "";
  const gap = pauseSeconds > 0 && Number.isFinite(pauseSeconds) ? pauseSeconds : 0;
  if (gap <= 0) {
    return parts.join("\n\n");
  }
  const tag = `<break time="${formatNarrationSourceBreakTime(gap)}" />`;
  return parts.join(`\n\n${tag}\n\n`);
}

/**
 * For each pair, repeatedly removes the leftmost region from first `open` through the first
 * `close` after it (inclusive). Pairs run in configured order.
 */
export function stripByDelimiterPairs(text: string, pairs: readonly StripDelimiterPair[]): string {
  let t = text;
  for (const { open, close } of pairs) {
    if (!open.length || !close.length) continue;
    const maxPasses = Math.max(t.length, 1) + 64;
    let passes = 0;
    while (passes++ < maxPasses) {
      const start = t.indexOf(open);
      if (start === -1) break;
      const afterOpen = start + open.length;
      const end = t.indexOf(close, afterOpen);
      if (end === -1) break;
      t = t.slice(0, start) + t.slice(end + close.length);
    }
  }
  return t;
}

function walkNode(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  const type = typeof n.type === "string" ? n.type : "";
  if (SKIP_BLOCK_TYPES.has(type)) return "";
  if (type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) {
    return n.children.map((c) => walkNode(c)).join("");
  }
  return "";
}

function blocksToPlainText(blocks: unknown, allowlist: string[] | undefined): string {
  if (!Array.isArray(blocks)) return "";
  const allow = allowlist?.length ? new Set(allowlist) : null;
  const chunks: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const type = typeof b.type === "string" ? b.type : "";
    if (SKIP_BLOCK_TYPES.has(type)) continue;
    if (allow && type && !allow.has(type)) continue;
    const text = walkNode(block).trim();
    if (text) chunks.push(text);
  }
  return chunks.join("\n\n");
}

function getScalar(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/**
 * Build plain text for TTS from entry data and narration custom-field options.
 * Sources are read in `narrationSources` order (scalar vs blocks per step).
 */
export function extractNarrationPlainText(
  data: Record<string, unknown>,
  options: NarrationFieldOptions
): string {
  const parts: string[] = [];
  const allow = options.blockTypesAllowlist;
  for (const src of options.narrationSources) {
    if (src.kind === "scalar") {
      const t = getScalar(data, src.field).trim();
      if (t) parts.push(t);
    } else {
      const raw = data[src.field];
      const blockText = blocksToPlainText(raw, allow).trim();
      if (blockText) parts.push(blockText);
    }
  }
  let out = joinNarrationSourcesWithPause(parts, options.narrationSourcePauseSeconds).replace(
    /\s+\n/g,
    "\n"
  );
  const pairs = options.stripDelimiterPairs ?? [];
  if (pairs.length > 0) {
    out = stripByDelimiterPairs(out, pairs);
  }
  return out.replace(/\s+\n/g, "\n").trim();
}
