import { describe, expect, it } from "vitest";

import { buildNarrationAudioControlsBarStyle } from "./narrationAudioControlsBarStyle";

describe("buildNarrationAudioControlsBarStyle", () => {
  it("matches the shared native controls bar dimensions and accent", () => {
    const s = buildNarrationAudioControlsBarStyle("#663399");
    expect(s).toMatchObject({
      width: "100%",
      height: "2.8125rem",
      maxHeight: "2.8125rem",
      minHeight: "2.8125rem",
      accentColor: "#663399",
    });
  });
});
