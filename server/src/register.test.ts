import type { Core } from "@strapi/strapi";
import { describe, expect, it, vi } from "vitest";

import register from "./register";

describe("register()", () => {
  it("registers the narration custom field with the json type under the plugin id", () => {
    const customFields = { register: vi.fn() };
    const strapi = { customFields } as unknown as Core.Strapi;
    register({ strapi });
    expect(customFields.register).toHaveBeenCalledTimes(1);
    expect(customFields.register).toHaveBeenCalledWith({
      name: "narration",
      plugin: "narration",
      type: "json",
    });
  });
});
