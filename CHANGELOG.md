# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the project is on the `0.x` series it is considered **beta**: the public
surface (admin endpoints, RBAC scopes, custom-field stored shape, plugin config
keys) MAY change between `0.x` minors with a CHANGELOG migration note. The API is
frozen on the first stable **`1.0.0`** release.

## Unreleased

Changes after **`0.9.0`** will be recorded here.

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
