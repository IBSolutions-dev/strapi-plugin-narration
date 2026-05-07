import type { Core } from "@strapi/strapi";

import {
  NARRATION_ADMIN_ACTIONS,
  toAdminScope,
  type NarrationAdminAction,
} from "./narration-admin-actions";
import { PLUGIN_LOG_TAG, STRAPI_PLUGIN_ID } from "./plugin-metadata";
import { applyElevenLabsOutboundDnsDefaults } from "./utils/elevenlabs-dns";
import { isTtsDryRunEnabled } from "./utils/tts-dry-run";

/**
 * Register admin RBAC actions for the plugin. The action set is derived from
 * the SSOT in `narration-admin-actions.ts`; route definitions and tests
 * consume the same array, so RBAC scopes can never drift from routing.
 *
 * `actionProvider.registerMany` rejects duplicates, so we filter to actions
 * that are not yet registered (idempotent across hot reloads / upgrades).
 */
async function registerNarrationAdminPermissionActions(strapi: Core.Strapi): Promise<void> {
  const actionProvider = strapi.service("admin::permission").actionProvider as {
    has: (actionId: string) => boolean;
    registerMany: (actions: unknown[]) => Promise<void>;
  };

  const toActionRecord = (action: NarrationAdminAction) => ({
    section: action.section,
    displayName: action.displayName,
    uid: action.uid,
    pluginName: STRAPI_PLUGIN_ID,
  });

  const missing = NARRATION_ADMIN_ACTIONS.filter(
    (a) => !actionProvider.has(toAdminScope(a.uid))
  ).map(toActionRecord);

  if (missing.length === 0) {
    return;
  }
  await actionProvider.registerMany(missing);
}

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  applyElevenLabsOutboundDnsDefaults(strapi);
  if (isTtsDryRunEnabled(strapi)) {
    strapi.log.warn(
      `${PLUGIN_LOG_TAG} TTS dry run is enabled: ElevenLabs text-to-speech is not called; a placeholder MP3 is used. Remove STRAPI_NARRATION_TTS_DRY_RUN (or set it to 0/false) and disable config.ttsDryRun before production.`
    );
  }
  await registerNarrationAdminPermissionActions(strapi);
};

export default bootstrap;
