# Phase 7 — Remote MCP (OAuth), Capability Registry and Proposals

Base: `origin/main` at `5a99f38868d55421880df233e9fa2be0a767cf1d` (two i18n fixes after PR #7 `3aa1e2bf`; the owner chose to keep them). Branch: `feat/T-701-mcp-oauth`.

Scope follows PRODUCT_BLUEPRINT 16.3, 17.1 to 17.6, ADR-008, Phase 7 in section 24 and T-701 to T-707. The G4 spike (`docs/ltd/spikes/G4.md`, branch `spike/g4`) was read, not merged or cherry-picked; its four findings were rebuilt on this code. The MCP SDK stays on 1.x (17.5). Phase 8 was not started: no LLM, no `ltd-llm`, no `decompose_goal` or `generate_weekly_review`. Phase 9 was not started: no `propose_calendar_changes`, no Google API. better-auth and Pomerium were not built. The app's own SSO login was not changed.

## Task status

| Task | Status | Delivered |
| --- | --- | --- |
| T-701 | Complete | `backend/modules/ltd-oauth`: `oidc-provider` 9.12.2 (exact; ESM loaded with `import()`), a Sequelize adapter on `ltd_oauth_models`, an RS256 key created once in `LTD_OAUTH_JWKS_FILE` (default next to the database; git-ignored), cookie keys derived from the session secret. DCR with a redirect allowlist and a rate limit, PKCE S256 only, Resource Indicators with `aud` = `${BASE_URL}/api/mcp`, JWT access tokens (1 h), rotating refresh tokens (30 days), RFC 9207 `iss`, RFC 8414 and OIDC Discovery. Consent page in English or Persian (RTL) that reuses the app session, names the client and the redirect host, carries its own CSRF token and a CSP `form-action` for the redirect origin. Mounted only when `LTD_OAUTH_ENABLED=true` |
| T-702 | Complete | `/api/mcp` accepts tokens of the embedded AS only on that path: signature, `iss`, `aud`, `typ: at+jwt`, a live grant for the client (so revocation is immediate) and `ltd.read`; otherwise 401 with `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/api/mcp"`, or 403 `insufficient_scope`. `protectedResource.js` serves the embedded AS and the `/api/mcp` resource when enabled; the path-suffixed metadata URL was added. API tokens (`tt_...`) and session auth are unchanged |
| T-703 | Complete | `backend/modules/ltd-capabilities`: one definition per tool (name, zod input, scope `ltd.read`/`ltd.write`/`ltd.propose`, risk R0–R3, handler). `define()` refuses delete-like names, a scope that does not match the risk tier, and non-zod input; write tools get `idempotency_key`. MCP builds its tools from it (JSON Schema via `z.toJSONSchema`) and lists only the scopes a client holds. The Phase 4 reads (`list_goals`, `get_goal`, `get_goal_progress`, `get_life_vision`, `explain_contribution`) are registered here and call the same `ltd-progress` services; their published schemas are unchanged. No AI was built; Phase 8 will build its tools from the same list |
| T-704 | Complete | `ltd_proposals` exactly as in 13.3. `backend/modules/ltd-proposals`: typed ops `create_goal`, `schedule_block`, `update_task` (due date); apply all or selected ops, reject, lazy expiry after 7 days, Undo of everything a Proposal applied in one transaction. Every applied op is a Journal entry with `proposal_id`; a change that went stale (task due date moved, slot taken) is refused, never forced. Deciding needs the signed-in human; tokens get 403. `frontend/components/Proposals`: Proposal Review at `/proposals` with a change preview, per-change checkboxes, Apply, Reject and Undo; user and client text in `<bdi>`; logical Tailwind classes only. New strings in `en` and `fa`, English in the other locales |
| T-705 | Complete | `plan_tomorrow` (deterministic draft from `ltd-planner`: ranked candidates into free 15-minute slots of the work hours, 5-minute buffers around events and blocks, load kept at or under 0.85; nothing saved until applied), `create_goal` and `reschedule_tasks` (tomorrow, start of next week, or a date) as Proposals; `capture` and `checkin_metric` as R1 with Journal and Undo; `get_weekly_plan` and `get_calendar_events` read only, event titles only with `allow_titles: true`. `idempotency_key` on every write, 30 writes a minute per client, `writes_disabled` after three violations in ten minutes, typed error codes (`validation`, `not_found`, `conflict`, `insufficient_scope`, `read_only`, `rate_limited`, `writes_disabled`, `internal`), an access log with an argument hash. No tool deletes |
| T-706 | Complete | `backend/modules/ltd-mcp-control` and `ltd_mcp_settings`: Settings → MCP lists OAuth clients (name, redirect host, scopes, last use) and tokens that used MCP; revoke one; turn writes back on; read-only mode (blocks Registry and legacy writes, reads go on); kill switch (removes every OAuth grant and stops every API token issued until then on `/api/mcp`, REST keeps working). Human session only. stdio honours both |
| T-707 | Partly complete | `docs/ltd/mcp-connect.md`: Claude Code with Bearer, Claude Code with OAuth on loopback, server setup, claude.ai and ChatGPT steps for when HTTPS exists. Loopback OAuth client calling a read tool: **GREEN** (contract check 34, and by hand in a browser, below). claude.ai: **BLOCKED** (no public HTTPS domain; no tunnel was opened). ChatGPT: **BLOCKED** (same, plus plan/developer mode unconfirmed, A-06) |

## Checklist 17.3 (local, real HTTP, no internet)

`backend/tests/helpers/ltdOauthContract.js` boots this code on `127.0.0.1` with a throwaway SQLite file and signing key and plays the client; `backend/tests/ltd/oauth-contract.test.js` runs it in CI. Result on the final code: **40/40 checks passed**.

| # | 17.3 item | Result | Contract checks |
| --- | --- | --- | --- |
| 1 | `401` with `WWW-Authenticate: Bearer resource_metadata` | ✅ | 1 |
| 2 | `resource` exactly the MCP URL | ✅ | 2 |
| 3 | Own AS first in `authorization_servers` | ✅ | 3 |
| 4 | RFC 8414 / OIDC Discovery with `code_challenge_methods_supported: ["S256"]` | ✅ | 4, 5 |
| 5 | `/token` takes form-urlencoded, `/register` takes JSON | ✅ | 16, 8 |
| 6 | Rotating refresh token; `invalid_grant` for a used one | ✅ | 26, 38, 39 |
| 7 | `resource` → `aud`; tokens without the right aud or scope refused | ✅ | 17, 23, 24, 25, 27, 33 |
| 8 | Redirect URIs: claude.ai, loopback any port, ChatGPT | ✅ allowlist; claude.ai and loopback exercised, ChatGPT URIs not exercised by ChatGPT | 9, 14, 34 |
| 9 | `iss` in the authorization response (RFC 9207) | ✅ | 15 |
| 10 | Discovery, register and token under 10 s; refresh under 30 s | ✅ 87 ms, 6 ms, 8 ms, 6 ms | 28 |
| 11 | `scopes_supported`: `ltd.read ltd.write ltd.propose offline_access` | ✅ | 6 |
| 12 | ChatGPT: `securitySchemes` per tool and `_meta["mcp/www_authenticate"]` | ❌ Not built (ChatGPT is BLOCKED) | — |
| 13 | Consent page shows the redirect host | ✅ | 12, 13 |

12 of 13 items pass locally. Item 12 is open. The full list of 40 checks with evidence is printed by `node backend/tests/helpers/ltdOauthContract.js`.

### The 23 G4 items, counted again on this code

Every G4 item was run again on this branch (not copied from the spike). All 23 pass. G4 item → check on this run: 1→1, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7, 8→8, 9→9, 10→10, 11→11, 12→12, 13→14, 14→15, 15→16, 16→17, 17→18, 18→19 (`list_tasks` with the OAuth token), 19→21, 20→22, 21→26, 22→38, 23→27. G4 item 23 now answers `invalid_target` (G4: `invalid_grant`).

Checks beyond G4: CSRF on the consent form (13), no legacy write or delete tool for OAuth clients (20), wrong `aud` with a validly signed token (23), token without `ltd.read` (24), write tool without its scope (25), unknown scope never granted (33), refresh reuse ends the grant (39), the `plan_tomorrow` → apply → Undo flow over OAuth (29–32), the loopback client (34), the `tt_` Bearer token still answering `list_tasks` (35), revoke one client (36, 37), kill switch (40).

## Decisions

- **G4 findings rebuilt.** (1) The `login` prompt finishes silently from the app session, so the user sees one consent page. (2) Every client allowed `refresh_token` gets a rotating refresh token, because `oidc-provider` drops `offline_access` without `openid`. (3) The consent page sends its own CSP with `form-action 'self' <redirect origin>`; confirmed in Chromium: the browser followed the cross-origin redirect after the form post. (4) The AS router is mounted only when enabled; the two new API routers are mounted last so earlier routes do not pass through them. All four fake-timer suites pass.
- **Persistent state.** Grants, codes and refresh tokens live in `ltd_oauth_models`; the signing key lives in a file on the data volume. A restart keeps every connection (G4 used memory and a boot-time key).
- **JWT revocation.** A JWT access token cannot be recalled, so `/api/mcp` also requires a live grant for the token's client. Revoking a client or the kill switch takes effect on the next request, not after an hour.
- **Refresh token reuse ends the grant** (oidc-provider's reuse detection, RFC 9700). Check 39 asserts it.
- **Legacy tududi write tools** (`create_task`, `update_task` and so on) do not go through the Journal. OAuth clients do not see them; they see only legacy reads and the Registry tools. API tokens keep the full upstream catalogue so existing Bearer setups and upstream tests do not change; for them, a due-date change through `update_task` still writes at once. Read-only mode blocks legacy writes for every client.
- **API tokens hold all three scopes.** They are personal, full-trust credentials (17.2); the `abilities` column stays unused.
- **Consent is all or nothing.** Partial scope choices would loop `oidc-provider`'s consent prompt; read-only mode covers "read but do not write".
- **The rate limit counts Registry writes only**, in memory per process (marked `ponytail:`). One Node process serves the app today.
- **Not built (default off per 17.4):** `apply_proposal` and `undo_change` tools. Every Proposal is applied in the app.
- **Stale changes are never forced.** A due date that moved after the Proposal, or a slot taken since, fails that change and leaves the Proposal pending (or partly applied).
- **Proposal ops keep the order the client sent** on every dialect (found on PostgreSQL: `findAll` order is not stable).

## Not covered

- claude.ai and ChatGPT connections (BLOCKED: no public HTTPS; ChatGPT also A-06). The local substitute for the DoD scenario ("goals and progress", "plan tomorrow" → apply → Undo) passes over OAuth (checks 19, 29–32).
- 17.3 item 12 (ChatGPT `securitySchemes` and `_meta`).
- CIMD (A-13 unchanged). DCR leaves one client row per connection; unused client rows are not purged yet.
- MCP Inspector was not used; the contract script covers the same HTTP surface.

## Verification

| Check | Result |
| --- | --- |
| OAuth contract (`tests/ltd/oauth-contract.test.js`) | 40/40 checks, offline, real HTTP |
| Registry, Proposals, isolation, controls (`tests/ltd/mcp-capabilities.test.js`) | 15 passed on SQLite and on PostgreSQL 16: tool table with schema, scope and risk; `define()` refusals; `plan_tomorrow` writes nothing until applied and Undo restores the day exactly; `create_goal` and `reschedule_tasks` with partial apply and exact Undo; reject, expiry, no double decision; stale due date and taken slot refused; user A vs B (proposals, goals, tasks, metrics, token cannot decide); `capture`/`checkin_metric` with Journal Undo; idempotency replay; 30 writes then `rate_limited` then `writes_disabled` and re-enable; read-only for Registry and legacy writes; kill switch; calendar titles hidden by default; `get_weekly_plan` read only; typed validation errors |
| Existing MCP and OAuth suites (`tests/integration/mcp`, `tests/unit/modules/mcp`, `tests/integration/oauth.test.js`, `tests/ltd/mcp-planning.test.js`) | All pass unchanged (SSO resource metadata, Bearer `tt_`, stdio unit tests, Phase 4 schemas) |
| Phase 4 coverage gate | 102 passed; `ltd-journal` 96.6 % statements / 93.7 % branches, `ltd-progress` 99.4 % / 95.4 % |
| Backend SQLite, full suite | 287 suites, 4151 passed, 8 existing skips |
| Backend PostgreSQL 16, full suite (local container, as in CI) | 286 of 287 suites in the full parallel run; the one failure was a `socket hang up` in `projects.test.js`, which then passed 34/34 three times alone. 4050 passed, 108 existing dialect skips |
| Upgrade and schema parity | 119 passed with PostgreSQL enabled (SQLite legacy fixtures gain the three tables with user CASCADE; parity clean on SQLite and PostgreSQL) |
| Fake-timer suites (G4 finding 4) | 4 suites, 89 passed |
| Frontend, full suite | 134 suites, 957 passed (includes `Proposals.test.tsx` and locale coverage) |
| E2E, full runner | 58/59; the failure was `inbox-task-project.spec.ts`, which passed 3/3 alone (the flake recorded in Phases 5 and 6) |
| Lint / typecheck / build | 0 errors (12 existing backend warnings); `tsc --noEmit` and the production build pass |
| Browser (Chromium, isolated database, OAuth on) | Proposals page lists three MCP Proposals with previews; Apply wrote tomorrow's two blocks, Journal entry `plan_blocks` by `mcp` with `proposal_id`; Undo returned the day to no plan; Reject and goal Apply (goal visible on Goals); consent page for a loopback client with host and scopes, Allow redirected with `code` and `iss`, the token read `get_life_vision`; Settings → MCP listed both clients, read-only gave `read_only`, revoke gave 401, kill switch gave 401 on MCP and 200 on REST; Persian: `dir="rtl"`, Jalali dates, `bdi` resolved per text. Console: only the dev bundle's webpack socket to `:8080` and `/api/billing` 404, both unrelated |

## Boundaries

- New code: `backend/modules/ltd-oauth`, `ltd-capabilities`, `ltd-proposals`, `ltd-mcp-control`; `backend/models/ltd_proposal.js`, `ltd_oauth_model.js`, `ltd_mcp_setting.js`; migration `20261013000001-ltd-mcp-remote.js` (additive, `safeCreateTable`); `frontend/components/Proposals`; `frontend/utils/proposalsService.ts`; `docs/ltd/mcp-connect.md`. Core touch points carry `LTD-PATCH(T-70x)` and are listed in `docs/ltd/UPSTREAM.md`. Old migrations were not edited.
- New dependencies: `oidc-provider` 9.12.2 (MIT, pinned exactly); `zod` made direct (already installed through the MCP SDK). `npm audit --omit=dev --audit-level=high` reports no high or critical issue.
- No `.env`, signing key, token or `deploy/data` file is committed.
