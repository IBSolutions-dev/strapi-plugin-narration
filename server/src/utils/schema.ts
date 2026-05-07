import type { Core } from "@strapi/strapi";
import type { UID } from "@strapi/types";
import {
  CUSTOM_FIELD_UID,
  mergeNarrationOptions,
  type NarrationFieldOptions,
} from "./narration-options";

export type NarrationSchemaMatch = {
  attributeName: string;
  options: NarrationFieldOptions;
};

function matchAttribute(attributeName: string, attr: unknown): NarrationSchemaMatch | null {
  const a = attr as { type?: string; customField?: string; options?: unknown };
  // schema.json uses type "customField"; merged model uses the registered field type ("json").
  const isCustomFieldShape =
    a.type === "customField" || (a.type === "json" && typeof a.customField === "string");
  if (!isCustomFieldShape) return null;
  if (a.customField !== CUSTOM_FIELD_UID) return null;
  const rawOpts =
    a.options && typeof a.options === "object" ? (a.options as Record<string, unknown>) : {};
  return {
    attributeName,
    options: mergeNarrationOptions(rawOpts),
  };
}

/**
 * Resolve a narration custom field by attribute API name on a content-type.
 */
export function findNarrationFieldOnSchema(
  strapi: Core.Strapi,
  uid: string,
  attributeName: string
): NarrationSchemaMatch | null {
  const ct = strapi.getModel(uid as UID.ContentType);
  if (!ct?.attributes) return null;
  const attr = ct.attributes[attributeName];
  if (!attr) return null;
  return matchAttribute(attributeName, attr);
}
