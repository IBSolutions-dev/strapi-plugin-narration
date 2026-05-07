import type { CSSProperties } from "react";

/** Native `<audio controls>` bar — shared by entry field and plugin home Narration test */
export function buildNarrationAudioControlsBarStyle(accentColor: string): CSSProperties {
  return {
    width: "100%",
    height: "2.8125rem",
    maxHeight: "2.8125rem",
    minHeight: "2.8125rem",
    accentColor,
  };
}
