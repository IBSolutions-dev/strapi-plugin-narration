/**
 * Build an admin-safe message from an ElevenLabs HTTP error body (JSON or plain text).
 */
export function formatElevenLabsErrorResponse(status: number, bodyText: string): string {
  const trimmed = bodyText.trim();
  try {
    const j = JSON.parse(trimmed) as {
      detail?: string | { message?: string; status?: string };
    };
    const d = j?.detail;
    if (typeof d === "string") {
      return `ElevenLabs (${status}): ${d}`;
    }
    if (d && typeof d === "object" && typeof d.message === "string") {
      return `ElevenLabs (${status}): ${d.message}`;
    }
  } catch {
    /* not JSON */
  }
  const snippet = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  return `ElevenLabs (${status}): ${snippet || "Unknown error"}`;
}

export type ElevenLabsErrorKind =
  | "quota_exceeded"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "upstream";

function extractDetailLower(bodyText: string): string {
  const trimmed = bodyText.trim();
  try {
    const j = JSON.parse(trimmed) as {
      detail?: string | { message?: string };
    };
    const d = j?.detail;
    if (typeof d === "string") return d.toLowerCase();
    if (d && typeof d === "object" && typeof d.message === "string") {
      return d.message.toLowerCase();
    }
  } catch {
    /* not JSON */
  }
  return trimmed.toLowerCase();
}

export function inferElevenLabsErrorKind(
  status: number,
  bodyText: string,
  formattedMessage: string
): ElevenLabsErrorKind {
  const blob = `${extractDetailLower(bodyText)} ${formattedMessage.toLowerCase()}`;
  if (
    blob.includes("quota") ||
    blob.includes("credits remaining") ||
    blob.includes("credits are required") ||
    blob.includes("exceeds your") ||
    blob.includes("insufficient") ||
    blob.includes("billing") ||
    blob.includes("payment required") ||
    blob.includes("subscription")
  ) {
    return "quota_exceeded";
  }
  if (status === 429 || blob.includes("rate limit")) {
    return "rate_limited";
  }
  if (
    status === 403 ||
    blob.includes("permission") ||
    blob.includes("forbidden") ||
    blob.includes("missing the permission")
  ) {
    return "forbidden";
  }
  if (status === 401) {
    return "unauthorized";
  }
  return "upstream";
}

function userFacingMessage(kind: ElevenLabsErrorKind, formatted: string): string {
  switch (kind) {
    case "quota_exceeded":
      return (
        "Not enough ElevenLabs credits for this narration. " +
        "Add credits or upgrade your plan at elevenlabs.io, or shorten the source text (title, description, blocks). " +
        `Technical detail: ${formatted}`
      );
    case "rate_limited":
      return (
        "ElevenLabs rate limit reached. Wait a moment and try again. " +
        `Technical detail: ${formatted}`
      );
    case "unauthorized":
      return (
        "ElevenLabs rejected the API key (unauthorized). " +
        "Check ELEVENLABS_API_KEY and that the key is valid for Text to Speech. " +
        `Technical detail: ${formatted}`
      );
    case "forbidden":
      return (
        "ElevenLabs refused this request (permissions). " +
        "Ensure your API key has Text to Speech and Voices access. " +
        `Technical detail: ${formatted}`
      );
    default:
      return formatted;
  }
}

/** Thrown when ElevenLabs returns a non-OK HTTP status. */
export class ElevenLabsHttpError extends Error {
  readonly status: number;
  readonly kind: ElevenLabsErrorKind;
  readonly formatted: string;

  constructor(message: string, status: number, kind: ElevenLabsErrorKind, formatted: string) {
    super(message);
    this.name = "ElevenLabsHttpError";
    this.status = status;
    this.kind = kind;
    this.formatted = formatted;
  }
}

export function createElevenLabsHttpError(status: number, bodyText: string): ElevenLabsHttpError {
  const formatted = formatElevenLabsErrorResponse(status, bodyText);
  const kind = inferElevenLabsErrorKind(status, bodyText, formatted);
  const message = userFacingMessage(kind, formatted);
  return new ElevenLabsHttpError(message, status, kind, formatted);
}

type ErrWithCause = Error & { cause?: unknown };

function readCause(err: Error): unknown {
  return (err as ErrWithCause).cause;
}

/**
 * The ElevenLabs SDK may wrap `fetch` failures as `TypeError: fetch failed` while preserving
 * our {@link ElevenLabsNetworkError} on `.cause`. Peel that off to avoid nested
 * `createElevenLabsNetworkError` doubling the user-facing message.
 */
export function findElevenLabsNetworkErrorInCauseChain(
  err: unknown,
  maxDepth = 8
): ElevenLabsNetworkError | undefined {
  let cur: unknown = err;
  let depth = 0;
  while (cur != null && depth++ < maxDepth) {
    if (cur instanceof ElevenLabsNetworkError) return cur;
    cur = cur instanceof Error ? readCause(cur) : undefined;
  }
  return undefined;
}

function getCauseChainMessages(err: unknown, maxDepth = 6): string[] {
  const out: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur != null && depth++ < maxDepth) {
    if (cur instanceof Error && cur.message) out.push(cur.message);
    const next = cur instanceof Error ? readCause(cur) : undefined;
    cur = next !== undefined ? next : undefined;
  }
  return out;
}

function firstSystemErrorCode(err: unknown): string | undefined {
  let cur: unknown = err;
  let depth = 0;
  while (cur != null && depth++ < 6) {
    if (cur && typeof cur === "object" && "code" in cur) {
      const code = (cur as { code: unknown }).code;
      if (typeof code === "string" && code.length > 0) return code;
    }
    const next = cur instanceof Error ? readCause(cur) : undefined;
    cur = next !== undefined ? next : undefined;
  }
  return undefined;
}

/** Thrown when `fetch` to ElevenLabs fails before an HTTP response (DNS, TLS, proxy, offline). */
export class ElevenLabsNetworkError extends Error {
  readonly kind = "network" as const;
  readonly code?: string;
  /** Cause chain + code for logs and API details */
  readonly formatted: string;

  constructor(message: string, opts: { code?: string; formatted: string }) {
    super(message);
    this.name = "ElevenLabsNetworkError";
    this.code = opts.code;
    this.formatted = opts.formatted;
  }
}

function extraSocketHints(detailLower: string): string {
  if (
    detailLower.includes("und_err_socket") ||
    detailLower.includes("other side closed") ||
    detailLower.includes("econnreset") ||
    detailLower.includes("epipe") ||
    detailLower.includes("etimedout") ||
    detailLower.includes("certificate") ||
    detailLower.includes("ssl") ||
    detailLower.includes("tls") ||
    detailLower.includes("alert handshake")
  ) {
    return (
      " Node does not use the macOS/Windows system proxy for fetch: if you need a proxy, set HTTPS_PROXY or ELEVENLABS_HTTPS_PROXY. " +
      "Sanity-check from the same machine: curl -sS -o /dev/null -w '%{http_code}\\n' -H 'xi-api-key: YOUR_KEY' https://api.elevenlabs.io/v1/voices " +
      "(expect 200). If DNS returns IPv6 first but your network breaks v6, try NODE_OPTIONS=--dns-result-order=ipv4first."
    );
  }
  return "";
}

export function createElevenLabsNetworkError(cause: unknown): ElevenLabsNetworkError {
  const code = firstSystemErrorCode(cause);
  const messages = getCauseChainMessages(cause);
  const joined = messages.length > 0 ? messages.join(" → ") : String(cause ?? "unknown");
  const detail = code ? `${code}: ${joined}` : joined;
  const hints = extraSocketHints(detail.toLowerCase());
  const message =
    "Could not reach ElevenLabs over the network. " +
    "Check that this server can open HTTPS to api.elevenlabs.io (DNS, firewall, corporate proxy, VPN). " +
    `Technical detail: ${detail}.` +
    hints;
  return new ElevenLabsNetworkError(message, { code, formatted: detail });
}
