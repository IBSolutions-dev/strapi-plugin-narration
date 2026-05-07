import { describe, expect, it, vi } from "vitest";
import { CUSTOM_FIELD_UID } from "./narration-options";
import { findNarrationFieldOnSchema } from "./schema";

describe("findNarrationFieldOnSchema", () => {
  function strapiWithAudio(attrType: string) {
    return {
      getModel: vi.fn(() => ({
        attributes: {
          audio: {
            type: attrType,
            customField: CUSTOM_FIELD_UID,
            options: {
              narrationSources: [{ field: "title", kind: "scalar" }],
            },
          },
        },
      })),
    };
  }

  it("matches merged model where custom field type is json", () => {
    const m = findNarrationFieldOnSchema(
      strapiWithAudio("json") as never,
      "api::insight.insight",
      "audio"
    );
    expect(m?.attributeName).toBe("audio");
    expect(m?.options.narrationSources).toEqual([{ field: "title", kind: "scalar" }]);
  });

  it("matches schema.json style type customField", () => {
    const m = findNarrationFieldOnSchema(
      strapiWithAudio("customField") as never,
      "api::insight.insight",
      "audio"
    );
    expect(m?.attributeName).toBe("audio");
  });

  it("returns null when customField uid does not match", () => {
    const strapi = {
      getModel: vi.fn(() => ({
        attributes: {
          audio: {
            type: "json",
            customField: "plugin::other.other",
            options: {},
          },
        },
      })),
    };
    expect(findNarrationFieldOnSchema(strapi as never, "api::insight.insight", "audio")).toBeNull();
  });
});
