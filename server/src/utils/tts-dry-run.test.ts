import { afterEach, describe, expect, it } from "vitest";

import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import {
  getDryRunTtsMp3Buffer,
  isTtsDryRunEnabled,
  parseNarrationTtsDryRunEnv,
} from "./tts-dry-run";

function mockStrapi(config: Record<string, unknown>) {
  return {
    config: {
      get: (key: string) => (key === PLUGIN_CONFIG_KEY ? config : undefined),
    },
  } as never;
}

describe("parseNarrationTtsDryRunEnv", () => {
  it("returns null for unset or blank", () => {
    expect(parseNarrationTtsDryRunEnv(undefined)).toBeNull();
    expect(parseNarrationTtsDryRunEnv("")).toBeNull();
    expect(parseNarrationTtsDryRunEnv("   ")).toBeNull();
  });

  it("parses truthy tokens", () => {
    expect(parseNarrationTtsDryRunEnv("1")).toBe(true);
    expect(parseNarrationTtsDryRunEnv("TRUE")).toBe(true);
    expect(parseNarrationTtsDryRunEnv("yes")).toBe(true);
    expect(parseNarrationTtsDryRunEnv("On")).toBe(true);
  });

  it("parses falsy tokens", () => {
    expect(parseNarrationTtsDryRunEnv("0")).toBe(false);
    expect(parseNarrationTtsDryRunEnv("false")).toBe(false);
    expect(parseNarrationTtsDryRunEnv("NO")).toBe(false);
    expect(parseNarrationTtsDryRunEnv("off")).toBe(false);
  });

  it("returns null for unrecognized non-empty values", () => {
    expect(parseNarrationTtsDryRunEnv("maybe")).toBeNull();
    expect(parseNarrationTtsDryRunEnv("tru")).toBeNull();
  });
});

describe("isTtsDryRunEnabled", () => {
  const prev = process.env.STRAPI_NARRATION_TTS_DRY_RUN;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    } else {
      process.env.STRAPI_NARRATION_TTS_DRY_RUN = prev;
    }
  });

  it("uses env when set to truthy", () => {
    process.env.STRAPI_NARRATION_TTS_DRY_RUN = "1";
    expect(isTtsDryRunEnabled(mockStrapi({ ttsDryRun: false }))).toBe(true);
  });

  it("uses env when set to falsy even if config is true", () => {
    process.env.STRAPI_NARRATION_TTS_DRY_RUN = "0";
    expect(isTtsDryRunEnabled(mockStrapi({ ttsDryRun: true }))).toBe(false);
  });

  it("falls back to plugin config when env unset", () => {
    delete process.env.STRAPI_NARRATION_TTS_DRY_RUN;
    expect(isTtsDryRunEnabled(mockStrapi({ ttsDryRun: true }))).toBe(true);
    expect(isTtsDryRunEnabled(mockStrapi({}))).toBe(false);
  });

  it("ignores invalid env and uses config", () => {
    process.env.STRAPI_NARRATION_TTS_DRY_RUN = "garbage";
    expect(isTtsDryRunEnabled(mockStrapi({ ttsDryRun: true }))).toBe(true);
    expect(isTtsDryRunEnabled(mockStrapi({}))).toBe(false);
  });
});

describe("getDryRunTtsMp3Buffer", () => {
  it("returns a stable non-empty buffer", () => {
    const a = getDryRunTtsMp3Buffer();
    const b = getDryRunTtsMp3Buffer();
    expect(a.length).toBe(72);
    expect(a.equals(b)).toBe(true);
    expect(a[0]).toBe(0xff);
  });
});
