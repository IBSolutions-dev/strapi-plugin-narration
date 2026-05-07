/** Same shape as ElevenLabs list response items (avoid importing the service module). */
export type VoicesListCacheVoice = {
  voice_id: string;
  name: string;
  category?: string;
};

type Entry = { voices: VoicesListCacheVoice[]; fetchedAt: number };

let cache: Entry | null = null;

export function getCachedVoicesList(ttlMs: number): VoicesListCacheVoice[] | null {
  if (!cache) return null;
  if (ttlMs <= 0) return null;
  if (Date.now() - cache.fetchedAt > ttlMs) {
    cache = null;
    return null;
  }
  return cache.voices;
}

export function setCachedVoicesList(voices: VoicesListCacheVoice[]): void {
  cache = { voices, fetchedAt: Date.now() };
}

/**
 * Drop the in-memory voices cache. Called from `destroy()` on shutdown / hot
 * reload, and re-exported under a `*ForTesting` alias so vitest cases keep
 * their existing import.
 */
export function clearVoicesListCache(): void {
  cache = null;
}

export const resetVoicesListCacheForTesting = clearVoicesListCache;
