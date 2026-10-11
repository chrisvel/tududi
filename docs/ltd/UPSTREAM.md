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

هنوز هیچ patchی در هسته نیست؛ `bash scripts/ltd-patches.sh` خروجی خالی می‌دهد.

| تسک | فایل | چرا | PR به upstream |
|---|---|---|---|
| — | — | — | — |
