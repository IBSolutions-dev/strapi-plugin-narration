import { PLUGIN_CONFIG_KEY, STRAPI_PLUGIN_ID } from "./plugin-metadata";

/**
 * Single source of truth for the plugin's admin surface.
 *
 * Everything that depends on these actions is derived from this array:
 * - `bootstrap.ts` registers them as RBAC permission actions
 * - `routes/admin/index.ts` builds Koa routes from `route` + `auth.scope`
 *   computed via {@link toAdminScope}
 * - the wiring test (`routes/admin/index.permissions.test.ts`) asserts
 *   that RBAC scopes and routes cannot drift
 *
 * Strapi requires `uid` to be lowercase with `.`/`-` only. Routes whose
 * handlers use camelCase (`testTts`, `settingsStatus`) bind `config.auth.scope`
 * to these kebab-case action ids explicitly.
 */
export const NARRATION_ADMIN_ACTIONS = [
  {
    section: "plugins",
    displayName: "List TTS providers (narration)",
    uid: "narration.providers",
    pluginName: STRAPI_PLUGIN_ID,
    route: {
      method: "GET" as const,
      path: "/providers",
      handler: "narration.providers",
    },
  },
  {
    section: "plugins",
    displayName: "List narration voices",
    uid: "narration.voices",
    pluginName: STRAPI_PLUGIN_ID,
    route: {
      method: "GET" as const,
      path: "/voices",
      handler: "narration.voices",
    },
  },
  {
    section: "plugins",
    displayName: "Generate narration from entry",
    uid: "narration.generate",
    pluginName: STRAPI_PLUGIN_ID,
    route: {
      method: "POST" as const,
      path: "/generate",
      handler: "narration.generate",
    },
  },
  {
    section: "plugins",
    displayName: "Run narration TTS test (admin demo)",
    uid: "narration.test-tts",
    pluginName: STRAPI_PLUGIN_ID,
    route: {
      method: "POST" as const,
      path: "/test-tts",
      handler: "narration.testTts",
    },
  },
  {
    section: "plugins",
    displayName: "View narration connection status",
    uid: "narration.settings-status",
    pluginName: STRAPI_PLUGIN_ID,
    route: {
      method: "GET" as const,
      path: "/configuration-status",
      handler: "narration.settingsStatus",
    },
  },
  {
    section: "plugins",
    displayName: "View narration plugin info",
    uid: "narration.plugin-info",
    pluginName: STRAPI_PLUGIN_ID,
    route: {
      method: "GET" as const,
      path: "/plugin-info",
      handler: "narration.pluginInfo",
    },
  },
] as const;

export type NarrationAdminAction = (typeof NARRATION_ADMIN_ACTIONS)[number];
export type NarrationAdminActionUid = NarrationAdminAction["uid"];

/**
 * Compute the Strapi RBAC scope id (`plugin::<id>.<action>`) for an action.
 * Always derive scopes via this helper — never inline `plugin::…` strings.
 */
export function toAdminScope(actionUid: NarrationAdminActionUid): string {
  return `${PLUGIN_CONFIG_KEY}.${actionUid}`;
}
