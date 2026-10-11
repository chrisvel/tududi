# Phase 1 — repository setup and CI repair

PR: https://github.com/DanialMasghati/life-to-day/pull/1

The two original T-102/T-103 commits add fork provenance, maintenance documentation, Node 22 and CI gates alongside the upstream jobs. Deployment work for T-201 remains in a local stash until this PR passes CI. The separate uncommitted `CLAUDE.md` Agent operating constraints edit is excluded.

## Initial CI findings

Run: https://github.com/DanialMasghati/life-to-day/actions/runs/38122036957

- SQLite, PostgreSQL and license jobs passed.
- Audit failed: 7 findings (2 low, 3 moderate, 1 high, 1 critical).
- Frontend failed: 3 suites, 3 tests; 115 suites and 864 tests passed.
- Image scan failed: 28 HIGH/CRITICAL findings, mainly in the image's bundled npm.
- E2E failed: 40 failures, 3 passes and 4 tests not run.

## Repairs

- Raise the MCP SDK floor to 1.32.1 and resolve `proxy-addr` to 2.0.8. No bulk `npm audit fix` or forced downgrade.
- Transform the real Markdown ESM dependency chain in Jest; disable React Refresh only in tests and production. No mock replaces Markdown rendering.
- Match the existing neutral Mermaid theme and current hosted admin description in stale test expectations.
- Pass the E2E runner's API URL, complete the real welcome flow in the shared login helper and reuse that helper in Inbox and Share Target tests.
- Use the email as CalDAV calendar owner, expect escaped resource hrefs and the existing date-only deadline export. Product code and calendar behavior are unchanged.
- Assert registration's explicit HTTP 503 and unavailable-verification-email message when the runner has no SMTP service. An unexpected status or error fails the test; this does not prove successful email delivery.
- Upgrade runtime npm to 11.21.0, then target its bundled `brace-expansion` 5.0.12, `http-cache-semantics` 4.3.0, `picomatch` 4.0.7 and `undici` 6.28.1. Keep `npx` for migration startup. The user's later authorization permits these targeted security upgrades; the T-201 build-platform fallback is still stashed.

## Local validation

| Command | Result |
| --- | --- |
| `npm audit --omit=dev --audit-level=high` | Exit 0; 0 high/critical. 5 low/moderate findings remain in KaTeX/Mermaid and uuid/Sequelize/session-store. |
| `npm run frontend:test -- --watchman=false --runInBand` | 118 suites, 871 tests passed; Jest time 349.726 s. |
| `CI=true bash e2e/bin/run-e2e.sh` | 47 passed, no skips/failures; Playwright time 31.2 s. |
| `npm run lint` | Exit 0; 12 pre-existing backend test warnings, 0 errors. |
| `npm run backend:test -- --watchman=false --runInBand tests/unit/modules/mcp tests/integration/mcp` | 6 suites, 179 tests passed; Jest time 75.63 s. |
| `docker build --platform linux/arm64 -t ltd:phase1-ci .` | Exit 0 on the native ARM64 host, without QEMU. |
| Image smoke: load Sequelize, sqlite3, Express and MCP SDK; run `npx --no-install sequelize-cli --version`; locate `wget` | Exit 0; CLI 6.6.5, ORM 6.37.8; `/usr/bin/wget`. |
| `aquasec/trivy:0.75.0 image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 ltd:phase1-ci` | Exit 0; no HIGH/CRITICAL findings in the built image. |

Fresh GitHub CI must pass all seven jobs before this PR is merged and Phase 2 is unstashed. No check is disabled, no vulnerability is ignored and no failing test is skipped.

## Scope

The project continues from the tududi fork and is developed independently. No upstream PR, spike merge, branding implementation, OAuth implementation or Phase 3 work is included. No production secret or database is committed.
