import { NarrationGenerateRequestError, getAdminBackendBaseUrl } from "./postNarrationGenerateOnce";

export type NarrationTestTtsSuccessPayload = {
  audioBase64: string;
  byteLength: number;
  mimeType: string;
  narrationRequestId: string;
  dryRun: boolean;
};

type Wrapped = { data: NarrationTestTtsSuccessPayload };

/**
 * Single POST to test TTS — avoids admin client replaying the request after 401 refresh
 * (which would call ElevenLabs twice for the same demo).
 */
export async function postNarrationTestTtsOnce(
  voiceId: string,
  token: string | null,
  opts?: { providerId?: string }
): Promise<Wrapped> {
  if (!token) {
    throw new NarrationGenerateRequestError("Not authenticated.");
  }
  const base = getAdminBackendBaseUrl();
  if (!base) {
    throw new NarrationGenerateRequestError(
      "Admin backend URL unavailable (window.strapi.backendURL)."
    );
  }

  const url = `${base}/narration/test-tts`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        voiceId,
        providerId: opts?.providerId ?? "elevenlabs",
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new NarrationGenerateRequestError(`Network error calling narration test TTS: ${msg}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new NarrationGenerateRequestError(
      response.ok ? "Invalid JSON in success response." : "Invalid JSON in error response.",
      { data: {} }
    );
  }

  const obj = body as {
    data?: NarrationTestTtsSuccessPayload;
    error?: { message?: string; details?: Record<string, unknown> };
  };

  if (!response.ok) {
    const errObj = obj?.error;
    const message =
      typeof errObj?.message === "string" && errObj.message.trim().length > 0
        ? errObj.message
        : `Request failed (${response.status})`;
    throw new NarrationGenerateRequestError(message, {
      data: body as {
        error?: { message?: string; details?: Record<string, unknown> };
      },
    });
  }

  if (!obj?.data || typeof obj.data !== "object" || typeof obj.data.audioBase64 !== "string") {
    throw new NarrationGenerateRequestError("Test TTS response missing audio data.", {
      data: { error: { message: "Malformed response" } },
    });
  }

  return { data: obj.data };
}
