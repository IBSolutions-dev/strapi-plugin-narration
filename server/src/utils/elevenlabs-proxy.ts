import { ProxyAgent } from "undici";

let cachedUrl: string | undefined;
let cachedAgent: ProxyAgent | undefined;

/**
 * Resolves outbound proxy URL for ElevenLabs HTTPS calls.
 * Order: `ELEVENLABS_HTTPS_PROXY`, then `HTTPS_PROXY` / `https_proxy`, then `HTTP_PROXY` / `http_proxy`.
 * Node's global `fetch` does not read these; the plugin passes a Undici `ProxyAgent` when any is set.
 */
export function resolveElevenLabsProxyUrl(): string | undefined {
  const raw =
    process.env.ELEVENLABS_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.http_proxy?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function isElevenLabsProxyConfigured(): boolean {
  return resolveElevenLabsProxyUrl() !== undefined;
}

/** Reused across requests; recreated if the resolved proxy URL changes. */
export function getElevenLabsProxyAgent(): ProxyAgent | undefined {
  const url = resolveElevenLabsProxyUrl();
  if (!url) {
    const prev = cachedAgent;
    cachedAgent = undefined;
    cachedUrl = undefined;
    if (prev) void prev.close();
    return undefined;
  }
  if (cachedAgent && cachedUrl === url) return cachedAgent;
  const prev = cachedAgent;
  cachedAgent = undefined;
  cachedUrl = undefined;
  if (prev) void prev.close();
  cachedUrl = url;
  cachedAgent = new ProxyAgent(url);
  return cachedAgent;
}

/**
 * Close and forget the cached `ProxyAgent`. Called from the plugin `destroy()`
 * hook so hot reloads / shutdowns do not leak undici sockets, and re-exported
 * under a `*ForTesting` alias for vitest cases that toggle proxy env vars.
 */
export function disposeElevenLabsProxyAgent(): void {
  const prev = cachedAgent;
  cachedAgent = undefined;
  cachedUrl = undefined;
  if (prev) void prev.close();
}

export const resetElevenLabsProxyAgentForTesting = disposeElevenLabsProxyAgent;
