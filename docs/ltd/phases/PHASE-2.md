# Phase 2 — self-host deployment, recovery and baseline

Phase 1 [PR #1](https://github.com/DanialMasghati/life-to-day/pull/1) merged after [all seven CI jobs passed](https://github.com/DanialMasghati/life-to-day/actions/runs/38123438059). Phase 2 started from main `3f21fe4a265550448f89b132c8dbd1240e00d8cc`; the isolated draft was restored onto `feat/T-201-deploy`. The UPSTREAM.md stash conflict preserved both T-103 and T-201 patch rows. The separate CLAUDE.md Agent operating constraints edit stays unstaged and excluded.

## Acceptance evidence

| Task | Status | Evidence / remaining dependency |
| --- | --- | --- |
| T-201 | **BLOCKED** overall; local **GREEN** | One app, loopback-only local profile, native ARM64 Docker build, wget `/api/health/ready` HTTP 200. Production reads only this fork's GHCR, no app host port, Caddy 80/443 TCP + 443 UDP with deferred HSTS. Public hostname/server and live production rollout are absent; owner selected local-only. GHCR publication awaits the green architecture preflight before the single experimental tag. |
| T-202 | Local backup/drill **GREEN**; off-site/dead-man **BLOCKED** | Snapshot integrity `ok`, real user/task counts unchanged, empty-folder recovery in **9 s**. Restic missing environment returns exit 2 after local backup. No off-site credentials or dead-man URL supplied. Weekly synthetic CI drill added; run link pending initial PR execution. |
| T-203 | Baseline/HTTP MCP **GREEN**; Claude Code/iCal **BLOCKED** | Recorded exact SHAs, DB path, readiness, counts/times and five local backend test failures. HTTP Bearer list_tasks returns the real task. Claude Code is logged out; iCal was explicitly deferred. |

Detailed commands and output: [baseline.md](../baseline.md).

```text
docker compose --profile local up -d --build: build/start successful
curl -fsS http://127.0.0.1:3002/api/health/ready: HTTP 200, database ok, no pending migrations
./backup.sh: ltd-20261011T082032Z.sqlite3, 992K, integrity ok
./restore-drill.sh <snapshot> <empty-folder>: 9s; users=1, tasks=1 before and after
./restic-backup.sh: valid local backup, explicit BLOCKED, exit 2
npm test: 4008 passed / 5 failed / 8 existing skips, 312.51s
npm run frontend:test: 871 passed, 349.726s
MCP tools/call list_tasks: HTTP 200, count=1
```

## Release and automation

- Image namespace: `ghcr.io/danialmasghati/life-to-day`; no image is pushed by PR validation.
- Native amd64 and arm64 preflight build/smoke/scan must pass before the one experimental `v0.0.0-phase2` tag is pushed. Native local ARM64 builds completed without QEMU timeout.
- `docker-publish.yml` has no Docker Hub login/output, no upstream image namespace and no external announcement. Hosted tududi deploy dispatch is disabled for this fork. GitHub release commands target the owner's repository.
- GHCR image/run link: **BLOCKED pending the preflight**, to be updated after actual publication.
- Weekly/PR drill: `backup-drill.yml`, Sunday 03:45 UTC; only synthetic data and text proof artifacts. Run link: pending first execution. No branch protection was changed.
- `deploy.sh` snapshots before changing version, pulls and starts one writer, checks readiness and restores **both** the captured image ID and exact SQLite snapshot on failure. Failed WAL/SHM files are retained separately while the app is stopped. Production execution is untested/BLOCKED without a host; script syntax/config checks pass. Automatic approval review rejected an executable valid-version guard trial because it could trigger production pull/migrations/database mutation; it was not retried or bypassed.

## Scope and exclusions

- Spike branches were not merged or pushed. No G6 post was made.
- OAuth/JWKS were not built. No Phase 7 environment keys were made mandatory.
- No Google Calendar API, RTL/fa/Jalali, navigation, idempotency or ltd-* module work was started. **Phase 3 was not started.**
- `.env`, `.env.version`, tokens, session secret, restic password, feed addresses, live data and SQLite snapshots were not committed.
- Root `docker-compose.yml` is unchanged and retains its upstream behavior. The old local tududi container was reversibly stopped solely to release port 3002, with its data retained.
- Independent maintenance replaces automatic upstream sync. Original licenses/provenance stay intact; branding implementation is deferred.

## Completion gate

Merge requires all Phase 1 CI jobs green on this PR and the local drill above GREEN. External BLOCKED items are explicit and do not prohibit merge. Publication and CI drill links must reflect actual runs before the final report; secrets must pass a staged/committed Git scan. After completion, stop at Phase 2.
