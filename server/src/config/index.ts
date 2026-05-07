export default {
  default: {
    /** Set `apiKey` in the host app `config/plugins.ts` via `env("ELEVENLABS_API_KEY")` or rely on `process.env`. */
    modelId: "eleven_multilingual_v2",
    maxChars: 50_000,
    /**
     * Non-empty list → admin voice pickers use this only; no ElevenLabs GET /v1/voices.
     * Override with env `ELEVENLABS_VOICE_CATALOG_JSON` if `plugins.ts` is not used.
     */
    voiceCatalog: [] as Array<{
      voice_id: string;
      name: string;
      category?: string;
    }>,
    /** In-memory cache TTL for GET /v1/voices (ms). 0 = always refetch. Default 24h. */
    voicesListCacheTtlMs: 86_400_000,
    /**
     * When true, TTS uses a tiny placeholder MP3 and never calls ElevenLabs.
     * Override at runtime with env `STRAPI_NARRATION_TTS_DRY_RUN` (see `utils/tts-dry-run.ts`).
     */
    ttsDryRun: false,
    /**
     * Hard timeout (ms) for a single ElevenLabs TTS request. Passed as an
     * `AbortSignal` to undici / SDK fetch so a stuck network call rejects in
     * bounded time and the in-memory generate-lock is released.
     *
     * Default 8 minutes — covers long ElevenLabs jobs while still ensuring the
     * lock cannot wedge the entry+field+voice tuple permanently.
     */
    ttsRequestTimeoutMs: 8 * 60 * 1000,
  },
  validator() {},
};
