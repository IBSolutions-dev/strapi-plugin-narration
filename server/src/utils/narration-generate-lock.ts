/**
 * Prevents overlapping narration.generate runs for the same entry + field + voice.
 *
 * A second request fails immediately (no ElevenLabs call) so accidental
 * double-submit or parallel tabs do not double-charge. The lock entry stores
 * an acquisition timestamp; entries older than {@link DEFAULT_LOCK_TTL_MS}
 * are treated as stale (e.g. crashed handler that never reached `finally`)
 * and the new request is allowed to take over.
 */

/** Default 10 minutes — must comfortably exceed any realistic TTS timeout. */
export const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000;

const locks = new Map<string, number>();

export function makeNarrationGenerateLockKey(parts: {
  uid: string;
  documentId: string;
  attributeName: string;
  locale?: string | null;
  voiceId: string;
}): string {
  return [
    parts.uid,
    parts.documentId,
    parts.attributeName.trim(),
    String(parts.locale ?? ""),
    parts.voiceId,
  ].join("\0");
}

export type AcquireLockOptions = {
  /** Acquired entries older than this are treated as stale. */
  staleAfterMs?: number;
  /** Override the clock for tests / fault injection. */
  now?: () => number;
};

export function acquireNarrationGenerateLock(lockKey: string, opts: AcquireLockOptions = {}): void {
  const ttl = opts.staleAfterMs ?? DEFAULT_LOCK_TTL_MS;
  const now = opts.now ? opts.now() : Date.now();
  const acquiredAt = locks.get(lockKey);
  if (acquiredAt !== undefined && now - acquiredAt < ttl) {
    throw new Error(
      "Narration generation is already running for this document field. Wait until it finishes before trying again so ElevenLabs is not charged twice."
    );
  }
  locks.set(lockKey, now);
}

export function releaseNarrationGenerateLock(lockKey: string): void {
  locks.delete(lockKey);
}

/**
 * Drop all in-memory generate locks. Called from the plugin `destroy()` hook;
 * re-exported as `*ForTesting` for vitest cases that need a clean slate.
 */
export function clearNarrationGenerateLocks(): void {
  locks.clear();
}

export const resetNarrationGenerateLocksForTesting = clearNarrationGenerateLocks;
