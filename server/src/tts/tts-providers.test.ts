import { describe, expect, it } from "vitest";

import { PLUGIN_CONFIG_KEY } from "../plugin-metadata";
import {
  getAdminTabProviderIds,
  isTtsProviderId,
  listPublicTtsProviders,
  normalizeTtsProviderParam,
  resolveLiveTtsProvider,
} from "./tts-providers";

describe("tts-providers", () => {
  it("normalizeTtsProviderParam defaults to elevenlabs", () => {
    expect(normalizeTtsProviderParam(undefined)).toBe("elevenlabs");
    expect(normalizeTtsProviderParam("")).toBe("elevenlabs");
    expect(normalizeTtsProviderParam("  ")).toBe("elevenlabs");
    expect(normalizeTtsProviderParam("ElevenLabs")).toBe("elevenlabs");
  });

  it("resolveLiveTtsProvider accepts elevenlabs", () => {
    expect(resolveLiveTtsProvider("elevenlabs")).toEqual({
      ok: true,
      providerId: "elevenlabs",
    });
  });

  it("resolveLiveTtsProvider rejects openai until implemented", () => {
    expect(resolveLiveTtsProvider("openai")).toEqual({
      ok: false,
      reason: "not_live",
      providerId: "openai",
    });
  });

  it("resolveLiveTtsProvider rejects unknown ids", () => {
    expect(resolveLiveTtsProvider("acme")).toEqual({
      ok: false,
      reason: "unknown",
      providerId: "acme",
    });
  });

  it("isTtsProviderId is true for known ids", () => {
    expect(isTtsProviderId("elevenlabs")).toBe(true);
    expect(isTtsProviderId("openai")).toBe(true);
    expect(isTtsProviderId("foo")).toBe(false);
  });

  it("listPublicTtsProviders includes openai as coming_soon and not configured", () => {
    const strapi = {
      config: {
        get: () => undefined,
      },
      plugin: () => ({
        service: (name: string) =>
          name === "elevenlabs" ? { isApiKeyConfigured: () => true } : {},
      }),
    } as never;

    const list = listPublicTtsProviders(strapi);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: "elevenlabs",
      implementationStatus: "live",
      configured: true,
      showInAdminTab: true,
    });
    expect(list[1]).toMatchObject({
      id: "openai",
      implementationStatus: "coming_soon",
      configured: false,
      showInAdminTab: true,
    });
  });

  it("listPublicTtsProviders reflects missing ElevenLabs key", () => {
    const strapi = {
      config: {
        get: () => undefined,
      },
      plugin: () => ({
        service: (name: string) =>
          name === "elevenlabs" ? { isApiKeyConfigured: () => false } : {},
      }),
    } as never;

    const el = listPublicTtsProviders(strapi)[0];
    expect(el.configured).toBe(false);
  });

  it("getAdminTabProviderIds returns all providers when adminProviderTabs omitted", () => {
    const strapi = {
      config: { get: () => undefined },
    } as never;
    expect(getAdminTabProviderIds(strapi)).toEqual(["elevenlabs", "openai"]);
  });

  it("getAdminTabProviderIds returns all when adminProviderTabs is empty", () => {
    const strapi = {
      config: {
        get: (key: string) => (key === PLUGIN_CONFIG_KEY ? { adminProviderTabs: [] } : undefined),
      },
    } as never;
    expect(getAdminTabProviderIds(strapi)).toEqual(["elevenlabs", "openai"]);
  });

  it("getAdminTabProviderIds filters to configured allowlist", () => {
    const strapi = {
      config: {
        get: (key: string) =>
          key === PLUGIN_CONFIG_KEY ? { adminProviderTabs: ["elevenlabs"] } : undefined,
      },
    } as never;
    expect(getAdminTabProviderIds(strapi)).toEqual(["elevenlabs"]);
  });

  it("getAdminTabProviderIds ignores unknown entries and dedupes", () => {
    const strapi = {
      config: {
        get: (key: string) =>
          key === PLUGIN_CONFIG_KEY
            ? {
                adminProviderTabs: ["OpenAI", "openai", "acme", "elevenlabs"],
              }
            : undefined,
      },
    } as never;
    expect(getAdminTabProviderIds(strapi)).toEqual(["openai", "elevenlabs"]);
  });

  it("listPublicTtsProviders sets showInAdminTab false when filtered out", () => {
    const strapi = {
      config: {
        get: (key: string) =>
          key === PLUGIN_CONFIG_KEY ? { adminProviderTabs: ["openai"] } : undefined,
      },
      plugin: () => ({
        service: (name: string) =>
          name === "elevenlabs" ? { isApiKeyConfigured: () => true } : {},
      }),
    } as never;

    const list = listPublicTtsProviders(strapi);
    expect(list.find((p) => p.id === "elevenlabs")?.showInAdminTab).toBe(false);
    expect(list.find((p) => p.id === "openai")?.showInAdminTab).toBe(true);
  });
});
