/**
 * Shared narration custom-field options + entry value shape.
 * CTB may store JSON arrays; legacy schemas may use scalarFields/blocksField only.
 */

export type NarrationSourceKind = "scalar" | "blocks";

export type NarrationSource = {
  field: string;
  kind: NarrationSourceKind;
};

/** Remove `open`…`close` regions (inclusive) from narration text, in configured order. */
export type StripDelimiterPair = {
  open: string;
  close: string;
};

export type NarrationFieldOptions = {
  narrationSources: NarrationSource[];
  /** Content-Type Builder requires a non-empty value when saving this custom field. */
  defaultVoiceId?: string;
  blockTypesAllowlist?: string[];
  /** Ordered pairs; each removes the first matching region from open through close, repeating until no match. */
  stripDelimiterPairs?: StripDelimiterPair[];
  /** Seconds of silence between each non-empty narration source in TTS (SSML `<break time="…"/>`). Clamped by `NARRATION_SOURCE_PAUSE_SECONDS_LIMITS`; 0 disables. */
  narrationSourcePauseSeconds: number;
};

/** Persisted on the custom-field JSON attribute after generate / voice pick. */
export type NarrationFieldValue = {
  voiceId?: string;
  audioFileId?: number;
};

/** Hard limits for delimiter-pair options (safety). */
export const STRIP_DELIMITER_PAIR_LIMITS = {
  maxPairs: 24,
  maxTokenLen: 256,
} as const;

/**
 * Silence inserted between narration sources in TTS text as SSML `{@code <break time="…"/>}`.
 * Values are clamped server-side (ElevenLabs commonly caps usable break length around ~3s).
 */
export const NARRATION_SOURCE_PAUSE_SECONDS_LIMITS = {
  min: 0,
  max: 3,
} as const;

export function normalizeNarrationSourcePauseSeconds(raw: unknown): number {
  const { min, max } = NARRATION_SOURCE_PAUSE_SECONDS_LIMITS;
  let n: number;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    n = raw;
  } else if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "") return min;
    n = Number(t);
    if (!Number.isFinite(n)) return min;
  } else {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}

export function parseNarrationFieldValue(raw: unknown): NarrationFieldValue {
  if (raw == null) return {};

  let o: Record<string, unknown>;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return {};
    try {
      const p = JSON.parse(t) as unknown;
      if (p == null || typeof p !== "object" || Array.isArray(p)) return {};
      o = p as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>;
  } else {
    return {};
  }

  const voiceId = typeof o.voiceId === "string" && o.voiceId.trim() ? o.voiceId.trim() : undefined;
  let audioFileId: number | undefined;
  if (typeof o.audioFileId === "number" && Number.isFinite(o.audioFileId)) {
    audioFileId = o.audioFileId;
  } else if (typeof o.audioFileId === "string" && /^\d+$/.test(o.audioFileId.trim())) {
    audioFileId = Number(o.audioFileId.trim());
  }
  return { voiceId, audioFileId };
}

function parseCommaList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "") return [];
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function isSourceKind(v: unknown): v is NarrationSourceKind {
  return v === "scalar" || v === "blocks";
}

function parseNarrationSources(raw: unknown): NarrationSource[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t) as unknown;
      return parseNarrationSources(parsed);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(raw)) return undefined;
  const out: NarrationSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const field = typeof o.field === "string" ? o.field.trim() : "";
    const kind = o.kind;
    if (!field || !isSourceKind(kind)) continue;
    out.push({ field, kind });
  }
  return out;
}

/** Normalize persisted `stripDelimiterPairs` (JSON array or string). */
export function parseStripDelimiterPairs(raw: unknown): StripDelimiterPair[] {
  const { maxPairs, maxTokenLen } = STRIP_DELIMITER_PAIR_LIMITS;
  let arr: unknown[] = [];
  if (raw === undefined || raw === null) return [];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t) as unknown;
      if (Array.isArray(p)) arr = p;
    } catch {
      return [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    return [];
  }

  const out: StripDelimiterPair[] = [];
  for (const item of arr) {
    if (out.length >= maxPairs) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    let open = typeof o.open === "string" ? o.open : "";
    let close = typeof o.close === "string" ? o.close : "";
    if (!open.trim() || !close.trim()) continue;
    open = open.trim();
    close = close.trim();
    if (open.length > maxTokenLen || close.length > maxTokenLen) continue;
    out.push({ open, close });
  }
  return out;
}

/** Legacy scalarFields + blocksField → ordered narrationSources. */
function legacyToNarrationSources(r: Record<string, unknown>): NarrationSource[] {
  const d = defaultNarrationOptions();

  let scalarFields: string[];
  if (!("scalarFields" in r) || r.scalarFields === undefined) {
    scalarFields = ["title"];
  } else {
    const parsed = parseCommaList(r.scalarFields);
    scalarFields = parsed === undefined ? ["title"] : parsed;
  }

  let blocksField: string | undefined;
  if (!("blocksField" in r) || r.blocksField === undefined) {
    blocksField = "content";
  } else if (typeof r.blocksField === "string") {
    const t = r.blocksField.trim();
    blocksField = t === "" ? undefined : t;
  } else {
    blocksField = r.blocksField as string | undefined;
  }

  const out: NarrationSource[] = [];
  for (const f of scalarFields) {
    out.push({ field: f, kind: "scalar" });
  }
  if (blocksField) {
    out.push({ field: blocksField, kind: "blocks" });
  }
  if (out.length === 0) {
    return d.narrationSources;
  }
  return out;
}

export function defaultNarrationOptions(): NarrationFieldOptions {
  return {
    narrationSources: [
      { field: "title", kind: "scalar" },
      { field: "content", kind: "blocks" },
    ],
    blockTypesAllowlist: ["paragraph", "heading", "list", "list-item"],
    stripDelimiterPairs: [],
    narrationSourcePauseSeconds: NARRATION_SOURCE_PAUSE_SECONDS_LIMITS.min,
  };
}

export function mergeNarrationOptions(
  raw: Partial<NarrationFieldOptions> | Record<string, unknown> | undefined | null
): NarrationFieldOptions {
  const d = defaultNarrationOptions();
  if (!raw || typeof raw !== "object") return d;

  const r = raw as Record<string, unknown>;

  let narrationSources: NarrationSource[];
  const explicit = parseNarrationSources(r.narrationSources);
  if (explicit !== undefined && explicit.length > 0) {
    narrationSources = explicit;
  } else if (explicit !== undefined && explicit.length === 0) {
    narrationSources = [];
  } else {
    narrationSources = legacyToNarrationSources(r);
  }

  const defaultVoiceId =
    typeof r.defaultVoiceId === "string" && r.defaultVoiceId.trim()
      ? r.defaultVoiceId.trim()
      : undefined;

  let blockTypesAllowlist: string[] | undefined;
  if (!("blockTypesAllowlist" in r) || r.blockTypesAllowlist === undefined) {
    blockTypesAllowlist = d.blockTypesAllowlist;
  } else {
    const parsed = parseCommaList(r.blockTypesAllowlist);
    if (parsed === undefined) {
      blockTypesAllowlist = d.blockTypesAllowlist;
    } else if (parsed.length === 0) {
      blockTypesAllowlist = d.blockTypesAllowlist;
    } else {
      blockTypesAllowlist = parsed;
    }
  }

  let stripDelimiterPairs: StripDelimiterPair[];
  if (
    !("stripDelimiterPairs" in r) ||
    r.stripDelimiterPairs === undefined ||
    r.stripDelimiterPairs === null
  ) {
    stripDelimiterPairs = d.stripDelimiterPairs ?? [];
  } else {
    stripDelimiterPairs = parseStripDelimiterPairs(r.stripDelimiterPairs);
  }

  const narrationSourcePauseSeconds =
    !("narrationSourcePauseSeconds" in r) ||
    r.narrationSourcePauseSeconds === undefined ||
    r.narrationSourcePauseSeconds === null
      ? d.narrationSourcePauseSeconds
      : normalizeNarrationSourcePauseSeconds(r.narrationSourcePauseSeconds);

  return {
    narrationSources,
    defaultVoiceId,
    blockTypesAllowlist,
    stripDelimiterPairs,
    narrationSourcePauseSeconds,
  };
}
