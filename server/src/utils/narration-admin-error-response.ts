import { ElevenLabsHttpError, ElevenLabsNetworkError } from "./elevenlabs-errors";

/** Same shape as `@strapi/core` `formatApplicationError` for admin JSON clients. */
export type StrapiAdminErrorPayload = {
  data: null;
  error: {
    status: number;
    name: string;
    message: string;
    details: Record<string, unknown>;
  };
};

/**
 * Build status + body for narration admin routes without throwing `ApplicationError`
 * from a duplicate `@strapi/utils` copy (linked plugin `node_modules`), which breaks
 * Strapi's `instanceof` check and yields opaque 500s.
 */
export function narrationAdminErrorResponse(
  err: unknown,
  opts?: { narrationRequestId?: string }
): { status: number; body: StrapiAdminErrorPayload } {
  const narrationRequestId = opts?.narrationRequestId;
  const withRid = (details: Record<string, unknown>) => {
    if (narrationRequestId) details.narrationRequestId = narrationRequestId;
    return details;
  };

  if (err instanceof ElevenLabsHttpError) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 502;
    return {
      status,
      body: {
        data: null,
        error: {
          status,
          name: "ApplicationError",
          message: err.message,
          details: withRid({
            elevenLabs: {
              kind: err.kind,
              status: err.status,
              formatted: err.formatted,
            },
          }),
        },
      },
    };
  }

  if (err instanceof ElevenLabsNetworkError) {
    const status = 502;
    return {
      status,
      body: {
        data: null,
        error: {
          status,
          name: "ApplicationError",
          message: err.message,
          details: withRid({
            elevenLabs: {
              kind: err.kind,
              ...(err.code ? { code: err.code } : {}),
              formatted: err.formatted,
            },
          }),
        },
      },
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  const status = 400;
  return {
    status,
    body: {
      data: null,
      error: {
        status,
        name: "ApplicationError",
        message: msg,
        details: narrationRequestId ? withRid({}) : {},
      },
    },
  };
}
