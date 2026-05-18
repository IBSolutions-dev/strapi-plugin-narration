# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the project is on the `0.x` series it is considered **beta**: the public
surface (admin endpoints, RBAC scopes, custom-field stored shape, plugin config
keys) MAY change between `0.x` minors with a CHANGELOG migration note. The API is
frozen on the first stable **`1.0.0`** release.

## Unreleased

Changes after **`0.10.3`** will be recorded here until the next dated release.

## 0.10.3 - 2026-05-18

Documentation fix for Strapi Marketplace README header image.

- **Docs**: Updated **`logo-readme.png`** (wide header artwork) so the Marketplace store page shows a crisp logo when the renderer stretches README images to full column width; GitHub still uses `width="120"` on the same asset.

## 0.10.2 - 2026-05-18

Documentation fix for Strapi Marketplace README rendering.

- **Docs**: README header uses **`logo-readme.png`** (240×240) so Marketplace and other renderers that ignore `width` on `<img>` show a small logo instead of full-width **`logo.png`** (1254×1254).

## 0.10.1 - 2026-05-18

Documentation fix for Strapi Marketplace and other README consumers that render copy off-repo.

- **Docs**: README images use `raw.githubusercontent.com/.../main/.github/assets/...`; repository doc links use absolute `github.com/.../blob/main/...` URLs so the Marketplace store page (generated from README) loads screenshots and cross-links correctly. GitHub README rendering is unchanged.
- **Docs**: README footer CTA (“Want help with Strapi…”) linking to [IB Solutions contact](https://ibsolutions.dev/contact).
- **Maintenance**: **`audit-ci`** allowlist extended for **sanitize-html** advisory **GHSA-rpr9-rxv7-x643** on the `@strapi/admin` / `@strapi/content-manager` dev dependency chain so **`npm run audit:full`** stays green after npm advisory refreshes.

## 0.10.0 - 2026-05-11

Documentation, maintainer tooling, CI alignment, and audit-policy housekeeping for the **`0.x`** beta line.

- **Docs**: README refresh — clearer positioning copy; tighter **Requirements** table;
  condensed **Install** (ElevenLabs key scopes for **Text to Speech** and **Voices → Read**,
  pinned **`0.x`** guidance, `plugins.ts` / `plugins.js` note); cross-links adjusted for advanced config.
- **Repo**: GitHub logo **`logo.png`** updated; redundant **`logo.svg`** removed.
- **Maintenance**: `.gitignore` — ignore **`.cursor/`** for local Cursor IDE metadata.
- **Maintainers**: **`npm run release:preflight`** (**[`scripts/release-preflight.sh`](./scripts/release-preflight.sh)**) runs CI-aligned gates locally; **`scripts/verify-npm-pack.py`** shares tarball asserts with GitHub Actions.
- **Maintenance**: **`audit-ci`** allowlist extended for transitive **fast-uri** advisories (**GHSA-q3j6-qgpj-74h6**, **GHSA-v39h-62p7-jpjc**) on the Strapi → **ajv** dev dependency chain so **`npm run audit:full`** stays green after npm advisory refreshes.

## 0.9.0 - 2026-05-07 — Public Beta

**First public release** on npm for Strapi **5**: a **Narration** custom field that
generates MP3 into the Media Library with live **ElevenLabs** TTS (the **OpenAI** path
in admin is not generating audio yet). This `0.x` line collects feedback before the
API and field shape are frozen at **`1.0.0`**.

- Ordered **narration sources** (plain text or blocks-aware), **`voiceId`** +
  **`audioFileId`** persisted on the field JSON.
- **ElevenLabs**: list voices, TTS (MP3), optional static voice catalog, HTTPS proxy,
  opt-in **`ELEVENLABS_DNS_IPV4_FIRST`**, configurable **dry-run** for staging.
- **Content-Type Builder**: **`defaultVoiceId`** required before save; blocks allowlist;
  **strip delimiter pairs** around regions dropped from TTS; **pause between sources**
  (0–3s, SSML `<break>`, model-dependent).
- **Content Manager**: generate, play back, detach, manual media attach; sane defaults
  when entry JSON omits a voice (**Disconnect** preserves CTB default when nothing was stored).
- **Plugin home**: connection health, narration test, per-provider **Usage** links (e.g.
  [ElevenLabs](https://elevenlabs.io/app/developers/analytics/usage),
  [OpenAI](https://platform.openai.com/usage)); footer shows version and Beta from
  **`GET /narration/plugin-info`**.
- **Authenticated admin API** for providers, voices, config/status, test TTS, and
  generation, with **RBAC** per action.
- Duplicate-generation guard (with stale recovery), correlated telemetry with redacted
  secrets, and **`destroy()`** cleanup on reload/shutdown.
- **Peers** from the host app: **`@strapi/design-system`**, **`@strapi/icons`**,
  **`react-intl`**, **`yup`** (avoids duplicate React / broken Content Manager context).
- **Docs**: README with install, settings and entry screenshots, Draft & Publish
  reminder (**Publish** after generate for public API/frontends), and a REST sample
  linking **`audioFileId`** to **`/api/upload/files/:id`**.
