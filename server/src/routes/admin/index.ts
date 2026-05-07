import { NARRATION_ADMIN_ACTIONS, toAdminScope } from "../../narration-admin-actions";

/**
 * Admin routes derived from the {@link NARRATION_ADMIN_ACTIONS} SSOT.
 * Every route is bound to its corresponding RBAC scope; this guarantees
 * `bootstrap.ts` (registers actions) and this file (binds routes) cannot drift.
 */
export default {
  type: "admin" as const,
  routes: NARRATION_ADMIN_ACTIONS.map((action) => ({
    ...action.route,
    config: {
      policies: ["admin::isAuthenticatedAdmin"],
      auth: { scope: [toAdminScope(action.uid)] },
    },
  })),
};
