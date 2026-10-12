# Phase 8 — In-app AI proposals

Base: `58c423b0590f7983dcee8f0c5bdaa5d7b80d7e27` (latest fetched `origin/main` when work resumed). The user revoked the earlier exact-SHA gate. Future work defaults to the latest fetched main; an explicit user checkout/base takes precedence. The rule is in tracked `CLAUDE.md` and the local, ignored `AGENTS.md`.

## Scope and behavior

T-801: `ltd-llm` exposes `generateStructured` and `runTools` (1–4 steps). Installed exactly `ai@7.0.137`, `@ai-sdk/openai@4.0.91`, `@ai-sdk/anthropic@4.0.78`; all three versions were available. OpenAI-compatible chat is used for Ollama. Existing encrypted API key, base URL and model settings remain; `provider_type`, `model_fast`, `model_smart` are additive. Trusted operator base URLs retain the existing local Ollama path; user-supplied URLs retain SSRF validation. Live provider construction is disabled under `NODE_ENV=test`.

T-802: the Proposals page contains the planning assistant. Each request starts without consent. The user sees the provider, model, destination and exact trimmed planning data before authorizing that feature. Changing inputs clears consent. The server rebuilds the manifest and checks its digest before creating a provider, and rechecks provider/model/destination before each outgoing fetch. Notes and calendar titles have separate, initially off, permissions. All supplied data and tool results are marked “data, not instructions”. The configurable context budget uses UTF-8 bytes as a conservative token upper bound; notes are dropped first, then low-priority tasks. Active goals are never dropped; an insufficient budget rejects the request.

T-803: seven definitions share the Phase 7 Capability Registry. Remote callers cannot authorize the in-app network call. Model tool loops expose registered reads only; domain writes are compiled outside that loop. The deterministic MCP `plan_tomorrow` and Phase 5 Lighten controls remain.

| Feature | Deterministic work | Model output | Result |
|---|---|---|---|
| 1. Overload | Planner capacity, source/destination slots and load | Task IDs to move and explanation | Pending move-block Proposal |
| 2. Small steps | Owned planned tasks, maximum 30-minute small tasks, safe movement | Up to three IDs to keep and explanation | Pending move-block Proposal |
| 3. Decompose | Owned active goal/open task, step bounds | Title, estimated minutes, starter step | Pending create-task Proposal |
| 4. Tomorrow | Planner fits ordered IDs around busy time with buffers | Ordering and explanation | Pending schedule-block Proposal |
| 5. Weekly priorities | Filter active stalled/needs-love goals, maximum three | Goal IDs and reasons | Pending create-goal Proposal in the existing Weekly Plan |
| 6. Why | Existing deterministic `whyChain` | One sentence; unsupported numeric claims rejected | Text only; no domain write |
| 7. Reflection | Completed-task and focus-minute statistics | Summary and an open question | Text only until explicit save to existing Inbox |

The existing Proposal engine has two additive operations because Phase 7 lacked them: `move_block` and `create_task`. Existing `schedule_block` and `create_goal` are reused. Weekly suggestions create dated week goals under eligible longer goals, which appear in the existing Weekly Plan; existing priorities count toward the ceiling of three, rechecked under the owner lock at apply. All AI plan operations validate and write together inside the Journal transaction. Validation runs before proposing and again on the selected subset at apply: owned/open IDs, current source rows, busy overlap, buffers, work hours, and unrounded load at most 0.85. If no safe plan fits, no Proposal is written. The model cannot supply slots or override invariants. Undo uses existing Journal infrastructure; undoing an AI-created task archives it and an AI-created goal pauses it instead of hard deleting it.

Review save is a separate human confirmation using the existing registry Inbox capture and Journal path. No `ltd_reviews` table or guided weekly-review workflow was added.

T-804: `ltd_ai_runs` stores only the blueprint metadata fields. No prompt text/debug path exists. A valid response and its Proposal/run metadata are committed atomically. Invalid schema, invalid JSON, unknown IDs and timeouts get one retry; final failure returns `AI پاسخ معتبر نداد` with no database changes. To honor the explicit zero-database-change failure requirement, rejected attempts do not create a run row; successful rows count tokens from both attempts when returned by the provider.

## Validation

- Seven golden input snapshots and recorded FakeProvider responses, fourteen snapshots total.
- Tests cover redaction and separate permissions, token trimming, retry, invalid JSON/schema/IDs/numbers, real abort of a hanging fake, the four-step ceiling, tool output labels, changing model after manifest approval, user A/B isolation, apply/Undo and a newly busy calendar at apply.
- The test harness refuses outbound `fetch`/HTTPS and asserts no calls occurred. HTTP API tests use a temporary local listener. No OpenAI, Anthropic or Ollama inference was called.
- Final full backend run: 288 suites / 4,178 tests passed, 8 skipped, all fourteen snapshots passed. Proxy environment variables were removed from the test process because local connection tests otherwise inherited the workstation SOCKS proxy.
- Frontend: 134 existing suites / 957 tests passed; two new assistant-consent tests passed separately. Production build and typecheck passed.
- SQLite legacy upgrade/schema parity: 116 passed, 3 skipped. Phase 4 coverage gate passed (128 tests; Journal service branches 96.42%, progress branches 95.43%).
- Browser: isolated FakeProvider, temporary SQLite database and outbound fetch disabled. Manifest/unchecked consent, generation, pending Proposal, human Apply and consent reset verified. An approved weekly priority appears in the existing Weekly Plan. The tomorrow Proposal flow also passed. Existing `/api/billing` returns 404 in this non-hosted fixture; no AI-route error occurred.
- Lint passed (12 pre-existing warnings); production build/typecheck passed. Graphify AST update completed without model calls.
- Base main CI was green: https://github.com/DanialMasghati/life-to-day/actions/runs/38241141675. Implementation commit `dc1a6e70` passed PR CI, including SQLite, PostgreSQL, frontend, E2E, audit, license and image scan: https://github.com/DanialMasghati/life-to-day/actions/runs/38246988583. Restore drill and both architecture publication checks also passed. PR: https://github.com/DanialMasghati/life-to-day/pull/9 (left open, not merged).

## Explicit exclusions and remaining gates

OpenAI live: **BLOCKED — not invoked**. Anthropic live: **BLOCKED — not invoked**. Ollama live: **BLOCKED — not invoked**. Offline FakeProvider CI is the phase gate; these live checks must not be called green.

Frame and energy invariants are intentionally omitted per the phase instruction. Capability 8, task-effect/lessons Phase 11 work, Google Calendar API/Phase 9, autonomous agents, unbounded loops, automatic R3 apply, hard deletion and guided T-508 review are outside scope. No stash was popped; no deployment data, environment files or keys are included.
