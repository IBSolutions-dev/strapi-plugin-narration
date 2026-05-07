import { describe, expect, it } from "vitest";

import { NARRATION_ADMIN_ACTIONS, toAdminScope } from "../../narration-admin-actions";
import routes from "./index";

type AdminRoute = (typeof routes)["routes"][number];

function findRouteForAction(
  action: (typeof NARRATION_ADMIN_ACTIONS)[number]
): AdminRoute | undefined {
  return routes.routes.find(
    (r) =>
      r.method === action.route.method &&
      r.path === action.route.path &&
      r.handler === action.route.handler
  );
}

describe("admin routes are scope-bound to registered narration actions", () => {
  it("binds every narration action to a route with matching auth.scope", () => {
    const missing: Array<{ uid: string; reason: string }> = [];

    for (const action of NARRATION_ADMIN_ACTIONS) {
      const route = findRouteForAction(action);
      if (!route) {
        missing.push({ uid: action.uid, reason: "route_missing" });
        continue;
      }
      const scope = toAdminScope(action.uid);
      const configured = route.config?.auth?.scope ?? [];
      if (!Array.isArray(configured) || !configured.includes(scope)) {
        missing.push({ uid: action.uid, reason: `scope_missing:${scope}` });
      }
    }

    expect(missing).toEqual([]);
  });
});
