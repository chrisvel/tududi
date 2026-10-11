# Fork provenance and independent maintenance

Life-to-Day continues from the tududi fork chosen in Phase 0. The owner has since explicitly requested independent development: no automatic upstream sync, upstream-first PR policy, hosted tududi deployment or shared image namespace. This supersedes the monthly sync policy originally recorded for T-102. Source attribution and history remain intact; branding is a separate future task.

## Recorded provenance

| Item | Value |
| --- | --- |
| Existing upstream remote (reference only; unchanged) | `https://github.com/chrisvel/tududi.git` |
| Fork code base / merge-base | `a47c41135e996da5ad3258731c499528bba8c89a` (`v1.8.2-4-ga47c4113`) |
| Recorded `upstream/main` on 2026-10-11 | `f270f38f6247b6c462ba3b10de73e7dd9e6e6ff7` (`v1.9.1`), not merged |
| Own repository | `DanialMasghati/life-to-day` |
| Own release image | `ghcr.io/danialmasghati/life-to-day` |

## Rules

- Maintenance, PRs and releases target the owner's repository. Upstream integration requires a new explicit request.
- Do not rewrite history or merge `spike/*` branches.
- Record changes to inherited core files with an `LTD-PATCH(T-xxx)` comment and a row below.
- Retain the original license and third-party attribution.

## فهرست LTD-PATCH

Phase 1 CI repairs and Phase 2 deployment patches are listed below. `scripts/ltd-patches.sh` scans backend/frontend/public; patches outside those directories are recorded here.

| تسک | فایل | چرا | PR به upstream |
|---|---|---|---|
| T-103 | `package.json`, `package-lock.json` | Raise the MCP SDK security floor to 1.32.1 and update proxy-addr to 2.0.8; no bulk audit fix | No |
| T-103 | `jest.config.js`, `babel.config.js` | Transform Markdown ESM dependencies in Jest and keep React Refresh out of tests | No |
| T-103 | `frontend/components/Shared/__tests__/MermaidDiagram.test.tsx`, `frontend/components/Admin/__tests__/roleLabels.test.ts` | Align stale expectations with the existing neutral theme and hosted role wording; product behavior unchanged | No |
| T-103 | `e2e/bin/run-e2e.sh`, `e2e/helpers/testHelpers.ts`, `e2e/tests/{inbox,share-target,caldav-client,registration}.spec.ts` | Use the runner API port, finish welcome, use email for CalDAV ownership, assert escaped hrefs/date deadlines and explicit SMTP-unavailable errors | No |
| T-103 | `Dockerfile` | Upgrade runtime npm to 11.21.0 and its vulnerable bundled brace-expansion, http-cache-semantics, picomatch and undici packages; retain npx for migrations | No |
| T-201 | `Dockerfile` (`${BUILDPLATFORM:-linux/amd64}`) | builderهای بدون BuildKit (احتمالاً PaaS) `BUILDPLATFORM` را خالی می‌گذارند و بیلد با `failed to parse platform` می‌شکند | No; independent fork |
| T-201 | `.dockerignore` (`deploy/`) | `deploy/data` (DB زنده، uploads، بکاپ) و `deploy/.env` نباید وارد build context شوند | خیر (پوشهٔ `deploy/` فقط در fork است) |
| T-201 | `.github/workflows/docker-publish.yml` | Publish native amd64/arm64 only to the owner's GHCR, remove Docker Hub credentials and external announcements, use own repository for release operations | No |
| T-201 | `.github/workflows/release.yml`, `.github/dependabot.yml` | Disable hosted upstream deploy on this fork and reflect independent maintenance | No |
| T-202 | `.github/workflows/backup-drill.yml` | Weekly and PR recovery proof with disposable synthetic SQLite and log-only artifacts | No |
