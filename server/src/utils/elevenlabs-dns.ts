import dns from "node:dns";

import type { Core } from "@strapi/strapi";

import { PLUGIN_LOG_TAG } from "../plugin-metadata";

/**
 * Prefer A records over AAAA for outbound connections from this Node process.
 *
 * On many dev networks, `api.elevenlabs.io` resolves to IPv6 first while the path
 * to IPv6 is broken; undici then fails with `UND_ERR_SOCKET` / "other side closed".
 * This matches the workaround `NODE_OPTIONS=--dns-result-order=ipv4first`.
 *
 * Opt **in**: `ELEVENLABS_DNS_IPV4_FIRST=1` (or `true` / `on` / `yes`). Any other
 * value — including unset — leaves Node's default DNS result order untouched.
 * This guarantees the plugin never silently mutates global DNS resolution for
 * the host Strapi application.
 */
export function applyElevenLabsOutboundDnsDefaults(strapi: Core.Strapi): void {
  const raw = process.env.ELEVENLABS_DNS_IPV4_FIRST?.trim().toLowerCase();
  const optIn = raw === "1" || raw === "true" || raw === "on" || raw === "yes";
  if (!optIn) {
    strapi.log.debug(
      `${PLUGIN_LOG_TAG} DNS result order untouched (default). Set ELEVENLABS_DNS_IPV4_FIRST=1 to enable the ipv4first tweak when IPv6 is broken.`
    );
    return;
  }
  try {
    dns.setDefaultResultOrder("ipv4first");
    strapi.log.info(
      `${PLUGIN_LOG_TAG} DNS result order: ipv4first (ELEVENLABS_DNS_IPV4_FIRST=${raw}). Unset the env var to restore Node default for the whole process.`
    );
  } catch (e) {
    strapi.log.warn(
      `${PLUGIN_LOG_TAG} dns.setDefaultResultOrder("ipv4first") failed: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}
