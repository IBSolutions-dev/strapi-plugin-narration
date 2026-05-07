import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";

/**
 * Custom field type UID registered by this plugin. Derived from the plugin
 * SSOT so it always tracks `package.json` → `strapi.name`.
 */
export const CUSTOM_FIELD_UID = `${PLUGIN_CONFIG_KEY}.narration` as const;

export {
  NARRATION_SOURCE_PAUSE_SECONDS_LIMITS,
  STRIP_DELIMITER_PAIR_LIMITS,
  defaultNarrationOptions,
  mergeNarrationOptions,
  normalizeNarrationSourcePauseSeconds,
  parseNarrationFieldValue,
  parseStripDelimiterPairs,
  type NarrationFieldOptions,
  type NarrationFieldValue,
  type NarrationSource,
  type NarrationSourceKind,
  type StripDelimiterPair,
} from "../../../shared/narration-field-options";
