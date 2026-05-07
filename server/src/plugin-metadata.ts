/**
 * Host-visible Strapi plugin id: `strapi.plugin(...)`, `config/plugins.ts` key,
 * and `strapi.config.get('plugin::…')` namespace.
 *
 * Single source of truth — must equal `package.json` → `strapi.name`. Every
 * runtime reference to the plugin (admin RBAC scopes, log prefixes, custom
 * field UID, i18n key namespace) MUST derive from this constant; no string
 * literal containing the plugin id is permitted elsewhere in the source tree.
 */
export const STRAPI_PLUGIN_ID = "narration" as const;

/**
 * `strapi.config.get(PLUGIN_CONFIG_KEY)` and the prefix for admin permission
 * action UIDs (`plugin::<id>.<action>`). Computed — never hardcoded.
 */
export const PLUGIN_CONFIG_KEY = `plugin::${STRAPI_PLUGIN_ID}` as const;

/** Log-line prefix used by all plugin telemetry/diagnostics output. */
export const PLUGIN_LOG_TAG = `[plugin:${STRAPI_PLUGIN_ID}]` as const;
