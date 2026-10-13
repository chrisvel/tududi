# Phase 11 — Task effect and life lessons

Base: `6e5cc71b` (latest fetched `origin/main`). The phase brief expected `3cb7f5be` (PR #10); `origin/main` had four later commits (fonts, Jalali names, beta badges, deploy layout), and CLAUDE.md says to start from the latest `origin/main`. Branch `feat/T-1101-lessons`.

Spec: blueprint 14.7, the `ltd_lessons`, `ltd_lesson_links` and `ltd_lesson_checks` rows of 13.3, ADR-014, Phase 11 in section 24, T-1101 to T-1104. Done means F45, F46 and the Phase 11 DoD. User and developer notes: [docs/27-task-effect-and-lessons.md](../../27-task-effect-and-lessons.md).

## Task status

| Task | Status | Delivered |
| --- | --- | --- |
| T-1101 | Complete | `backend/modules/ltd-progress/effect.js`: pure `taskEffect(task, snapshot, { lessons, today })`. It reads `chain()` and `O` from `projection.js`, stores nothing, and picks at most one lesson (4 own goal, 3 rest of the chain, 2 project, 1 area or shared tag; due review first, then newest). `projection.js` now names the `W` window check once and exposes `activity(task, goalId)` |
| T-1102 | Complete | Migration `20261016000001-ltd-lessons.js` (`safeCreateTable`, `down` refuses), three models, `backend/modules/ltd-lessons` (routes → service → repository). Every write, a review check included, is a Journal entry with Undo; delete is human-session only (token or MCP: 403); client `uid` and `Idempotency-Key` on create; a fourth active lesson on a goal is saved with `warning: "three_is_enough"`; one review question a day |
| T-1103 | Complete | Now and Focus: one path line and at most one lesson line after the first step; "More about this path" holds the outcome percent and the "why". Task page: "Long path" card. Goal page: linked lessons. Life tab: lessons under Vision and a lesson layer on the axis, off by default (`ui_settings.appearance.lifeLessonsOnAxis`). Today: one review question a day, and "Write a lesson" in the day review. fa and en; English placeholders in the other locales |
| T-1104 | Complete | `get_task_effect`, `list_lessons`, `get_lesson` (R0). Proposals exist (T-704), so `create_lesson` and `update_lesson` are R2: they only create a Proposal, applied in the app through the same service and Journal. No delete tool |

## Decisions

- **Path line without five-year or vision.** 14.7 defines the sentence only for a five-year goal, a vision, or no goal. A chain with neither uses the vision sentence with its farthest goal, so a task under a year goal still says where it leads.
- **`activity`.** True when finishing the task can move `A` of that goal: the task is in `W`, or it is a habit of a goal with a period (habits count in `A` too). It never says anything about `O`.
- **Area and tag scores.** The task's own area and its project's area score 1; a tag scores 1 when the task itself has it.
- **`park` writes a check.** The `verdict` enum of 13.3 includes `park`, so parking is recorded like the other two answers.
- **One review question a day.** `GET /lessons/due` returns nothing once any lesson was reviewed that day, so Today never asks twice.
- **Dangling links.** A link row has no foreign key (it points at one of four tables). A link whose goal, project, area or tag is gone is left out of every read, and Undo of a delete does not restore it.
- **Capability 6 of Phase 8 is unchanged.** The `why` feature keeps reading the whyChain; it was not switched to `taskEffect`, so no test was added for it. No new "human sentence" button.
- **Mixed direction.** User text inside a translated sentence sits in `<bdi>`, so an English goal keeps its order in a Persian sentence.

## Validation

- DoD (E2E `e2e/tests/ltd-lessons.spec.ts`): a task under a five-year goal with a metric shows the path on Now and on the task page and 40% outcome (behind "More" on Now); after the task is marked done the task page still shows 40%. A lesson written in the day review with an if/then and linked to that goal shows its line on the task, and not on an unrelated task. Today shows one review question, and none after it is answered. The Life tab lists the lesson and the axis layer starts off.
- `backend/tests/ltd/effect.test.js`, 13 tests: chain to `five_year` and `vision`; `meaning` fallbacks; the project's goal when the task has none; an unlinked task has no outcome, percent or lesson; finishing the task moves `A` from 0 to 1 while `O` stays 0.4; activity outside the period; scores 4 > 3 > 2 > 1; one lesson, due before newest; a lesson with no matching link never reaches the task; today from the user's timezone; habits.
- `backend/tests/integration/ltd-lessons.test.js`, 17 tests, on SQLite and PostgreSQL: user A cannot see, edit, review or delete B's lesson, nor link B's goal, project, area or tag (404, nothing saved); Jalali dates and years before 1600 rejected; an if without a then (or the reverse) is 400; the fourth active lesson on a goal is saved with `three_is_enough`; delete with an API token and as MCP is 403; human delete and Undo restore links and checks; `holds` +14, `not_yet` +7, `park` parks, each undoable newest first; create/update Undo; client uid and Idempotency-Key; one review question a day; the effect API keeps `O` after completion and a shared tag brings a lesson.
- `backend/tests/ltd/mcp-lessons.test.js`, 6 tests: closed schemas; no delete tool; `create_lesson` writes nothing until applied, then Journal with the proposal and Undo; `update_lesson` as a Proposal; user isolation for every lesson tool; typed validation errors with no proposal. `mcp-capabilities.test.js` lists the five tools.
- Upgrade: `ltd-postgres-lessons.test.js` (idempotent `up`, enum checks, unique link, cascades, `down` refuses) and the new legacy SQLite section. SQLite upgrade and schema parity: 130 passed. PostgreSQL upgrade and parity: 5 passed.
- Full backend on SQLite: 292 suites, 4,236 passed, 8 skipped, 1 failed: `people-unified` with `read ECONNRESET` under parallel load, 24/24 on its own. An earlier full run had the same kind of failure in `habits-in-task-lists`, 5/5 on its own.
- PostgreSQL 16 (Docker): the full run was stopped after 108 suites; on Docker for Mac each suite took about 40 s, and its only failures were 30 s hook timeouts while other jobs ran. A targeted run passed 22 suites, 301 tests: `tests/ltd`, `tests/integration/ltd-*`, goals, and the five suites that had timed out. CI runs the full PostgreSQL suite.
- Phase 4 coverage gate (now with the lessons integration test): 187 passed; `ltd-progress` 99.0% statements, 94.4% branches; `ltd-journal` 96.8% and 94.1%.
- Frontend: 974 tests, 968 passed, 6 failed: `CaptureHost`, four `QuickCaptureInput` suites and `MarkdownEditor.files`, all `fetch is not defined` in `i18n.ts`. `CaptureHost` and the four `QuickCaptureInput` suites fail the same way on an `origin/main` worktree here. The 10 new tests in `components/Lessons`, plus `TodayPage`, `NowCard`, `Proposals` and locale coverage, pass.
- E2E: the 3 new tests with `ltd-today` and `ltd-life`, 9 passed. A temporary run in English and Persian (not committed) clicked through Today, Focus, the task page, the Life tab, the form and the goal page: no console error or failed request came from this phase (only the existing 401 on `/api/profile` before login and 404 on `/api/billing`). It led to two fixes: the first step stays first on Now, and user text inside a sentence sits in `<bdi>`.
- Typecheck, lint (0 errors, the 12 existing warnings) and the production build pass.

## Findings outside scope

- **Life axis dates are one day early when the browser is ahead of the profile timezone.** `LifeTimeline/axis.ts` `isoToMs` builds browser-local midnight, while `formatDisplayDate` formats in the profile timezone. With the browser in Asia/Tehran and the profile in UTC, a milestone or goal on 13 October shows "October 12". Lesson cards on the axis inherit it. The lesson list itself formats at noon UTC and is right. Not changed here (Phase 6 code).
- **Five frontend suites fail locally on `origin/main` too** (`CaptureHost`, four `QuickCaptureInput` suites): the real `i18n.ts` calls `fetch`, which jsdom does not define. Unrelated to this phase.

## Explicit exclusions

Phase 10 was not started. No PR to `chrisvel/tududi`. No stash was popped; `.env`, `deploy/` and `*.sqlite3` are not included. The working tree also held someone else's uncommitted edit to `docs/ltd/PRODUCT_BLUEPRINT.md` (F47, a Phase 12 Pomodoro note); it is not part of this branch.
