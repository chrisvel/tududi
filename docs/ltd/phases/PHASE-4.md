# Phase 4 — Planning Domain

Base: `origin/main` at `587dd80bd7b2704465310668f2c6316869445861` (PR #4). Branch: `feat/T-401-planning`.

Scope follows PRODUCT_BLUEPRINT sections 13.3 (goals, metrics/check-ins, journal), 14.1–14.4 and T-401–T-407. G2 was read as feasibility evidence; its branch was neither merged nor pushed. ADR-005, ADR-006 and ADR-007 remain in force. Phase 5 was not started.

## Task status

| Task | Status | Delivered |
| --- | --- | --- |
| T-401 | Complete | Additive horizon/parent/period/achievement migration; service rules, owner serialization, cycle/depth/rank checks, existing task/project goal indexes and legacy upgrade assertions |
| T-402 | Complete | Owner-scoped metric CRUD, finite-value validation, check-ins/history and transactionally maintained current_value |
| T-403 | Complete | Computed duration-weighted A, metric-weighted O, child outcome roll-up, health, stalled and direct-goal-first whyChain; bounded five-second disposable snapshot cache and mutation/commit invalidation |
| T-404 | Complete | withJournal(actor, fn), before/after snapshots, individual/group Undo, reverted_at, conflict detection and all-or-nothing rollback |
| T-405 | Complete | Existing Goals page retained with a horizon tree; drag grip and keyboard-equivalent parent selector; separate A/O, undefined outcome copy, metric check-in/history, task breadcrumb with bdi, explicit achievement suggestion and Undo |
| T-406 | Complete | /plan/week priorities persisted as week goals, calendar-aware display, optional parent, editable week and a soft fourth-priority message |
| T-407 | Complete | Read-only goal tree/progress/vision/contribution tools sharing domain services; owner isolation and tested schemas; legacy MCP hard deletion tools unavailable in both transports |

## Acceptance evidence

| Criterion | Evidence |
| --- | --- |
| F02 | Six optional horizons; year → season accepted; reversed rank and cycles rejected; native browser drag and equivalent selector tested; Persian mobile tree has no horizontal overflow |
| F03 | Baseline 30/target 70/current 50 yields O=.5; increasing/decreasing metrics, history and check-in Undo tested; browser check-in also yields 50% |
| F04 | All linked work done with O=.4 yields A=1/O=.4 while status remains active; zero denominator and undefined outcomes are null; only a human status action sets achieved_at; suggestion gated by O>=1 or elapsed period |
| F05 | Same nearest-to-root whyChain used by task cards, REST and MCP, with direct task goal preceding project fallback and repeated nodes prevented |
| F11 | Fourth priority is saved as a week goal; soft message remains non-blocking in browser and component tests |
| F21 | Reparent/check-in and grouped changes revert atomically; current_value and hierarchy restored; no partial write survives failed Undo; actor comes from authentication |

## Verification

| Check | Result |
| --- | --- |
| Backend SQLite, full suite | 282 suites passed; 4095 tests passed, 8 existing skips; zero failures |
| Backend PostgreSQL, full suite | 282 suites passed; 3995 tests passed, 108 existing dialect skips; zero failures |
| Frontend, full suite | 128 suites / 920 tests passed; two added explicit achievement tests also passed with GoalModal regression tests |
| E2E, full runner | 53 Chromium tests passed, including Phase 4 hierarchy, drag, keyboard rejection, check-in/Undo, fourth priority and Persian mobile overflow |
| Phase 4 domain, SQLite and PostgreSQL | 5 suites / 75 tests passed on each engine |
| Progress coverage | Statements 99.14%, branches 95.43%, functions 98.38%, lines 99.34% |
| Journal coverage | Statements 99.27%, branches 96.77%, functions 100%, lines 100% |
| Upgrade and schema parity | 96 tests passed with PostgreSQL enabled: seven legacy SQLite fixtures plus actual old season/year PostgreSQL enum upgrade, repeated migration and SET NULL |
| Production PostgreSQL bootstrap | Empty bootstrap → pending migrations → repeat bootstrap passed |
| Lint/build | Passed; 12 pre-existing test-assertion lint warnings, zero errors |
| Graph update | AST-only graphify update completed: 11523 nodes and 29163 edges; generated graph remains ignored |
| Remote CI | Required gate on the PR head: test-sqlite, test-postgres, frontend-test and e2e; authoritative results remain in PR checks |

The dedicated `backend/jest.phase4.config.js` enforces at least 90% statements, branches, functions and lines for each of ltd-progress and ltd-journal in CI.

The first local full run inherited a SOCKS proxy and overlapped edits; those failures passed after proxy removal and stabilization. The first disposable PostgreSQL cluster used locale C, which fails an existing Cyrillic search expectation; a UTF-8 worker database resolves that environment mismatch. No unrelated application changes were made for these local conditions. Local PostgreSQL is 14.20; remote CI uses PostgreSQL 16.

## Boundaries and review

- No progress columns are stored; only metric current_value is persisted and journaled with each check-in.
- SQLite goals is never rebuilt; season/year values and season default are preserved. The additive migration refuses destructive down migration and requires backup restoration for rollback.
- REST uses existing API prefixes; `docs/ltd/phase4-api.yml` records the Phase 4 contract. Thin routes delegate to services/repositories.
- New MCP goal tools are read-only. Existing non-goal, non-deletion MCP tools remain upstream behavior; broader Proposal integration belongs to Phase 7. Neither transport exposes delete/remove tools.
- Life and Review remain the Phase 3 shells. No capacities, buffers, Focus sessions, Recovery, starter steps, Frames, Reviews, Milestones, Proposals, OAuth or Google Calendar were added.
- No stash was popped. No environment, deploy/data, brand assets or database files are included in the commit. No force push, upstream PR or merge was performed.
