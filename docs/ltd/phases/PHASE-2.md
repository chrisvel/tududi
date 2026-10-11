# Phase 2 — self-host deployment, recovery and baseline

Phase 1 [PR #1](https://github.com/DanialMasghati/life-to-day/pull/1) merged after [all seven CI jobs passed](https://github.com/DanialMasghati/life-to-day/actions/runs/38123438059). Phase 2 started from main `3f21fe4a265550448f89b132c8dbd1240e00d8cc`; the isolated draft was restored onto `feat/T-201-deploy`. The UPSTREAM.md stash conflict preserved both T-103 and T-201 patch rows. The separate CLAUDE.md Agent operating constraints edit stays unstaged and excluded.

## Acceptance evidence

| Task | Status | Evidence / remaining dependency |
| --- | --- | --- |
| T-201 | **BLOCKED** overall; local **GREEN** | One app, loopback-only local profile, native ARM64 Docker build, wget `/api/health/ready` HTTP 200. Production reads only this fork's GHCR, no app host port, Caddy 80/443 TCP + 443 UDP with deferred HSTS. Public hostname/server and live production rollout are absent; owner selected local-only. Fork-only GHCR publication passed after the native architecture preflight. |
| T-202 | **BLOCKED** overall; local backup/drill **GREEN** | Snapshot integrity `ok`, real user/task counts unchanged, empty-folder recovery in **9 s**. Restic missing environment returns exit 2 after local backup. No off-site credentials or dead-man URL supplied. Weekly synthetic CI drill passed in 5 s on the corrected runner. |
| T-203 | **BLOCKED** overall; baseline/HTTP MCP **GREEN** | Recorded exact SHAs, DB path, readiness, counts/times and five local backend test failures. HTTP Bearer list_tasks returns the real task. Claude Code is logged out; iCal was explicitly deferred. |

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
- Native amd64 and arm64 preflight build/smoke/scan passed before the single experimental `v0.0.0-phase2` tag was pushed. Native local ARM64 builds completed without QEMU timeout. The pre-release did not move `latest`; no GitHub release/announcement was made.
- `docker-publish.yml` has no Docker Hub login/output, no upstream image namespace and no external announcement. Hosted tududi deploy dispatch is disabled for this fork. GitHub release commands target the owner's repository.
- Image **GREEN**: `ghcr.io/danialmasghati/life-to-day:0.0.0-phase2`; [GHCR package](https://github.com/users/DanialMasghati/packages/container/package/life-to-day), [successful publication run](https://github.com/DanialMasghati/life-to-day/actions/runs/38125532345). Index digest `sha256:871b28a0e9785d8c1e52e761223f8e2c7e949df1eb8eae8765602511ae697f4f`; inspected from this host with linux/arm64 and linux/amd64 manifests.
- Weekly/PR drill: `backup-drill.yml`, Sunday 03:45 UTC; only synthetic data and text proof artifacts. [Successful run](https://github.com/DanialMasghati/life-to-day/actions/runs/38125312777): 5 s, integrity ok, one synthetic user/task unchanged. No branch protection was changed.
- The initial runner drill [run](https://github.com/DanialMasghati/life-to-day/actions/runs/38125019102) built/started the app and made a valid backup, then failed with `mkdir data/drill: Permission denied`: Docker created the parent folder as root. The workflow now creates the state folders before Docker and uses explicit Bash pipefail so `tee` cannot hide backup/drill failures. This was a runner-directory failure, not a recovery pass; the corrected run passed.
- Native amd64/arm64 publication preflight [passed on the tag commit](https://github.com/DanialMasghati/life-to-day/actions/runs/38125312747), including dependency/migration smoke checks and HIGH/CRITICAL image scans. No image was pushed by this PR validation.
- `deploy.sh` snapshots before changing version, pulls and starts one writer, checks readiness and restores **both** the captured image ID and exact SQLite snapshot on failure. Failed WAL/SHM files are retained separately while the app is stopped. Production execution is untested/BLOCKED without a host; script syntax/config checks pass. Automatic approval review rejected an executable valid-version guard trial because it could trigger production pull/migrations/database mutation; it was not retried or bypassed.

## Additional inherited tag check

The pre-existing [Docker upgrade test](https://github.com/DanialMasghati/life-to-day/actions/runs/38125532340) also ran on the experimental tag and failed one v1.4.2 fixture assertion: API task count `3 -> 4`. Migration/backup/login/marker preservation/restart/dialect guard checks passed; later fixture steps were not run. This unresolved failure is explicitly recorded in baseline.md, with no product change or skipped assertion. It is not one of the seven requested Phase 1 PR merge gates and does not replace the GREEN local/runner recovery proof.

## Scope and exclusions

- Spike branches were not merged or pushed. No G6 post was made.
- OAuth/JWKS were not built. No Phase 7 environment keys were made mandatory.
- No Google Calendar API, RTL/fa/Jalali, navigation, idempotency or ltd-* module work was started. **Phase 3 was not started.**
- `.env`, `.env.version`, tokens, session secret, restic password, feed addresses, live data and SQLite snapshots were not committed.
- Root `docker-compose.yml` is unchanged and retains its upstream behavior. The old local tududi container was reversibly stopped solely to release port 3002, with its data retained.
- Independent maintenance replaces automatic upstream sync. Original licenses/provenance stay intact; branding implementation is deferred.

## Completion gate

Merge requires all Phase 1 CI jobs green on this PR and the local drill above GREEN. External BLOCKED items are explicit and do not prohibit merge. Publication and CI drill links above reflect actual successful runs; staged/committed Git scans have zero actual secret/token/private-feed matches. After completion, stop at Phase 2.
