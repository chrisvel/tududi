# Phase 5 — Daily Execution and ADHD-Friendly UX

Base: `origin/main` at `8da2c61f34559738f79a6cf82f93f51afbb67875` (PR #5). Branch: `feat/T-501-today`.

Scope follows PRODUCT_BLUEPRINT 3.4 (P1–P13), 3.5, 14.4 (contribution report only), 14.5, 21.5, 22.1, F09, F10, F12–F15, Phase 5 in section 24, the Production-lite item of Phase 10, and T-501–T-506 and T-510. ADR-006 holds: capacity and load are deterministic and no LLM decides anything. T-507, T-508 and T-509 (Frames, energy, weekly review, `original_plan`/deferrals) were not built. Phase 6 was not started.

## Task status

| Task | Status | Delivered |
| --- | --- | --- |
| T-501 | Complete; buffer is advisory | `backend/modules/ltd-planner/capacity.js` (pure): window (work hours, default 09:00–17:00, configurable), busy from the existing iCal feeds only, 5 minutes × open blocks, capacity, load, f, 0.85 warning with lowest-priority move suggestions, Recovery capacity, event-overlap and missing-buffer notes. Nothing derived is stored. Capacity bar on Today and the planner. `daily-plan` is unchanged |
| T-502 | Complete | `ltd_focus_sessions` (13.3) via `safeCreateTable`; full-screen single-task FocusMode; the existing Pomodoro was extended to a shared timestamp clock (`pomodoroClock.ts`) used by both, so there is still one timer; interrupt with "Where was I?", Continue reopens the same task and note |
| T-503 | Complete | Nullable `tasks.starter_step` (only this column; no `energy`); Now card shows it first or "Just start for 5 minutes"; field on the task page |
| T-504 | Complete | "Lighten my day" keeps ≤ 3 short open tasks within 0.6 × the rest of the working day and moves the rest to tomorrow in one Journal entry; Undo is the existing toast reverting that entry. Heavy-day banner from 14:00 with nothing done. Overwhelmed shows only the Now card and mutes push until switched off or the local day ends |
| T-505 | Complete | `C` opens the existing capture box on the Inbox outside input/textarea/contenteditable (offline queue and Undo are the capture box's own); "Today helped these goals" from the existing whyChain and done minutes, unaligned work shown as normal |
| T-506 | Complete | The existing `/welcome` page became the three skippable steps: fa/Jalali/Persian digits; one season goal with optional Vision and three suggested Areas when none exist; work hours and one task, then the Now card. No PWA or notification prompt |
| T-510 | **BLOCKED** | See Production-lite below. Tag `v0.1.0` was not created |

## Acceptance evidence

| Criterion | Evidence |
| --- | --- |
| F09 | `C` opens the capture box on the Inbox; ignored in input, textarea and contenteditable (LtdNav tests). Offline queue and Undo are the unchanged Phase 3 capture path |
| F10 | Busy events and buffers are part of capacity; blocks overlapping an iCal busy event and neighbours closer than 5 minutes are flagged; with no feed nothing is flagged. The 5-minute gap is a warning, not enforced when dragging on the 15-minute DayTimeline grid |
| F12 | 4 h capacity with 5 h of tasks × 1.3: load 1.63, warning shown and the lower-priority task suggested (unit and integration tests; E2E sees the warning) |
| F13 | Interrupt at minute 12 saves `interrupted = true`, `actual_minutes = 12` and the note; Continue opens the same task and note (integration test with injected clock, component test with fake timers, E2E) |
| F14 | Lighten moves open work to tomorrow through the Journal, keeps at most three, copy without blame; Undo restores both days exactly and is refused after newer edits; Overwhelmed shows only Now and sends no push (integration + E2E) |
| F15 | Starter step shown first; empty suggests a five-minute start (component + E2E) |
| 21.5 / 22.2 | E2E walks the three steps from first sign-in to the Now card; the assertion is < 180 s and the test timeout is 150 s; it runs in about 3 s, with no sleeps |

## Verification

| Check | Result |
| --- | --- |
| Capacity unit (`tests/unit/modules/ltd-planner/capacity.test.js`) | 17 passed: default window, buffers, overlapping/clipped events, all-day and free events, window ending at midnight, f = 1.3 at 29 sessions and the median from 30, latest-30 only, clamp, 0.85 boundary, zero capacity, Recovery 60%, buffer and iCal-overlap warnings |
| Phase 5 integration (`ltd-today-execution.test.js`) | 12 passed on SQLite and PostgreSQL |
| Fake-clock timer (`FocusMode.test.tsx`) | Passed: 12 minutes in a frozen background tab shows 13:00 on `visibilitychange`, no interval needed |
| Backend SQLite, full suite | 284 suites, 4123 passed, 8 existing skips, 0 failures |
| Backend PostgreSQL 14 (local, UTF-8), full suite | 283/284 suites; one `socket hang up` in the untouched `comments.test.js` under 4 workers, which then passed 26/26 three times alone. 108 existing dialect skips |
| Upgrade and schema parity (PostgreSQL enabled) | 104 passed: legacy SQLite fixtures gain `starter_step` and `ltd_focus_sessions` with FKs and unchanged task counts; PostgreSQL additive upgrade idempotent, rows preserved, `task_id` SET NULL; down refuses |
| Phase 4 coverage gate | 75 passed; thresholds met |
| Frontend, full suite | 131 suites / 934 tests passed after the TaskDetails mock gained the new card |
| E2E, Phase 5 (`ltd-today.spec.ts`) | 4 passed: first run → Now, Lighten + Undo, Overwhelmed, Focus interrupt/Continue + axe on Focus, Recovery, capacity and Now regions (no serious/critical) |
| E2E, full runner | 57/57 on two of three local runs; the third had one failure in `inbox-task-project.spec.ts`, which also failed on a clean-main worktree run (pre-existing flake) |
| Lint / typecheck / build | 0 errors (12 pre-existing warnings); `tsc --noEmit` and the production build pass |

## Fixes found while testing

- **SQLITE_BUSY under concurrent writers.** SQLite ignores `SELECT … FOR UPDATE`, so a deferred transaction that reads before it writes (`withJournal`, the onboarding starter) can deadlock with another writer and fail at once; `busy_timeout` does not cover lock upgrades. SQLite connections now start transactions `IMMEDIATE` (`backend/config/db.js`, LTD-PATCH(T-504)); PostgreSQL is unaffected.
- **Nav E2E race.** `ltd-nav.spec.ts` opened the mobile More menu before Layout's first store loads finished; Layout then swapped in its loader and remounted the nav. The test now waits for Today first.

## Production-lite (Phase 10, T-510)

| Item | Status | Evidence |
| --- | --- | --- |
| Restore drill | GREEN local; BLOCKED on a real server | Phase 2 empty-folder recovery in 9 s; weekly synthetic `backup-drill.yml`. No production host |
| TLS and HSTS | BLOCKED | HSTS (1 year, includeSubDomains, preload) is on in production in `app.js`; Caddy profile exists. No public hostname, so no certificate |
| Rate limit | GREEN | Existing login, signup, sign-in-link and API limiters |
| Strong passwords | Partial | Deploy secrets come from `openssl rand` (Phase 2); account passwords have an 8-character minimum and no strength rule |
| `npm audit` in CI | GREEN when the PR's `audit` job passes | `npm audit --omit=dev --audit-level=high` |
| axe smoke | GREEN | F16 axe (five pages, fa/en) plus the Phase 5 regions above |
| Healthcheck and monitor | Healthcheck GREEN; monitor BLOCKED | `HEALTHCHECK` + `/api/health/ready`; no dead-man or uptime URL supplied |

T-510 stays BLOCKED, so `v0.1.0` was not tagged.

## Boundaries

- **Seven days of real use: BLOCKED.** This item belongs to the owner and is not marked GREEN.
- `ltd-planner`, `ltd-focus`, `FocusMode` and `Recovery` are new; core touch points carry `LTD-PATCH(T-50x)` and are listed in `docs/ltd/UPSTREAM.md`. The old migrations were not edited.
- Overwhelmed mutes push; in-app notifications are still recorded and visible in the bell.
- Recovery moves to tomorrow's plan; the 3.5 `deferrals` history is a Should (T-509) and was not built.
- New strings are in en and fa; the other locales carry English so the key test stays green. User text is inside `<bdi>`, touch targets are at least 44 px, no physical direction classes, no new motion.
- No Google Calendar API, OAuth, Proposal, AI, timeline, Frames, energy, weekly review or `original_plan`. No upstream PR. No force push.
