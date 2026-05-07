import { describe, expect, it } from "vitest";

import config from "./index";

describe("plugin config defaults", () => {
  it("exposes safe Strapi-shape defaults", () => {
    expect(config.default).toEqual({
      modelId: "eleven_multilingual_v2",
      maxChars: 50_000,
      voiceCatalog: [],
      voicesListCacheTtlMs: 86_400_000,
      ttsDryRun: false,
      ttsRequestTimeoutMs: 8 * 60 * 1000,
    });
  });

  it("validator is callable and returns nothing (no-op until Strapi v6)", () => {
    expect(typeof config.validator).toBe("function");
    expect(config.validator()).toBeUndefined();
  });
});
