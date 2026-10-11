# UPSTREAM — نگهداری fork

Life-to-Day یک fork از [`chrisvel/tududi`](https://github.com/chrisvel/tududi) است. این فایل سیاست همگام‌سازی با upstream و فهرست تغییرات هستهٔ tududi (LTD-PATCH) را نگه می‌دارد. مرجع: `PRODUCT_BLUEPRINT.md` §۲۵.۴ و §۲۵.۵.

## وضعیت

| مورد | مقدار |
|---|---|
| remote | `upstream` = `https://github.com/chrisvel/tududi.git` |
| پایهٔ کد در `main` (merge-base) | `a47c41135e996da5ad3258731c499528bba8c89a` (`v1.8.2-4-ga47c4113`) |
| `upstream/main` هنگام نوشتن (`git rev-parse upstream/main`، 2026-10-11) | `f270f38f6247b6c462ba3b10de73e7dd9e6e6ff7` (`v1.9.1`)، ۴ commit جلوتر از پایه؛ هنوز merge نشده |
| آخرین sync | هنوز انجام نشده |

## همگام‌سازی (ماهانه، یا هنگام release امنیتی upstream)

```bash
git fetch upstream
git switch -c sync/upstream-$(date +%Y-%m) main
git merge --no-ff upstream/main          # merge، نه rebase؛ تاریخچهٔ fork حفظ می‌شود
bash scripts/ltd-patches.sh              # فهرست LTD-PATCHها برای بازبینی تعارض
npm ci && npm test && npm run frontend:test && npm run test:ui
```

سپس PR به `main` باز کنید و بعد از merge، جدول «وضعیت» را به‌روز کنید.

## قواعد

- **شاخه:** هر sync روی `sync/upstream-YYYY-MM` و فقط با PR وارد `main` می‌شود.
- **merge `--no-ff`، نه rebase.** تاریخچهٔ `main` بازنویسی نمی‌شود.
- **بعد از merge:** اول `scripts/ltd-patches.sh`، سپس `npm ci` و تست‌ها.
- **هر تغییر در هستهٔ tududi** (هر فایلی بیرون از `backend/modules/ltd-*` و کامپوننت‌های جدید Life-to-Day) یک کامنت `// LTD-PATCH(T-xxx): why` در کد دارد و یک سطر در جدول زیر.
- **کد spike به `main` نمی‌آید.** شاخه‌های `spike/*` دورریختنی‌اند.
- **upstream-first:** تغییرات عمومی (RTL، locale `fa`، `parent_goal_id`، uid آفلاین) اول به‌صورت PR به `chrisvel/tududi` ارائه می‌شوند.

## فهرست LTD-PATCH

Phase 1 CI repairs are listed below. The deployment draft for T-201 remains stashed until Phase 1 checks pass.

| تسک | فایل | چرا | PR به upstream |
|---|---|---|---|
| T-103 | `package.json`, `package-lock.json` | Raise the MCP SDK security floor to 1.32.1 and update proxy-addr to 2.0.8; no bulk audit fix | No |
| T-103 | `jest.config.js`, `babel.config.js` | Transform Markdown ESM dependencies in Jest and keep React Refresh out of tests | No |
| T-103 | `frontend/components/Shared/__tests__/MermaidDiagram.test.tsx`, `frontend/components/Admin/__tests__/roleLabels.test.ts` | Align stale expectations with the existing neutral theme and hosted role wording; product behavior unchanged | No |
| T-103 | `e2e/bin/run-e2e.sh`, `e2e/helpers/testHelpers.ts`, `e2e/tests/{inbox,share-target,caldav-client,registration}.spec.ts` | Use the runner API port, finish welcome, use email for CalDAV ownership, assert escaped hrefs/date deadlines and explicit SMTP-unavailable errors | No |
| T-103 | `Dockerfile` | Upgrade runtime npm to 11.21.0 and its vulnerable bundled brace-expansion, http-cache-semantics, picomatch and undici packages; retain npx for migrations | No |
