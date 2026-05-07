import * as React from "react";
import { Box } from "@strapi/design-system";
import { useTheme } from "styled-components";

import { buildNarrationAudioControlsBarStyle } from "./narrationAudioControlsBarStyle";

export type NarrationHtmlAudioPlayerProps = {
  src: string;
  /** Shown when the browser cannot play `<audio>` */
  fallbackText: string;
  /** Outer wrapper max width (matches content entry player default) */
  maxWidth?: string;
  "aria-label"?: string;
};

/**
 * Native `<audio controls>` bar shared by the custom field (entry) and plugin home Narration test.
 */
export function NarrationHtmlAudioPlayer({
  src,
  fallbackText,
  maxWidth = "480px",
  "aria-label": ariaLabel,
}: NarrationHtmlAudioPlayerProps) {
  const theme = useTheme();
  const accent = theme.colors.buttonPrimary600;

  return (
    <Box
      style={{
        maxWidth,
        paddingTop: "10px",
        paddingBottom: "10px",
      }}
    >
      <audio
        controls
        src={src}
        aria-label={ariaLabel}
        style={buildNarrationAudioControlsBarStyle(accent)}
      >
        {fallbackText}
      </audio>
    </Box>
  );
}
