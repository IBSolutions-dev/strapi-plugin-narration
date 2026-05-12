# Contributing

Thanks for your interest in improving **strapi-plugin-narration**.

## Development setup

Prereqs:

- Node.js `>=20.0.0 <=24.x.x` (matches Strapi 5)
- npm

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
```

Maintainers cutting a release should also run the CI-aligned gate (runs **`npm ci`**, production + full-tree audits, the checks above, **`build`**, **`verify`**, **`npm pack`**, then tarball asserts):

```bash
npm run release:preflight
```

Implementation: **[`scripts/release-preflight.sh`](./scripts/release-preflight.sh)** and **[`scripts/verify-npm-pack.py`](./scripts/verify-npm-pack.py)** (same npm-pack assertions as **[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)**).

Build the plugin (admin + server bundles):

```bash
npm run build
```

## Testing the plugin in a Strapi app

For UI or end-to-end changes, test the plugin in a Strapi 5 app before opening
a PR:

```bash
cd /path/to/strapi-plugin-narration
npm run watch

cd /path/to/strapi-app
npm install file:../strapi-plugin-narration
npm run build
npm run develop
```

Do not commit a `file:` dependency in the consuming Strapi app.

## Pull requests

- Keep PRs focused and small when possible.
- Include tests for any behavior change.
- Do not include secrets (API keys, tokens) in code, commits, or screenshots.
- Ensure `npm run format:check`, `npm run lint`, `npm run typecheck`, and
  `npm run test:coverage` all pass.

## Coverage policy

The project's standing goal is **100% test coverage**. Two practical rules
flow from that:

1. **New code must land with tests targeting 100% line + branch coverage on
   the file(s) it adds or substantively changes.** Reviewers will block PRs
   that ship uncovered logic in admin/billing/auth/error-handling paths
   without an explicit, documented exception.
2. **The vitest thresholds in [`vitest.config.ts`](./vitest.config.ts) are a
   floor**, not the goal. They are pinned at the current measured floor so
   any regression below today's coverage fails CI. They must only ever move
   _up_.

Coverage scope today:

- `server/src/**/*.ts` and `shared/**/*.ts` are measured.
- `admin/src/**` (React components, hooks, CTB form fields) is not yet
  measured. This is tracked debt; the planned remediation is to add a
  `jsdom` environment to vitest and contribute tests for
  `NarrationFieldInput.tsx`, `HomePage.tsx`, and the CTB form components.
  Until then, treat any admin change as requiring a hand-driven smoke test
  in a real Strapi 5 app — describe what you tested in the PR body.

Always add tests for every behavior change — especially for admin API
behavior, billing-related generation flows, and security-sensitive code
paths.

## Reporting security issues

Please **do not** open a public issue for security bugs.

Use GitHub **Security Advisories** for private disclosure (preferred):

- Go to the repo → **Security** → **Advisories** → **Report a vulnerability**.
