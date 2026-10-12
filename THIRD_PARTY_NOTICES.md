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

Each PORT has an attribution header in the ported file and an entry here (source project, URL, commit SHA, license, files). No dayGLANCE code is in the tree.

### lifeGLANCE: timeline scale (T-602)

- Project: lifeGLANCE, https://github.com/krelltunez/lifeGLANCE
- License: MIT, "Copyright (c) 2026 krelltunez" (full text below)
- Commit: `cbc01c1acd818236bfbb9a952092978fa7261def`
- Source paths: `src/utils/timeline.js` (`dateToX`, `getTickMarks`, `assignLanes`, `computePinchZoom` and the private helpers they call), `src/utils/locale.js` (`safeLocale`, `sanitizeLanguageTag`, used by `getTickMarks`), `src/utils/timeline.test.js` (the `computePinchZoom` suite)
- Files in this tree: `frontend/utils/timeline.ts`, `frontend/utils/__tests__/timeline.test.ts`
- Changes: TypeScript types; `Date` subtraction written with `getTime()`; vitest imports replaced by Jest globals. Behavior is unchanged. `Timeline.jsx` and `TimelineView.jsx` were not copied; `frontend/components/LifeTimeline/` is new code.

```text
MIT License

Copyright (c) 2026 krelltunez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## npm dependencies

npm packages keep their own licenses in `node_modules/*/LICENSE`. CI runs `license-checker` on production dependencies and fails on AGPL or SSPL.
