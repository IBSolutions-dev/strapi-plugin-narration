import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/src/**/*.test.ts", "admin/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["server/src/**/*.ts", "shared/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        // Trivial barrel files Strapi requires by convention but that contain
        // no logic. Including them in coverage drags the % down without any
        // signal — the lifecycle map (`server/src/index.ts`) and routes
        // entry are exercised via dedicated tests, the rest are empty stubs.
        "server/src/content-types/index.ts",
        "server/src/controllers/index.ts",
        "server/src/middlewares/index.ts",
        "server/src/policies/index.ts",
        "server/src/routes/index.ts",
        "server/src/routes/content-api/index.ts",
        "server/src/services/index.ts",
      ],
      // Locked at the current measured floor so any regression below
      // today's coverage fails CI. The repository policy in CONTRIBUTING.md
      // requires *new* code to land with tests targeting 100%; these
      // numbers exist to prevent backsliding on the existing surface
      // (mainly defensive error branches in `services/elevenlabs.ts` and
      // the React-rendered admin code, which is intentionally outside
      // this coverage scope and tracked separately).
      thresholds: {
        lines: 93,
        branches: 80,
        functions: 100,
        statements: 93,
      },
    },
  },
});
