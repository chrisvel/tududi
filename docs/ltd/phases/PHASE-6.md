# Phase 6 — Unified Long-Term Timeline

Base: `origin/main` at `72f7989a52305587bd8459e87b041f218e9094d6` (PR #6). Branch: `feat/T-601-timeline`.

Scope follows PRODUCT_BLUEPRINT 5.3 (lifeGLANCE), the `ltd_milestones` row of 13.3, assumption A-11, Phase 6 in section 24, and T-601 and T-602. T-603 (GLANCE importer) was not built: the owner has no dayGLANCE or lifeGLANCE data. Phase 7 was not started.

## Task status

| Task | Status | Delivered |
| --- | --- | --- |
| T-601 | Complete | `ltd_milestones` exactly as in 13.3 via `safeCreateTable` (SQLite and PostgreSQL, no table rebuild); `backend/modules/ltd-milestones` with `GET /api/milestones?from&to`, `POST`, `PATCH /:uid`, `DELETE /:uid`. `date` is always an ISO Gregorian day; years before 1600 are refused so a Jalali string cannot pass as ISO. `goal_uid` must be the caller's own goal, otherwise 404 and nothing is saved. Every write is a Journal entry with Undo; delete is for human users only and API tokens (MCP) cannot delete |
| T-602 | Complete | `frontend/utils/timeline.ts` (PORT); `frontend/components/LifeTimeline/` in TSX and Tailwind; the Phase 3 Life tab (`/life`, route unchanged) now shows the Vision section and the timeline: layer 1 milestones above the axis, layer 2 goals with `target_date` or `period_end` below it, read from the goals list and never copied. A goal opens the existing Goal detail; a milestone opens its editor and only links to a goal when it has one. The Vision editor is the existing goal panel with `horizon = 'vision'` |
| T-603 | Not built | No importer, as instructed |

## What was ported

From lifeGLANCE `src/utils/timeline.js` at `cbc01c1acd818236bfbb9a952092978fa7261def`: `dateToX`, `getTickMarks`, `assignLanes`, `computePinchZoom` and the private helpers they call (`autoStyle`, `seededHash`, `VIEW_ANCHOR`, the pinch bounds), plus `safeLocale`/`sanitizeLanguageTag` from `src/utils/locale.js`, which `getTickMarks` needs. Changes are types only: `Date` subtraction is written with `getTime()`. Behavior was not changed. The upstream test file covers `applyRecurFilter` and `computePinchZoom`; the `computePinchZoom` suite (7 tests) was ported unchanged apart from vitest → Jest, and it passed without touching the port. `applyRecurFilter`, `getTimeRange*`, `xToMs`, `getMsPerPx` and the zoom-level table were not ported. `Timeline.jsx` and `TimelineView.jsx` were not copied. Attribution is at the top of both files and in `THIRD_PARTY_NOTICES.md` with the full MIT text.

## Decisions

- **Jalali display.** Card dates come from `formatDisplayDate` in `jalali.ts`. In the Jalali calendar the axis ticks sit on Jalali year, month and Saturday boundaries (`LifeTimeline/axis.ts`, using `jalaliToLocalDate` with a cache, and the same span thresholds as the port's `autoStyle`). In the Gregorian calendar the ported `getTickMarks` is used unchanged.
- **Precision is display-only.** A month or year milestone keeps the picked day. Truncating to the Gregorian first of the month would move a Jalali date such as 2 Aban into Mehr.
- **A-11.** The axis runs left to right by default, also in Persian. "Time runs right to left" mirrors positions and gestures and is saved in `ui_settings.appearance.lifeTimelineAxis` (the existing merged bag, so no users-service patch).
- **Dropped goals** are not drawn on layer 2.
- **Media.** Not built. Photos would need a new upload path, which was out of scope.
- **Chapters, recurring milestones, "On this day" and PNG export** were not built (Could, or not in scope).

## Desktop zoom performance

Production build (`NODE_ENV=production`), headless Chromium 1.63, Apple M4, 1000 milestones served to the page, one wheel event per frame for 3 seconds from decades in to weeks and back:

| Build | Average | p95 frame |
| --- | --- | --- |
| Production, test run alone | 57.2–57.6 fps (3 runs) | 16.8 ms (2 runs), 33.2 ms (1 run) |
| Dev server, inside the full E2E run | 51.8–55.1 fps | 33.3 ms |

The first dev measurement was 48 fps; building the date labels and positions once per data change (not on every frame) raised it. The DoD target of 60 fps is close but not reached on every frame (🟡). The E2E test asserts only a floor of 10 fps, because shared CI runners are slow.

## Verification

| Check | Result |
| --- | --- |
| Port tests (`frontend/utils/__tests__/timeline.test.ts`) | 12 passed: the 7 upstream `computePinchZoom` tests plus 5 Life-to-Day characterization tests for `dateToX`, `getTickMarks` and `assignLanes` |
| Component (`LifeTimeline.test.tsx`) | 6 passed: both layers and their click targets, `bdi`, layer toggle, decades → weeks range, RTL mirror, Jalali year labels |
| Integration (`ltd-milestones.test.js`) | 11 passed on SQLite and PostgreSQL 14: create and range list, precision, rejected Jalali/impossible dates, own goal link, foreign goal 404 on create and update, user A cannot list, edit or delete B's milestones, delete + Undo, Undo of create/update with the newer-edit conflict, restore unlinked after the goal is gone, non-human delete refused, 401 |
| Upgrade | SQLite legacy fixtures gain `ltd_milestones` with `user_id` CASCADE and `goal_id` SET NULL; PostgreSQL additive upgrade is idempotent, enums enforced, rows preserved, `goal_id` SET NULL and user CASCADE work, down refuses. Upgrade suite: 109 passed (SQLite), 112 passed (PostgreSQL enabled) |
| Phase 4 coverage gate | 86 passed, thresholds met (the milestones test joined the gate because the Journal gained the milestone Undo branch) |
| Backend SQLite, full suite | 285 suites, all green; 8 existing skips |
| Backend PostgreSQL 14, full suite | 285 suites, all green; 108 existing dialect skips |
| Frontend, full suite | 133 suites / 952 tests passed |
| E2E, Phase 6 (`ltd-life.spec.ts`) | 2 passed: Life tab with one milestone made in the editor and one dated goal; milestone click opens the editor and not a goal page; the goal opens Goal detail; no sideways page scroll at 1280 and 390 px; zoom frame rate with 1000 milestones |
| E2E, full runner | 59/59 on the second run. The first run had 2 failures in `inbox-task-project.spec.ts`, which passed 3/3 alone (the pre-existing flake noted in Phase 5) |
| Lint / typecheck / build | 0 errors (12 pre-existing warnings); `tsc --noEmit` and the production build pass |

Screenshots: [phase-6-shots/en-life-desktop.png](phase-6-shots/en-life-desktop.png), [phase-6-shots/fa-life-mobile.png](phase-6-shots/fa-life-mobile.png).

## Boundaries

- New code: `backend/modules/ltd-milestones`, `backend/models/ltd_milestone.js`, the migration, `frontend/components/LifeTimeline`, `frontend/utils/timeline.ts`, `frontend/utils/milestonesService.ts`. Core touch points carry `LTD-PATCH(T-60x)` and are listed in `docs/ltd/UPSTREAM.md`. Old migrations were not edited.
- The goal tree, capacity, Focus and Recovery were not changed.
- New strings are in en and fa; the other locales carry English so the key test stays green. User text is inside `<bdi>`, touch targets are at least 44 px, no physical direction classes, no new motion.
- With 1000 milestones in one view, cards overlap once the three lanes per layer are full; that is the ported lane assignment's behavior, and zooming in separates them.
- No MCP tool for milestones, no importer, no media pipeline, no upstream PR. No force push.
