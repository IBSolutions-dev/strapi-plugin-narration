import type { Core } from "@strapi/strapi";

import { PLUGIN_LOG_TAG } from "./plugin-metadata";
import { disposeElevenLabsProxyAgent } from "./utils/elevenlabs-proxy";
import { clearNarrationGenerateLocks } from "./utils/narration-generate-lock";
import { clearVoicesListCache } from "./utils/voices-list-cache";

/**
 * Strapi calls this on shutdown / hot reload. Release every module-level
 * resource the plugin owns so repeated reloads do not accumulate state:
 *
 * - close the cached undici `ProxyAgent` (sockets / TLS handles)
 * - drop the in-memory ElevenLabs voices list cache
 * - clear the in-memory generate-lock registry
 *
 * Each disposer is idempotent and safe when nothing was allocated yet.
 */
const destroy = ({ strapi }: { strapi: Core.Strapi }): void => {
  try {
    disposeElevenLabsProxyAgent();
    clearVoicesListCache();
    clearNarrationGenerateLocks();
  } catch (e) {
    strapi.log.warn(
      `${PLUGIN_LOG_TAG} destroy() encountered a non-fatal cleanup error: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
};

export default destroy;
