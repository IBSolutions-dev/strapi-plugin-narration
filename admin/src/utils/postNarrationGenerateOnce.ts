/**
 * Single POST to narration generate — no Strapi admin client 401 replay.
 * `useFetchClient().post` retries the full request after token refresh on 401, which
 * would run TTS again and can double-charge ElevenLabs.
 */

export type NarrationGenerateSuccessPayload = {
  textLength: number;
  fileId: number | string;
  narrationRequestId: string;
};

type StrapiWrappedBody = { data: NarrationGenerateSuccessPayload };

export function getAdminBackendBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const w = window as Window & { strapi?: { backendURL?: string } };
  const raw = w.strapi?.backendURL ?? "";
  return raw.replace(/\/+$/, "");
}

/** Same shape as Strapi admin `FetchError` for `formatGenerateErrorMessage`. */
export class NarrationGenerateRequestError extends Error {
  readonly response?: {
    data: { error?: { message?: string; details?: Record<string, unknown> } };
  };

  constructor(message: string, response?: NarrationGenerateRequestError["response"]) {
    super(message);
    this.name = "NarrationGenerateRequestError";
    this.response = response;
  }
}

export async function postNarrationGenerateOnce(
  payload: {
    uid: string;
    documentId: string;
    attributeName: string;
    locale: string | null;
    values: Record<string, unknown>;
    voiceId: string;
  },
  token: string | null
): Promise<{ data: StrapiWrappedBody }> {
  if (!token) {
    throw new NarrationGenerateRequestError("Not authenticated.");
  }
  const base = getAdminBackendBaseUrl();
  if (!base) {
    throw new NarrationGenerateRequestError(
      "Admin backend URL unavailable (window.strapi.backendURL)."
    );
  }

  const url = `${base}/narration/generate`;
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
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new NarrationGenerateRequestError(`Network error calling narration generate: ${msg}`);
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
    data?: StrapiWrappedBody["data"];
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

  if (!obj?.data || typeof obj.data !== "object") {
    throw new NarrationGenerateRequestError("Narration generate response missing data.", {
      data: { error: { message: "Malformed response" } },
    });
  }

  return { data: obj as StrapiWrappedBody };
}
