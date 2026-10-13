# Phase 9 — Google Calendar

Base: `66fa1328` (latest fetched `origin/main`, Merge pull request #9). Branch `feat/T-901-gcal`.

## Scope and behavior

T-901: `backend/modules/ltd-gcal` talks to Google's OAuth and Calendar REST endpoints with plain `fetch` (no `googleapis`). Scopes: `calendar.calendarlist.readonly`, `calendar.events.readonly`, `calendar.app.created` and `openid`. `calendar` and `calendar.events` are never requested. Connect uses a single-use, 10-minute, user-bound `state` (CSRF) plus PKCE S256. The redirect URI is one configured value, sent identically in the authorization request and the token exchange; the callback always returns to a fixed page. The refresh token is encrypted with the existing `secretCipher` (key derived from `TUDUDI_SESSION_SECRET`, same as the iCal secret address and OIDC secrets). No API response, log line or error message contains a token. Management routes accept only the signed-in human session, not Bearer tokens.

Sync per selected calendar: a paged full sync, then incremental with `syncToken`. The next sync token is stored only from the last page, and a failure mid-paging stores none. Incremental requests carry no time parameters. `410 Gone` clears that calendar's read model and runs a full sync again. Cancelled events are removed. Event titles, descriptions and locations are not requested (`fields`) and not stored. Free (`transparent`), working-location and declined events do not count. Events Life-to-Day wrote (`extendedProperties.private.ltd_uid`) and the Life-to-Day calendar itself are never imported (anti-loop). Storage is UTC plus the IANA zone; all-day events are a date only. `invalid_grant` marks the account `revoked`, and planning falls back to iCal.

Schema (`20261015000001-ltd-gcal.js`): `ltd_gcal_accounts` as in blueprint 13.3, plus `last_error`. `sync_token` holds a JSON map of calendar id to token. `ltd_external_event_links` as in 13.3, plus `start_at`, `end_at`, `time_zone`, `start_date` and `end_date`, which busy time needs. `entity_type` is `busy` (imported) or `block` (written).

T-902: `ltd-gcal/busy.eventsForDay` is the only busy source for `ltd-planner` capacity, Recovery, `draftDay`, AI plan validation and the Phase 8 Context Builder. With an active Google account it returns only Google busy time, and the iCal feeds are not added for the same day. Otherwise it delegates to the unchanged iCal path. Minutes are wall-clock minutes of the user's day, so DST days line up with work hours. All-day events never use hourly capacity. Google busy events carry no title, so `allow_calendar_titles` can never send one.

T-903 (Could, implemented): an opt-in toggle creates a secondary "Life-to-Day" calendar (`calendar.app.created`) and upserts today's and tomorrow's timed blocks with `ltd_uid`. An unchanged content hash writes nothing; a changed block is overwritten (the app wins); removed blocks are deleted. Every write goes through `assertWritable`, which refuses `primary`, any foreign id and a missing target before a request is built. Turning the toggle off deletes that calendar.

Disconnect deletes the Life-to-Day calendar if present, revokes at Google, and always deletes the local account, sync tokens and links. If the revoke fails, the response and UI say so. Planning then returns to iCal.

Worker: one `gcal_sync` job in the existing node-cron `taskScheduler` every 10 minutes, under the existing per-user job lock. No `watch` channel and no tight loop.

UI: `frontend/components/Integrations/GoogleCalendarCard.tsx` in Profile → Calendars shows connect, status, the export toggle and disconnect. It uses no new physical direction classes and shows no secret. Strings are in `profile.gcal`: English and Persian, English in the other locales.

The owner's Google Cloud steps (project, consent screen **In production**, web client, exact redirect URI) are in [`docs/ltd/gcal-setup.md`](../gcal-setup.md). None were done by the agent.

## Validation

- `backend/tests/ltd/gcal.test.js`, 23 tests, all against nock fixtures with net connect disabled: OAuth scopes, state and PKCE; forged and replayed state (token endpoint untouched); encrypted storage and no token in the API; Bearer refused; paged full sync; no token after a failed page; incremental with deletion and no time parameters; 410 recovery; anti-loop, free, declined and own-calendar exclusion; `invalid_grant` fallback; DST for Europe/Paris (spring), America/New_York (spring and fall), Asia/Tehran 2026 (no slip); UTC+IANA and date-only storage; all-day does not zero capacity; no double count with iCal and iCal back after disconnect; no title; user A/B isolation; disconnect with failed revoke; write guard before any fetch; calendar creation, insert, unchanged skip and overwrite only on the Life-to-Day calendar (no request to primary or foreign ids); one worker run under a fake clock.
- Mutation checks (each reverted): elapsed instead of wall-clock minutes failed 3 tests; removing the anti-loop check failed 1; weakening the write guard failed 1; removing the state comparison failed 1.
- Full backend run: 289 suites, 4,200 passed, 8 skipped, 1 failed. The failure was `inbox-attachments` "requires authentication" (`write EPIPE` under parallel load). That file passes 14/14 on its own and is unrelated to this phase. All 14 snapshots passed.
- SQLite upgrade and schema parity: 123 passed, 3 skipped, including the new Phase 9 table and foreign-key test.
- Frontend: 962/962 on two consecutive runs. An earlier run overlapping the build had one failure that did not reproduce. Production build and typecheck passed. Lint: 0 errors, the 12 existing warnings.

## Findings outside scope

The existing iCal path (`calendar-feeds/icsEvents.js`) computes `start_minute` as elapsed minutes since local midnight, so on a DST day events after the switch are off by one hour against wall-clock work hours. It was not changed here; the Google path uses wall-clock minutes.

## Explicit exclusions and remaining gates

Live Google sync: **BLOCKED**. It needs the owner's Google Cloud project, the consent screen in production and the client credentials. No live Google request was made; the fixture suite is the phase gate. The blueprint DoD "7 days of sync without duplicates or loops" can only be observed after that. Push channels (`watch`), two-way sync, Phase 10, claude.ai OAuth and LLM work are out of scope. No stash was popped; `.env`, `deploy/.env` and `deploy/data` are not included.
