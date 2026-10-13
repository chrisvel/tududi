# Phase 10 — Production readiness

Base: `origin/main` at `66c03e8080c04ec640d504dca9eb4ddaf9afcfad` (Merge pull request #12), fetched first; CI on that SHA passed ([run 38405946941](https://github.com/DanialMasghati/life-to-day/actions/runs/38405946941)). Branch: `feat/T-1001-readiness`. Source: PRODUCT_BLUEPRINT Phase 10 in section 24, the Phase 10 gate in 26.3, T-1001 to T-1004, and the Production-lite checklist in [PHASE-5.md](PHASE-5.md).

This phase is a report and the fixes for the holes it found. It is not v1.0, and no tag was created.

## Checklist

| Item | Status | Evidence |
| --- | --- | --- |
| T-1001 boundary review | GREEN | Findings below; one hole fixed with a red-then-green test |
| T-1001 kill switch ends every bearer token on `/api/mcp`, REST stays | GREEN | `backend/tests/ltd/mcp-kill-switch-oidc.test.js`: 2 of 3 failed on the base (`Expected: 401, Received: 200`), 3 of 3 pass after the fix; `mcp-capabilities.test.js` still passes |
| T-1002 axe, eight surfaces, fa and en | GREEN | `e2e/tests/axe-phase10.spec.ts`: no serious or critical finding outside the tududi baseline; red before the fixes, green after |
| T-1002 44 px targets in Focus and the bottom nav | GREEN | Same spec measures every button and link. The bottom nav's More button was 39–41 px wide; it and the links that share its classes now have a 44 px minimum |
| T-1002 `prefers-reduced-motion` in Focus | GREEN | Unchanged; still covered by `e2e/tests/ltd-pomodoro.spec.ts` (ring transition 1 s, then 0 s under `reduce`) |
| T-1002 Lighthouse, Today, production build | GREEN (measured once) | See Lighthouse below. No performance threshold was added |
| T-1002 PWA installable | GREEN | Chrome `Page.getInstallabilityErrors` returned `[]` on the production image; service worker active at scope `/` |
| WCAG 2.2 AA (26.3 gate) | BLOCKED | Automated axe (`wcag2a`, `wcag2aa`) covers only part of AA, and inherited tududi findings remain in the baseline. No manual keyboard or screen-reader audit was done. Dark mode is not in the gate |
| T-1003 runbooks (fa) | GREEN | `docs/ltd/runbooks/`: `restore-sqlite.md`, `rollback.md`, `google-disconnect.md`, `mcp-kill-switch.md`, `session-secret.md` |
| T-1003 user guide (fa) | GREEN | `docs/ltd/guide.md`: Today, goals, lessons, Focus, backup |
| T-1004 no rollback without a snapshot | GREEN | `deploy.sh` refuses to stop the app without a snapshot and never rolls back the image alone; `scripts/test-deploy.sh` fails 3 checks on the base `deploy.sh` and passes 16 of 16 on the branch, with a fake `docker` and no server. It runs in `backup-drill.yml` |
| T-1004 restore drill, CI | GREEN | Existing green run [38373381361](https://github.com/DanialMasghati/life-to-day/actions/runs/38373381361) on `6e5cc71b`: integrity ok, ready, `users=1 tasks=1` before and after, passed in 7 s |
| T-1004 restore drill, local | GREEN | Docker 29.8.2 on the owner's Mac, image `life-to-day:phase10` (`sha256:9b5092ca6d17`) built from this branch, synthetic data: online `.backup`, `integrity_check` ok, `restore-drill.sh` into an empty folder, ready, `users=1 tasks=2` before and after, passed in 8 s. The owner's running `life-to-day-app` and `data/` were not touched |
| Two successful drills (26.3) | GREEN | The CI drill and the local drill above. Neither ran on a production host |
| T-1004 branch protection on `main` | GREEN | Set through the API: force push and deletion off, PR required, 0 required reviews, admins included, required checks `test-sqlite`, `test-postgres`, `frontend-test`, `e2e`, `license`, `audit`, `image-scan` (all 20 recent CI runs green). The drill workflow is not required because it runs only on path changes |
| Trivy without HIGH (26.3) | GREEN when the PR's `image-scan` passes | No dependency or image change; no global ignore added |
| `npm audit` in CI | GREEN when the PR's `audit` job passes | `npm audit --omit=dev --audit-level=high`, unchanged |
| Restore on a real server | BLOCKED | No production host |
| TLS and HSTS on the real domain | BLOCKED | Caddy profile and HSTS exist; there is no domain |
| Uptime monitor and dead-man switch | BLOCKED | No URL supplied |
| 30 days of uptime ≥ 99% | BLOCKED | No production host |
| Live Google sync, live model call, claude.ai connection | BLOCKED | Not run against live services in this phase |
| Strong account passwords | Partial (unchanged) | 8-character minimum, no strength rule |
| Tags `v0.1.0` and `v1.0.0` | BLOCKED | Not created; the BLOCKED rows above are open |

## T-1001 — boundary review

Read first, then fixed only what was proven.

| Boundary | Result | Where |
| --- | --- | --- |
| Lesson delete, Proposal apply, reject and undo, Journal undo, goal delete, Focus writes, Google and MCP management are human-session only | Holds | Each guard requires `req.session.userId` and no `Authorization` header (`ltd-journal/actor.js`, `ltd-proposals/routes.js`, `ltd-lessons/service.js`, `goals/controller.js`, `ltd-focus/routes.js`, `ltd-gcal/routes.js`, `ltd-mcp-control/routes.js`). CSRF applies to every session write; CORS is an allowlist, so a page on another site cannot add the header |
| User A reaches user B's goal, lesson, Focus session, Proposal or Google token | Does not | Every lookup is scoped by `user_id`; a numeric `parent_goal_id` from B fails `validateGraph`; Focus checks the task with `ownershipOrPermissionWhere`. Existing IDOR tests cover each one (`ltd-lessons`, `ltd-pomodoro`, `mcp-capabilities`, `progress-api`, `gcal`) |
| Google refresh token and iCal secret address in API responses or logs | Absent | Both are encrypted at rest; `status()` and `serializeFeed()` return neither; Google errors keep status and reason only; fetch errors name the host only; request logs strip the query string and log no body |
| Calendar writes | Only `target_calendar_id` | `google.assertWritable` refuses `primary`, empty ids and any id other than the account's own calendar before a request is built; busy sync skips that calendar |
| MCP hard delete | None | `delete_*` and `remove_*` legacy tools are removed from both transports; the Capability Registry refuses any name with delete, remove, destroy or purge; no Proposal op destroys a row (`ltd-proposals` has no `destroy`) |
| Kill switch | **Hole, fixed** | See below |
| `LTD_OAUTH_ENABLED` in tests | Off by default | Only the OAuth contract helper sets it, in its own child process; the new test sets it to empty |

### Fixed: the kill switch missed sign-in provider tokens

With `OIDC_ENABLED=true` and the embedded OAuth server off, an access token from the sign-in provider authenticates on `/api/mcp`. `resolveClient` saw neither an API token nor an embedded-OAuth token and classed it as the browser session, which the kill switch never revokes. After the kill switch the same token still got `200` on `/api/mcp`.

Fix: `auth.js` keeps the token's `iat` on the request (`LTD-PATCH(T-1001)`, row in UPSTREAM.md). `resolveClient` now gives it its own kind, and the kill switch ends it when it was issued at or before the switch (a token without `iat` counts as older). It is not listed as a client, because it cannot be revoked one by one. REST is unchanged.

## T-1002 — accessibility

axe-core (`wcag2a`, `wcag2aa`, serious and critical) on Today, Plan, Goals, Life, Inbox, Focus, Proposals and Settings (general, MCP, calendars, planning) in en and fa, plus the mobile bottom nav and its More menu. The account has goals with a Vision, a lesson, a milestone, an Inbox item, a pending Proposal and a started day. fa showed the same findings as en.

Fixed (Life-to-Day code):

| Finding | Where | Fix |
| --- | --- | --- |
| `color-contrast` 4.39:1: `text-gray-500` on the grey-100 canvas | `GoalTree` hint and horizon labels, `LessonList` meta and empty state, `ProposalsPage` and `PlanningAssistant` intro, every secondary span in `ProposalCard` | `text-gray-600` (7.6:1), with `dark:text-gray-400` where it was missing |
| `select-name` | Calendar system select, `LocalePreferencesSection` | `htmlFor` and `id` |
| 44 px target | Bottom nav More button and links, `LtdNav` | `min-h-[44px] min-w-[44px]` |
| Dark `--ltd-primary` white text 3.68:1 (Lighthouse) | `tokens.css` | `#2563eb` (5.17:1); 3.43:1 against the dark canvas for the non-text ring and dots |

Baseline (already in tududi on the same page in en, checked against the fork base `a47c4113`): icon-only sidebar, task status and goal row menu buttons; dnd-kit rows that are `role="button"` and hold buttons; the Today plan progress bar without a name; the Inbox capture box without a label; the planning tab's colour-only link; grey secondary text on the canvas in the sidebar, version, Today date and quote, now-marker, Plan "free" line and hour labels, capture targets and "Recently captured". The baseline matches the element's markup, so the same rule on a Life-to-Day element still fails. Life-to-Day restyled the date, quote and now-marker without fixing their contrast; that stays open.

### Lighthouse

One run, Lighthouse 12.6.0, Chrome for Testing 153 headless, mobile form factor with simulated throttling. `/today` signed in on the production image `life-to-day:phase10` (before the dark-token fix), synthetic data.

| Category | Score |
| --- | --- |
| Performance | 88 |
| Accessibility | 77 |
| Best practices | 96 |
| SEO | 82 |

FCP 0.6 s, LCP 1.8 s, TBT 450 ms, CLS 0.059, Speed Index 1.0 s. The accessibility score comes from the inherited findings above, plus `meta-viewport` (`user-scalable=no` in `public/index.html`, from tududi) and `target-size` on tududi's task rows. Chrome rendered dark mode, which exposed the `--ltd-primary` contrast fixed above. Lighthouse 12 has no PWA category; installability was checked through Chrome instead. Its only manifest note is non-critical (`share_target` enctype).

## T-1003 — documents

Runbooks in Persian: restore from a SQLite backup without an old WAL beside it; rollback of image and the same snapshot together, never the image alone; Google disconnect and what a failed revoke means; the MCP kill switch; and the loss of `TUDUDI_SESSION_SECRET`, where sessions and every secret encrypted with it (iCal addresses, Google refresh token, AI keys, OIDC client secrets) cannot be recovered. The guide states that the in-app tududi backup does not contain goals, lessons, milestones, Focus sessions, the Journal or day plans; a full backup is the SQLite file.

## Verification

| Check | Result |
| --- | --- |
| New kill-switch test on the base code | 2 failed, 1 passed (`Expected: 401, Received: 200`) |
| Same test after the fix, with `mcp-capabilities`, `oauth-contract`, `oauth`, `auth-oidc-bearer`, `auth-edge-cases` | 6 suites, all passed |
| Backend SQLite, full suite | 295 suites: 294 passed, 4254 tests passed, 8 existing skips; one `socket hang up` in the untouched `subtasks.test.js` under parallel load, which passed 23 of 23 alone |
| Frontend suites for the touched components (GoalTree, Lessons, Proposals, Nav, Profile, AI and their neighbours) | 31 suites, 165 tests passed |
| E2E, one worker as in CI: `axe-f16`, `axe-phase10`, `ltd-lessons`, `ltd-life`, `ltd-nav`, `ltd-planning`, `ltd-pomodoro`, `ltd-today`, `rtl-f16` | 16 of 16 passed. With four local workers six timed out at sign-in; the same tests passed with one worker |
| `scripts/test-deploy.sh` | Base `deploy.sh`: 3 checks failed. Branch: 16 of 16 passed |
| Lint (eslint, both configs), prettier on the changed files, `tsc --noEmit` | Clean |
| PostgreSQL | Left to the PR's `test-postgres` job; no query or migration changed |

## Boundaries

No product feature was added and no dependency was added; Lighthouse ran once through `npx` and is not in `package.json`. No stash was popped. `.env`, tokens, JWKS, `data/` and databases are not staged. The production server was not touched; there is none. No public tunnel. No upstream pull request, no force push, no tag. No other phase was started.
