#!/usr/bin/env bash
# Release gates aligned with `.github/workflows/ci.yml` (install → audits →
# format/lint/typecheck/tests → build → verify → npm pack assertions).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() {
  printf '\n==> %s\n' "$*"
}

step "npm ci"
npm ci

step "npm run audit:prod"
npm run audit:prod

step "npm run audit:full"
npm run audit:full

step "npm run format:check"
npm run format:check

step "npm run lint"
npm run lint

step "npm run typecheck"
npm run typecheck

step "npm run test:coverage"
npm run test:coverage

step "npm run build"
npm run build

step "npm run verify"
npm run verify

step "npm pack (clean prior plugin tarballs in repo root)"
rm -f strapi-plugin-narration-*.tgz
npm pack --silent

step "verify npm pack contents (scripts/verify-npm-pack.py)"
python3 scripts/verify-npm-pack.py

step "remove packed tarball"
rm -f strapi-plugin-narration-*.tgz

printf '\nrelease-preflight: OK\n'
