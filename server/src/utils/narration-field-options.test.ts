import { describe, expect, it } from "vitest";
import {
  defaultNarrationOptions,
  mergeNarrationOptions,
  normalizeNarrationSourcePauseSeconds,
  parseNarrationFieldValue,
  parseStripDelimiterPairs,
  STRIP_DELIMITER_PAIR_LIMITS,
} from "./narration-options";

describe("mergeNarrationOptions", () => {
  const d = defaultNarrationOptions();

  it("uses defaults when raw is empty", () => {
    expect(mergeNarrationOptions(undefined)).toEqual(d);
    expect(mergeNarrationOptions(null)).toEqual(d);
    expect(mergeNarrationOptions({})).toEqual(d);
  });

  it("uses explicit narrationSources when provided", () => {
    const merged = mergeNarrationOptions({
      narrationSources: [
        { field: "description", kind: "scalar" },
        { field: "content", kind: "blocks" },
        { field: "title", kind: "scalar" },
      ],
    });
    expect(merged.narrationSources).toEqual([
      { field: "description", kind: "scalar" },
      { field: "content", kind: "blocks" },
      { field: "title", kind: "scalar" },
    ]);
  });

  it("treats empty narrationSources array as empty (no legacy fallback)", () => {
    expect(mergeNarrationOptions({ narrationSources: [] }).narrationSources).toEqual([]);
  });

  it("derives narrationSources from legacy scalarFields and blocksField", () => {
    expect(
      mergeNarrationOptions({
        scalarFields: "title, slug",
        blocksField: "content",
      }).narrationSources
    ).toEqual([
      { field: "title", kind: "scalar" },
      { field: "slug", kind: "scalar" },
      { field: "content", kind: "blocks" },
    ]);
  });

  it("legacy: omitted scalarFields uses title; omitted blocksField uses content", () => {
    const merged = mergeNarrationOptions({});
    expect(merged.narrationSources).toEqual([
      { field: "title", kind: "scalar" },
      { field: "content", kind: "blocks" },
    ]);
  });

  it("legacy: empty scalarFields string yields only blocks when blocksField set", () => {
    expect(
      mergeNarrationOptions({
        scalarFields: "",
        blocksField: "content",
      }).narrationSources
    ).toEqual([{ field: "content", kind: "blocks" }]);
  });

  it("parses narrationSources from JSON string", () => {
    const json = JSON.stringify([
      { field: "a", kind: "scalar" },
      { field: "b", kind: "blocks" },
    ]);
    expect(mergeNarrationOptions({ narrationSources: json }).narrationSources).toEqual([
      { field: "a", kind: "scalar" },
      { field: "b", kind: "blocks" },
    ]);
  });

  it("merges defaultVoiceId", () => {
    expect(mergeNarrationOptions({ defaultVoiceId: "  vid  " }).defaultVoiceId).toBe("vid");
  });

  it("uses plugin default allowlist when blockTypesAllowlist is empty string", () => {
    const merged = mergeNarrationOptions({ blockTypesAllowlist: "" });
    expect(merged.blockTypesAllowlist).toEqual(d.blockTypesAllowlist);
  });

  it("parses comma-separated blockTypesAllowlist", () => {
    expect(
      mergeNarrationOptions({
        blockTypesAllowlist: "paragraph, heading",
        narrationSources: [{ field: "x", kind: "scalar" }],
      }).blockTypesAllowlist
    ).toEqual(["paragraph", "heading"]);
  });

  it("defaults stripDelimiterPairs to empty", () => {
    expect(d.stripDelimiterPairs).toEqual([]);
    expect(mergeNarrationOptions({}).stripDelimiterPairs).toEqual([]);
  });

  it("defaults narrationSourcePauseSeconds to 0 and merges explicit values", () => {
    expect(d.narrationSourcePauseSeconds).toBe(0);
    expect(mergeNarrationOptions({}).narrationSourcePauseSeconds).toBe(0);
    expect(
      mergeNarrationOptions({ narrationSourcePauseSeconds: 1.25 }).narrationSourcePauseSeconds
    ).toBe(1.25);
  });

  it("clamps narrationSourcePauseSeconds", () => {
    expect(
      mergeNarrationOptions({ narrationSourcePauseSeconds: 10 }).narrationSourcePauseSeconds
    ).toBe(3);
    expect(
      mergeNarrationOptions({ narrationSourcePauseSeconds: -2 }).narrationSourcePauseSeconds
    ).toBe(0);
  });

  it("merges stripDelimiterPairs from rows (trim, skip incomplete)", () => {
    expect(
      mergeNarrationOptions({
        narrationSources: [{ field: "x", kind: "scalar" }],
        stripDelimiterPairs: [
          { open: " {{component:", close: "}} " },
          { open: "", close: "x" },
          { open: ":::", close: ":::" },
        ],
      }).stripDelimiterPairs
    ).toEqual([
      { open: "{{component:", close: "}}" },
      { open: ":::", close: ":::" },
    ]);
  });

  it("parses stripDelimiterPairs from JSON string", () => {
    const json = JSON.stringify([{ open: "<!--", close: "-->" }]);
    expect(
      mergeNarrationOptions({
        narrationSources: [{ field: "x", kind: "scalar" }],
        stripDelimiterPairs: json,
      }).stripDelimiterPairs
    ).toEqual([{ open: "<!--", close: "-->" }]);
  });
});

describe("normalizeNarrationSourcePauseSeconds", () => {
  it("parses numbers and strings and clamps to limits", () => {
    expect(normalizeNarrationSourcePauseSeconds(undefined)).toBe(0);
    expect(normalizeNarrationSourcePauseSeconds("1.5")).toBe(1.5);
    expect(normalizeNarrationSourcePauseSeconds(4)).toBe(3);
    expect(normalizeNarrationSourcePauseSeconds("not-a-number")).toBe(0);
  });
});

describe("parseStripDelimiterPairs", () => {
  it("caps pair count", () => {
    const rows = Array.from({ length: STRIP_DELIMITER_PAIR_LIMITS.maxPairs + 4 }, (_, i) => ({
      open: `${i}o`,
      close: `${i}c`,
    }));
    expect(parseStripDelimiterPairs(rows)).toHaveLength(STRIP_DELIMITER_PAIR_LIMITS.maxPairs);
  });

  it("drops tokens exceeding maxLen", () => {
    const long = "z".repeat(STRIP_DELIMITER_PAIR_LIMITS.maxTokenLen + 3);
    expect(parseStripDelimiterPairs([{ open: long, close: "x" }])).toEqual([]);
    expect(parseStripDelimiterPairs([{ open: "a", close: long }])).toEqual([]);
  });
});

describe("parseNarrationFieldValue", () => {
  it("returns empty object for non-object", () => {
    expect(parseNarrationFieldValue(null)).toEqual({});
    expect(parseNarrationFieldValue(undefined)).toEqual({});
    expect(parseNarrationFieldValue("x")).toEqual({});
  });

  it("parses voiceId and audioFileId", () => {
    expect(parseNarrationFieldValue({ voiceId: " v1 ", audioFileId: 7 })).toEqual({
      voiceId: "v1",
      audioFileId: 7,
    });
  });

  it("parses numeric audioFileId from string", () => {
    expect(parseNarrationFieldValue({ audioFileId: "42" })).toEqual({
      audioFileId: 42,
    });
  });

  it("parses JSON string values from the Content Manager form state", () => {
    expect(parseNarrationFieldValue('{ "voiceId": " abc ", "audioFileId": 3 }')).toEqual({
      voiceId: "abc",
      audioFileId: 3,
    });
  });
});
