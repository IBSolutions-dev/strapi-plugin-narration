import packageJson from "../../package.json";

/**
 * Single source of truth for plugin version metadata exposed to the admin UI.
 *
 * Values are derived from `package.json` at build time so the runtime can
 * never drift from the published artifact. Callers MUST read version
 * information through this module instead of duplicating literals.
 */
export type PluginReleaseStability = "stable" | "prerelease";

export type PluginInfo = {
  /** Distribution package name, e.g. `strapi-plugin-narration`. */
  packageName: string;
  /** Semver string published in `package.json#version`. */
  version: string;
  /** Optional homepage URL (`package.json#homepage`) or `null` if missing. */
  homepage: string | null;
  /**
   * Maturity classification derived from the semver string:
   * - `prerelease` for `0.x.y` (pre-1.0, breaking changes allowed) and any
   *   build with a `-tag` (e.g. `1.0.0-beta.0`, `2.1.0-rc.3`).
   * - `stable` for `>=1.0.0` releases without a prerelease tag.
   *
   * The admin uses this to render the "Beta" indicator. It auto-flips when the
   * package.json version bumps to `1.0.0`, so no manual sync is required.
   */
  releaseStability: PluginReleaseStability;
};

/**
 * Pure helper kept exported so unit tests can validate the classification
 * across edge cases (`0.9.0`, `1.0.0`, `1.0.0-beta.0`, `2.0.0-rc.1`, etc.)
 * without touching the imported `package.json`.
 */
export function classifyReleaseStability(version: string): PluginReleaseStability {
  if (typeof version !== "string" || version.trim().length === 0) return "prerelease";
  if (version.includes("-")) return "prerelease";
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(major) && major >= 1 ? "stable" : "prerelease";
}

const HOMEPAGE = typeof packageJson.homepage === "string" ? packageJson.homepage : null;

export const PLUGIN_INFO: PluginInfo = Object.freeze({
  packageName: packageJson.name,
  version: packageJson.version,
  homepage: HOMEPAGE,
  releaseStability: classifyReleaseStability(packageJson.version),
});

/** Convenience accessor mirroring {@link PLUGIN_INFO} for ergonomic call sites. */
export function getPluginInfo(): PluginInfo {
  return PLUGIN_INFO;
}
