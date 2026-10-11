# Phase 2 baseline — 2026-10-11

## Provenance and runtime

- Main after Phase 1 PR #1: `3f21fe4a265550448f89b132c8dbd1240e00d8cc`.
- Recorded upstream/main: `f270f38f6247b6c462ba3b10de73e7dd9e6e6ff7`; fork merge-base: `a47c41135e996da5ad3258731c499528bba8c89a`. No upstream sync or spike merge.
- Phase 1 CI repairs: `4f1ba1d381041372cee85d339f61b2248adafc97`; [all seven jobs passed](https://github.com/DanialMasghati/life-to-day/actions/runs/38123438059).
- Local host: macOS ARM64. Native ARM64 build completed; no QEMU was used. Dependencies/test code match the repaired Phase 1 baseline.
- Observed via `sqlite3 ... 'PRAGMA database_list;'`: `0|main|/app/db/production.sqlite3`. Host file: `deploy/data/db/production.sqlite3`, ignored by Git.
- Exactly one compose app, `life-to-day-app`; no Caddy in local profile. Only `127.0.0.1:3002` is published.

## Local deployment — GREEN

```bash
cd deploy
cp .env.example .env && chmod 600 .env
# Fill only .env with openssl rand -base64 24 and openssl rand -hex 64.
docker compose --profile local up -d --build
curl -fsS http://127.0.0.1:3002/api/health/ready
```

Output on 2026-10-11:

```text
HTTP 200
{"status":"ok","database":"ok","databaseLatencyMs":7,"pendingMigrations":[],"timestamp":"2026-10-11T08:17:34.000Z"}
life-to-day-app  life-to-day:local  app  healthy  127.0.0.1:3002->3002/tcp
```

The first build succeeded but startup failed because the old `tududi` container from this repository held port 3002: `Bind for 0.0.0.0:3002 failed: port is already allocated`. Its compose labels and mounts confirmed this project. It was reversibly stopped, preserving `tududi_db`, `uploads` and `backups`; the unchanged root compose file can start it later after the new app stops. No unrelated container was changed.

Production config validation:

```text
production image: ghcr.io/danialmasghati/life-to-day:latest
app build: False host ports: []
Caddy ports: [('80', 'tcp'), ('443', 'tcp'), ('443', 'udp')]
```

Public hostname/server were not supplied and the owner selected local-only execution. Public TLS/HSTS and production rollout/rollback execution remain **BLOCKED**. No certificate was requested for `plan.example.com`. Automatic approval review rejected an executable `deploy.sh` trial with a valid version because it might mutate production; no production execution or bypass occurred.

## Real-data backup and isolated recovery — GREEN

A bootstrap user was created by the app. A real task, `Phase 2 backup recovery proof`, was created through authenticated `POST /api/task` (201), with a session CSRF token. No direct inserts were made into the live database.

```bash
cd deploy
./backup.sh
mkdir -p data/drill-proof  # initially empty
# Wall timestamps recorded with date -u '+%Y-%m-%dT%H:%M:%SZ %s'
./restore-drill.sh data/backups/ltd-20261011T082032Z.sqlite3 "$PWD/data/drill-proof"
```

```text
Backup OK: .../deploy/data/backups/ltd-20261011T082032Z.sqlite3 (992K)
users=1 tasks=1
START 2026-10-11T08:20:33Z 1791706833
integrity: ok
ready: {"status":"ok","database":"ok","databaseLatencyMs":2,"pendingMigrations":[],"timestamp":"2026-10-11T08:20:42.094Z"}
rows in backup:   users=1 areas=0 projects=0 tasks=1 notes=0
rows after start: users=1 areas=0 projects=0 tasks=1 notes=0
== drill passed in 9s
END 2026-10-11T08:20:42Z 1791706842
```

Wall time from drill start to ready/end: **9 seconds**, below 1,800 seconds. The separate drill container used only the empty target, no published port, and disabled scheduler/Telegram. Its container was removed; the supplied target was retained for inspection. Live app start time remained `2026-10-11T08:17:07.556892006Z`, healthy, with `users=1 tasks=1` after recovery. No live mount was used by the drill. SQLite files are not committed.

## Test measurements

| Command | Suites | Tests | Jest time | Exit |
| --- | --- | --- | --- | --- |
| `npm test -- -- --watchman=false --maxWorkers=2` | 271 passed, 5 failed / 276 | 4008 passed, 5 failed, 8 skipped / 4021 | 312.51 s | 1 |
| `npm run frontend:test -- --watchman=false --runInBand` | 118 passed / 118 | 871 passed / 871 | 349.726 s | 0 |
| `CI=true bash e2e/bin/run-e2e.sh` | — | 47 passed, no skips | 31.2 s (Playwright) | 0 |
| MCP backend unit/integration suites | 6 passed / 6 | 179 passed / 179 | 75.63 s | 0 |

Frontend/E2E/MCP timings were measured during the immediately preceding Phase 1 repair with the same test/product files now on main; no product or test code changed in Phase 2. The full `npm test` row was measured during Phase 2 on this Mac. Eight skips are existing upstream skips, not added here.

Local failures are recorded, not hidden or repaired by changing product code:

- `tests/integration/inbox-attachments.test.js`: unauthenticated upload, `write EPIPE`.
- `tests/integration/task-attachments.test.js`: unauthenticated upload, `write EPIPE`.
- `tests/unit/services/logService.test.js`: expected `ECONNREFUSED`, got the local proxy protocol assertion (`socks5:` versus `http:`).
- `tests/unit/modules/calendar-feeds.test.js`: connect-time private-address assertion got `Could not reach the calendar` with the local proxy.
- `tests/unit/modules/calendar-feeds-private-hosts.test.js`: connect-time link-local assertion got `Could not reach the calendar` with the local proxy.

Linux CI SQLite/PostgreSQL tests and schema upgrade checks passed on the Phase 1 commit. This does not turn the five local failures into passes.

## MCP HTTP + Bearer — GREEN; Claude Code — BLOCKED

Source: repository `docs/14-mcp-integration.md`, HTTP transport, Direct HTTP API and `list_tasks`. Token generation uses `Profile → API Keys`, backed by `POST /api/profile/api-keys` (201). The token is stored only in ignored local `.env` and a mode-0600 private client config, never in this document.

```bash
curl -fsS http://127.0.0.1:3002/api/mcp \
  -H "Authorization: Bearer ${TUDUDI_API_TOKEN}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_tasks","arguments":{"type":"all","limit":10}}}'
```

Output: HTTP 200, SSE `event: message`, JSON-RPC result with text JSON `count: 1`, task `Phase 2 backup recovery proof`. Send this stateless Bearer call without login cookies; a session cookie would also require CSRF. No OAuth/JWKS or remote MCP infrastructure was added.

`claude auth status` reported `loggedIn: false`, `authMethod: none`. A Claude Code conversation could not be authenticated here: **BLOCKED**. The repository's documented HTTP bridge config, with only a placeholder below, is:

```json
{
  "mcpServers": {
    "life-to-day": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:3002/api/mcp", "--header", "Authorization:Bearer ${TUDUDI_API_TOKEN}"],
      "env": {"TUDUDI_API_TOKEN": "<local token from ignored deploy/.env>"}
    }
  }
}
```

After signing into Claude Code, put the real config in a local mode-0600 file outside Git and run `claude --mcp-config /path/to/private-config.json --strict-mcp-config -p 'Use life-to-day list_tasks to list my tasks.'`. No Claude account/config was changed in this phase.

## Off-site backup, dead-man and iCal — BLOCKED

```text
./restic-backup.sh
Backup OK: .../ltd-20261011T082147Z.sqlite3 (992K)
BLOCKED: set RESTIC_REPOSITORY and RESTIC_PASSWORD in the host environment; local backup succeeded.
exit=2
```

No restic repository/password or dead-man URL was supplied. No off-site/dead-man success is claimed. The server cron entry is documented for 03:15 UTC; no cron was installed on macOS. The weekly CI drill uses a disposable SQLite fixture with one user and task, and uploads only text logs.

The owner explicitly deferred iCal testing. No secret feed URL was supplied, stored in Git or fetched; stage A remains **BLOCKED**. A later trial must enter it only in the existing Calendar feeds UI/local environment. No Google Calendar API integration was added.
