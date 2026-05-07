import { describe, expect, it } from "vitest";

import plugin from "./index";

describe("plugin server entrypoint", () => {
  it("exports the lifecycle hooks expected by Strapi", () => {
    expect(plugin.register).toBeTypeOf("function");
    expect(plugin.bootstrap).toBeTypeOf("function");
    expect(plugin.destroy).toBeTypeOf("function");
  });

  it("exports config / controllers / routes / services / contentTypes / policies / middlewares maps", () => {
    expect(plugin.config).toMatchObject({
      default: expect.any(Object),
      validator: expect.any(Function),
    });
    expect(plugin.controllers).toBeDefined();
    expect(plugin.routes).toMatchObject({
      admin: expect.any(Object),
      "content-api": expect.any(Object),
    });
    expect(plugin.services).toBeDefined();
    expect(plugin.contentTypes).toBeDefined();
    expect(plugin.policies).toBeDefined();
    expect(plugin.middlewares).toBeDefined();
  });
});
