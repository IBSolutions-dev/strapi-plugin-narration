import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { PLUGIN_INFO, classifyReleaseStability, getPluginInfo } from "./plugin-version";

describe("plugin-version SSOT", () => {
  it("mirrors package.json fields", () => {
    expect(PLUGIN_INFO.packageName).toBe(packageJson.name);
    expect(PLUGIN_INFO.version).toBe(packageJson.version);
    expect(PLUGIN_INFO.homepage).toBe(packageJson.homepage ?? null);
  });

  it("publishes a non-empty semver-shaped version string", () => {
    expect(PLUGIN_INFO.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns the same frozen object via getPluginInfo", () => {
    const info = getPluginInfo();
    expect(info).toBe(PLUGIN_INFO);
    expect(Object.isFrozen(info)).toBe(true);
  });

  it("normalizes a missing homepage to null instead of undefined", () => {
    expect(PLUGIN_INFO.homepage === null || typeof PLUGIN_INFO.homepage === "string").toBe(true);
  });

  it("derives releaseStability from the package.json version", () => {
    expect(PLUGIN_INFO.releaseStability).toBe(classifyReleaseStability(packageJson.version));
    expect(["stable", "prerelease"]).toContain(PLUGIN_INFO.releaseStability);
  });
});

describe("classifyReleaseStability", () => {
  it("treats pre-1.0 (0.x.y) as prerelease", () => {
    expect(classifyReleaseStability("0.0.1")).toBe("prerelease");
    expect(classifyReleaseStability("0.9.0")).toBe("prerelease");
    expect(classifyReleaseStability("0.99.99")).toBe("prerelease");
  });

  it("treats any build with a prerelease tag as prerelease, regardless of major", () => {
    expect(classifyReleaseStability("1.0.0-beta.0")).toBe("prerelease");
    expect(classifyReleaseStability("2.0.0-rc.1")).toBe("prerelease");
    expect(classifyReleaseStability("1.2.3-local.0")).toBe("prerelease");
  });

  it("treats >=1.0.0 with no prerelease tag as stable", () => {
    expect(classifyReleaseStability("1.0.0")).toBe("stable");
    expect(classifyReleaseStability("1.2.3")).toBe("stable");
    expect(classifyReleaseStability("42.0.0")).toBe("stable");
  });

  it("falls back to prerelease for invalid/empty inputs (fail-safe)", () => {
    expect(classifyReleaseStability("")).toBe("prerelease");
    expect(classifyReleaseStability(" ")).toBe("prerelease");
    expect(classifyReleaseStability("not-a-semver")).toBe("prerelease");
  });
});
