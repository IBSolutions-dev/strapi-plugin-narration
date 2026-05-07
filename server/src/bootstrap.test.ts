import dns from "node:dns";
import type { Core } from "@strapi/strapi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import bootstrap from "./bootstrap";
import { NARRATION_ADMIN_ACTIONS } from "./narration-admin-actions";
import { STRAPI_PLUGIN_ID } from "./plugin-metadata";

/**
 * Bootstrap calls `applyElevenLabsOutboundDnsDefaults`, which can mutate the
 * Node-wide DNS result order if the opt-in env is set. Tests must always mock
 * `dns.setDefaultResultOrder` to keep the host process pure.
 */
const dnsSpy = vi.spyOn(dns, "setDefaultResultOrder");

beforeEach(() => {
  dnsSpy.mockImplementation(() => undefined);
});

afterEach(() => {
  dnsSpy.mockReset();
});

describe("bootstrap", () => {
  it("registers narration admin permission actions once", async () => {
    const registerMany = vi.fn().mockResolvedValue(undefined);
    const has = vi.fn().mockReturnValue(false);
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      config: {
        get: vi.fn(() => undefined),
      },
      service: vi.fn((name: string) => {
        if (name === "admin::permission") {
          return { actionProvider: { has, registerMany } };
        }
        return {};
      }),
    } as unknown as Core.Strapi;

    await bootstrap({ strapi });

    expect(registerMany).toHaveBeenCalledTimes(1);
    const actions = registerMany.mock.calls[0][0] as Array<{
      uid: string;
      pluginName: string;
    }>;
    expect(actions).toHaveLength(NARRATION_ADMIN_ACTIONS.length);
    expect(actions.map((a) => a.uid)).toEqual(NARRATION_ADMIN_ACTIONS.map((a) => a.uid));
    expect(actions.every((a) => a.pluginName === STRAPI_PLUGIN_ID)).toBe(true);
  });

  it("skips registerMany when actions already exist", async () => {
    const registerMany = vi.fn().mockResolvedValue(undefined);
    const has = vi.fn().mockReturnValue(true);
    const strapi = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      config: {
        get: vi.fn(() => undefined),
      },
      service: vi.fn(() => ({
        actionProvider: { has, registerMany },
      })),
    } as unknown as Core.Strapi;

    await bootstrap({ strapi });

    expect(registerMany).not.toHaveBeenCalled();
  });
});
