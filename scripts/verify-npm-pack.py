#!/usr/bin/env python3
"""Verify npm pack tarball contents.

Assertions mirror `.github/workflows/ci.yml` / `release.yml` so local preflight
and CI stay aligned.
"""

from __future__ import annotations

import glob
import sys
import tarfile


def main() -> int:
    packs = sorted(glob.glob("strapi-plugin-narration-*.tgz"))
    if not packs:
        print("error: no strapi-plugin-narration-*.tgz produced", file=sys.stderr)
        return 1

    path = packs[-1]
    print(f"Tarball: {path}")

    with tarfile.open(path, "r:gz") as tf:
        names = [m.name for m in tf.getmembers() if m.isfile()]

    forbidden = [n for n in names if ".test." in n or n.endswith(".spec.ts")]
    if forbidden:
        print(f"tests in pack: {forbidden}", file=sys.stderr)
        return 1

    required = {
        "package/package.json",
        "package/README.md",
        "package/LICENSE",
    }
    missing = required - set(names)
    if missing:
        print(f"missing: {missing}", file=sys.stderr)
        return 1

    dist_files = [n for n in names if n.startswith("package/dist/")]
    if not dist_files:
        print("error: no package/dist/ in tarball", file=sys.stderr)
        return 1

    # Stale-build guard: dist/_chunks/ is from an older @strapi/sdk-plugin output
    # convention. The current build emits to dist/admin/ and dist/server/ only.
    stale_chunks = [n for n in names if n.startswith("package/dist/_chunks/")]
    if stale_chunks:
        print(
            f"stale dist/_chunks/* in pack ({len(stale_chunks)} files); "
            "prebuild clean step is broken",
            file=sys.stderr,
        )
        return 1

    print(f"Packed files: {len(names)}")
    print("npm pack OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
