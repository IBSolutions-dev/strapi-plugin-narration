# Roadmap

This file tracks **planned or desired work** that is not yet scheduled to a release. It is informal: ordering is approximate, items may be dropped or reshaped, and nothing here is a guarantee.

For **what actually shipped**, see [`CHANGELOG.md`](./CHANGELOG.md).

## How items get here

- Maintainer notes from issues and adoption feedback.
- Suggestions welcome via [GitHub Issues](https://github.com/IBSolutions-dev/strapi-plugin-narration/issues); small, well-scoped PRs aligned with [`CONTRIBUTING.md`](./CONTRIBUTING.md) are also welcome.

## Up next / high interest

Nothing committed here yet; see **Ideas & backlog**.

## Ideas & backlog

- **Usage prediction before generate** — Surface an estimate of cost or consumption (e.g. character counts aligned with provider billing, or a rough credit preview) in the entry editor and/or plugin home **before** running TTS, so authors can compare length vs quota. Depends on provider APIs and how Strapi exposes draft text; may start with client-side character count plus documented provider tariffs.

## Shipped / no longer on roadmap

_Move items here with a release link when they land in the CHANGELOG._

- **Configurable delimiter stripping for TTS** — [_Unreleased / see `CHANGELOG.md`_] CTB **strip delimiter pairs** (`stripDelimiterPairs`) remove regions between repeatable start/end substring pairs (e.g. `{{component:` … `}}`), in order — see [`shared/narration-field-options.ts`](./shared/narration-field-options.ts).
