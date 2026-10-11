# Third-Party Notices

Life-to-Day includes third-party code. This file lists only code that is actually in this repository's tree.

## Base: tududi

Life-to-Day is a fork of tududi.

- Project: tududi, https://github.com/chrisvel/tududi
- License: MIT (see [LICENSE](LICENSE), "Copyright 2024, 2025 Tududi Developers")
- Base commit in this tree: `a47c41135e996da5ad3258731c499528bba8c89a`
- Latest `upstream/main` checked: `f270f38f6247b6c462ba3b10de73e7dd9e6e6ff7` (v1.9.1, 2026-10-11), not yet merged

Sync history and core patches: [docs/ltd/UPSTREAM.md](docs/ltd/UPSTREAM.md).

## Ported code (PORT)

None yet. No code from dayGLANCE or lifeGLANCE is in `main`.

Each future PORT adds an attribution header to the ported file and an entry here (source project, URL, commit SHA, license, files).

## npm dependencies

npm packages keep their own licenses in `node_modules/*/LICENSE`. CI runs `license-checker` on production dependencies and fails on AGPL or SSPL.
