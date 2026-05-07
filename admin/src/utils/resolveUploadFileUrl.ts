/** Signed or public `url` from Strapi upload `admin-file.findOne` (sanitizeOutput). */
export function resolveUploadFileAbsoluteUrl(
  backendBase: string,
  file: { url?: string | null }
): string | null {
  const raw = file.url;
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const u = raw.trim();
  if (/^https?:\/\//i.test(u)) return u;
  const base = backendBase.replace(/\/+$/, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

/**
 * Strapi admin `GET /upload/files/:id` returns the sanitized file at the root of JSON
 * (not wrapped in `{ data }`).
 */
export function parseUploadFileFindOneResponse(data: unknown): {
  url?: string;
  name?: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const url = o.url;
  const name = o.name;
  if (typeof url !== "string") return null;
  return {
    url,
    name: typeof name === "string" ? name : undefined,
  };
}
