import * as yup from "yup";

import { NARRATION_SOURCE_PAUSE_SECONDS_LIMITS } from "../../shared/narration-field-options";
import { PLUGIN_ID } from "./pluginId";

const sourceRow = yup.object({
  field: yup.string().trim().required(),
  kind: yup.string().oneOf(["scalar", "blocks"]).required(),
});

const delimiterPairRow = yup.object({
  open: yup.string(),
  close: yup.string(),
});

/**
 * CTB Yup shape for `attribute.options` (keys without `options.` prefix — CTB wraps in `options`).
 */
export const narrationFieldOptionsValidator = () => ({
  narrationSources: yup.array().of(sourceRow).min(1, "At least one narration source is required"),
  defaultVoiceId: yup
    .string()
    .transform((v) => (v == null || v === undefined ? "" : String(v)).trim())
    .min(1, "Pick a default voice for this narration field"),
  blockTypesAllowlist: yup.mixed().nullable(),
  stripDelimiterPairs: yup.array().of(delimiterPairRow).nullable(),
  narrationSourcePauseSeconds: yup
    .number()
    .transform((value, originalValue) => {
      if (originalValue === undefined || originalValue === null || originalValue === "") return 0;
      const n = typeof originalValue === "number" ? originalValue : Number(originalValue);
      return Number.isFinite(n) ? n : 0;
    })
    .min(NARRATION_SOURCE_PAUSE_SECONDS_LIMITS.min)
    .max(NARRATION_SOURCE_PAUSE_SECONDS_LIMITS.max),
});

const defaultSources = [
  { field: "title", kind: "scalar" as const },
  { field: "content", kind: "blocks" as const },
];

export const narrationCustomFieldFormOptions = {
  base: [
    {
      intlLabel: {
        id: `${PLUGIN_ID}.options.narrationSources.label`,
        defaultMessage: "Narration sources (order)",
      },
      description: {
        id: `${PLUGIN_ID}.options.narrationSources.description`,
        defaultMessage:
          "Pick fields on this type and order them. Blocks vs text handling follows each field’s Strapi type automatically.",
      },
      name: "options.narrationSources",
      type: "narration-ctb-sources",
      size: 12,
      defaultValue: defaultSources,
    },
    {
      intlLabel: {
        id: `${PLUGIN_ID}.options.defaultVoiceId.label`,
        defaultMessage: "Default voice (required)",
      },
      description: {
        id: `${PLUGIN_ID}.options.defaultVoiceId.description`,
        defaultMessage:
          "Required — this voice is used in the entry editor when no per-entry choice is stored yet, and as the baseline until the author picks another voice.",
      },
      name: "options.defaultVoiceId",
      type: "narration-ctb-default-voice",
      size: 12,
      defaultValue: "",
    },
  ],
  advanced: [
    {
      sectionTitle: {
        id: `${PLUGIN_ID}.options.section.blocks`,
        defaultMessage: "Blocks text filter",
      },
      items: [
        {
          intlLabel: {
            id: `${PLUGIN_ID}.options.blockTypesAllowlist.label`,
            defaultMessage: "Block types allowlist",
          },
          description: {
            id: `${PLUGIN_ID}.options.blockTypesAllowlist.description`,
            defaultMessage:
              "Comma-separated block type names to include from blocks sources (e.g. paragraph,heading,list,list-item). Leave empty for plugin defaults.",
          },
          name: "options.blockTypesAllowlist",
          type: "text",
          defaultValue: "paragraph,heading,list,list-item",
        },
        {
          intlLabel: {
            id: `${PLUGIN_ID}.options.stripDelimiterPairs.label`,
            defaultMessage: "Strip text between custom delimiters",
          },
          description: {
            id: `${PLUGIN_ID}.options.stripDelimiterPairs.description`,
            defaultMessage:
              "For each row, remove the first matching region from the start tag through the end tag (inclusive), repeating until none remain. Process rows in order — e.g. start {{component: and end }} removes shortcode blocks and inner text. Empty rows are ignored at generation time.",
          },
          name: "options.stripDelimiterPairs",
          type: "narration-ctb-strip-delimiters",
          defaultValue: [],
        },
      ],
    },
    {
      sectionTitle: {
        id: `${PLUGIN_ID}.options.section.speech`,
        defaultMessage: "Speech synthesis",
      },
      items: [
        {
          intlLabel: {
            id: `${PLUGIN_ID}.options.narrationSourcePauseSeconds.label`,
            defaultMessage: "Pause between narration sources (seconds)",
          },
          description: {
            id: `${PLUGIN_ID}.options.narrationSourcePauseSeconds.description`,
            defaultMessage:
              "Extra silence inserted between each configured source when building TTS text. Uses an SSML-style break tag (0 = off). Maximum 3 seconds. Effect depends on your ElevenLabs model — some models ignore breaks or use different pause syntax; see ElevenLabs docs.",
          },
          name: "options.narrationSourcePauseSeconds",
          type: "number",
          defaultValue: 0,
        },
      ],
    },
  ],
  validator: narrationFieldOptionsValidator,
};
