# Fork provenance and independent maintenance

Life-to-Day continues from the tududi fork chosen in Phase 0. The owner has since explicitly requested independent development: no automatic upstream sync, upstream-first PR policy, hosted tududi deployment or shared image namespace. This supersedes the monthly sync policy originally recorded for T-102. Source attribution and history remain intact; Life-to-Day branding is recorded under T-301 below.

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

## T-301 presentation boundary

<!-- LTD-PATCH(T-301): Inventory the presentation-only fork patch and its verification. -->

Identity and presentation only. Task, goal, habit and planning logic are unchanged. Existing `TUDUDI_*` environment variables, cookie/session/storage keys, npm script names, license and attribution remain intact. JSON and binary files cannot carry `//` comments; their patch marker is this inventory.

The bundled `public/generate-favicon.html` only writes PNG, not ICO. It now previews the supplied PNG instead of drawing the old symbol. No ICO encoder or dependency was added: the old ICO files are retained, while the document, static cache and push badge use the new PNGs. No preview artwork was installed.

| Task | File | Why | Upstream PR |
| --- | --- | --- | --- |
| T-301 | `README.md` | Introduce the independent product and deployment/docs links, retain MIT attribution | No; independent fork |
| T-301 | `backend/app.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/config/config.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/config/swagger.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/auth/passwordResetService.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/auth/registrationService.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/blog/hostSwitch.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/caldav/protocol/discovery.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/caldav/webdav/projects.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/caldav/webdav/propfind.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/mcp/controller.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/mcp/httpTransport.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/mcp/server.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/mcp/tools/projectTools.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/mcp/tools/taskTools.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/telegram/service.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/modules/telegram/telegramPoller.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/services/seatsService.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `backend/services/trialLifecycleService.js` | Replace visible brand labels and document titles; preserve protocols, routes and authentication | No; independent fork |
| T-301 | `frontend/Layout.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/About.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Admin/AdminBlogSettings.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Admin/AdminDashboardPage.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Auth/AuthPageShell.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Auth/OIDCCallback.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Billing/SubscriptionRequired.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Billing/TrialBanner.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Blog/BlogCta.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Blog/BlogIndexPage.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Blog/BlogLayout.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Blog/BlogPostPage.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/CalDAV/CalendarForm.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/CalDAV/ConflictResolver.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/CalDAV/EditCalendarModal.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Calendar.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/CalendarFeeds/CalendarFeedsManager.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/AgendaList.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/CandidateList.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/DayTimeline.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/NowCard.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/PlanMyDay.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/TodayPage.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/TodayPlanned.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/DailyPlan/TodayUnplanned.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Feedback/FeedbackModal.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Login.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Navbar.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Notes.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Onboarding/Welcome.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/People/PersonDetails.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Profile/tabs/CalendarFeedsTab.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Profile/tabs/McpTab.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Profile/tabs/PushDeviceCard.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Profile/tabs/TelegramTab.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/PublicNote/PublicNotePage.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Register.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Shared/NewItemButton.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Sidebar.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Sidebar/SidebarFooter.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Sidebar/SidebarNav.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Sidebar/SidebarRail.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/Task/TaskRow/TaskRowCollapsed.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/components/UniversalSearch/SearchMenu.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/constants/formClasses.ts` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/styles/tailwind.css` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `package.json` | Update name and description only; preserve scripts and dependencies | No; independent fork |
| T-301 | `public/apple-touch-icon.png` | Install supplied final brand asset without altering artwork | No; independent fork |
| T-301 | `public/favicon-16.png` | Install supplied final brand asset without altering artwork | No; independent fork |
| T-301 | `public/favicon-32.png` | Install supplied final brand asset without altering artwork | No; independent fork |
| T-301 | `public/favicon.png` | Install supplied final brand asset without altering artwork | No; independent fork |
| T-301 | `public/generate-favicon.html` | Preview the supplied favicon geometry; the existing tool remains PNG-only | No; independent fork |
| T-301 | `public/icon-logo.png` | Install supplied final brand asset without altering artwork | No; independent fork |
| T-301 | `public/index.html` | Brand document title and theme; remove UI Lora declarations and use supplied PNG favicons | No; independent fork |
| T-301 | `public/locales/ar/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/bg/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/da/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/de/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/el/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/en/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/es/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/fi/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/fr/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/id/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/it/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/jp/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/ko/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/nl/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/no/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/pl/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/pt/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/ro/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/ru/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/sk/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/sl/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/sv/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/tr/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/ua/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/vi/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/locales/zh/translation.json` | Replace brand prose and appName values; retain existing translation keys, add shared brand copy | No; independent fork |
| T-301 | `public/manifest.json` | Life-to-Day install metadata; separate any and maskable entries use the same 1024px square icon | No; independent fork |
| T-301 | `public/sw.js` | Invalidate the old static cache and brand push title/icon/badge; preserve offline keys | No; independent fork |
| T-301 | `public/wide-logo-dark.png` | Install supplied final brand asset without altering artwork | No; independent fork |
| T-301 | `public/wide-logo-light.png` | Install supplied final brand asset without altering artwork | No; independent fork |
| T-301 | `tailwind.config.js` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `webpack.config.js` | Brand document/cache builds and serve edited locales from local public assets during development | No; independent fork |
| T-301 | `frontend/components/Shared/BrandMark.tsx` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |
| T-301 | `frontend/styles/tokens.css` | Apply shared typography, colors and geometry; simplify auth, sidebar and Today without new features | No; independent fork |

### Verification (2026-10-11)

- `npm run build`: TypeScript and webpack passed.
- `npm run lint`: passed with 12 existing backend test assertion warnings, no errors.
- Existing frontend suites for Login, TodayPage, CandidateList, SidebarNav and SidebarFooterLauncher: 41 tests passed (`--runInBand --watchman=false`).
- Every locale parses as JSON; existing keys retained and appName/prose no longer contain the old product name. Copied PNGs match their brand sources byte for byte. Inline mark paths, circle and 28px size match the supplied SVG.
- Browser on requested `:8080` showed Adminer, an unrelated existing service. It was left running. Verification used `:8081`, connected to the actual Express app on `:3311` with synthetic data in SQLite `:memory:`. The verification launcher bypassed dotenv loading and startup migrations/schedulers; no existing database or `.env` was changed.
- Exercised form login, expanded and collapsed sidebar (including expansion), Today, All Tasks, both appearances, and register password-mismatch validation. Completed the synthetic Now task: Today changed from 0/1 to 1/1, and All Tasks with active filter no longer showed it. No old product name was visible on these screens.
- Console/network inspected. Observed `/api/billing` 404 on the self-hosted configuration, unauthenticated `/api/profile` 401, and 401 refetches after logout. These existing authentication/billing behaviors were left outside this presentation patch. No successful registration email, live account, integration delivery or browser session against the owner's existing database was tested.


## Phase 3 patches (T-301 i18n through T-305)

JSON and font files cannot carry `//` comments; their patch marker is this inventory. New files under `backend/modules/ltd-idempotency/`, `frontend/utils/{direction,jalali,offlineIdentity}.ts`, `frontend/components/{Nav,Life,Reviews}/` and `e2e/tests/{rtl-f16,ltd-nav,offline-idempotency,axe-f16}.spec.ts` are fork-only and are not inherited tududi core.

| تسک | فایل | چرا | PR به upstream |
|---|---|---|---|
| T-301 | `public/locales/ar/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/bg/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/da/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/de/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/el/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/en/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/es/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/fa/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/fi/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/fr/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/id/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/it/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/jp/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/ko/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/nl/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/no/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/pl/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/pt/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/ro/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/ru/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/sk/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/sl/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/sv/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/tr/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/ua/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/vi/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/locales/zh/translation.json` | Add navigation.ltd + calendar keys; fa is full Persian; others keep English placeholders for missing keys | No; independent fork |
| T-301 | `public/fonts/vazirmatn/*` | Self-hosted Vazirmatn OFL; applied only when lang=fa | No; independent fork |
| T-301 | `.gitignore` | Ignore docs/ltd/.tmp-fa translation scratch | No; independent fork |
| T-302 | `eslint-rules/ltd-no-physical-classes.mjs` | Local ESLint rule; no new lint dependency | No; independent fork |
| T-302 | `scripts/ltd/rtl-codemod.mjs` | Re-run of spike/g3 codemod on current main; spike not merged | No; independent fork |
| T-305 | `package.json` / `package-lock.json` | axe-core 4.14.0 for F16 behavioral a11y | No; independent fork |
| T-305 | `backend/app.js` | offline queue clone-before-fetch, session uid, Idempotency-Key replay | No; independent fork |
| T-305 | `backend/modules/tasks/routes.js` | offline queue clone-before-fetch, session uid, Idempotency-Key replay | No; independent fork |
| T-303 | `backend/modules/users/service.js` | Jalali display via Intl; storage stays ISO Gregorian | No; independent fork |
| T-305 | `backend/tests/helpers/setup.js` | offline queue clone-before-fetch, session uid, Idempotency-Key replay | No; independent fork |
| T-305 | `frontend/App.tsx` | offline queue clone-before-fetch, session uid, Idempotency-Key replay | No; independent fork |
| T-304 | `frontend/App.tsx` | six-destination nav + mobile bar; existing pages stay reachable | No; independent fork |
| T-304 | `frontend/Layout.tsx` | six-destination nav + mobile bar; existing pages stay reachable | No; independent fork |
| T-302 | `frontend/components/AI/ProjectAIInsights.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminAiUsagePage.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminBillingPage.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminFeedbackPage.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminGroupsPanel.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminRolesPanel.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminTrends.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminUserFilter.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminUserStatusTable.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminUsersPage.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Admin/AdminWaitlistPage.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Area/AreaDetails.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Area/AreaHero.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Area/AreaModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Areas.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Backup/BackupRestore.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Billing/UpgradeModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/CalDAV/CalendarCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/CalDAV/SyncStatusIndicator.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Calendar/CalendarDayView.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Calendar/CalendarMonthView.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Calendar/CalendarWeekView.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Capture/CaptureFiles.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-304 | `frontend/components/Capture/CaptureHost.tsx` | six-destination nav + mobile bar; existing pages stay reachable | No; independent fork |
| T-302 | `frontend/components/Capture/CaptureHost.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/DailyPlan/CandidateList.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/DailyPlan/DurationChips.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/DailyPlan/NotPlannedDrawer.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/DailyPlan/PlanList.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/DailyPlan/PlanTips.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/DailyPlan/WrapUpCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Eisenhower/EisenhowerMatrix.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Everyone/EveryoneDashboard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Focus/FocusChip.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Focus/FocusPopover.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Goal/GoalDetails.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Goal/GoalHero.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Goal/GoalRow.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Habits/HabitDetails.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Habits/HabitHeatmap.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Habits/Habits.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Inbox/InboxItemAttachments.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Inbox/InboxItemDetail.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Inbox/InboxItems.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Inbox/InboxSelectedChips.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Inbox/QuickCaptureInput.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Inbox/SuggestionsDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Insights/LifeBalance.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Insights/ReportsPage.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Kanban/KanbanBoard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-303 | `frontend/components/Navbar.tsx` | Jalali display via Intl; storage stays ISO Gregorian | No; independent fork |
| T-302 | `frontend/components/Note/MarkdownEditor.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Note/NoteEditorView.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Note/NoteFocusMode.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Note/NoteModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Note/NoteSidePanel.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Note/PublicShareModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Note/SlashCommandMenu.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Note/WikilinkMenu.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Notifications/NotificationsDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/People/PeopleList.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/People/PersonHero.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/People/PersonRow.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/People/SignInLinkModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Productivity/ProductivityAssistant.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/ProfileSettings.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/SidebarLayoutEditor.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/AIAssistantTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/ApiKeysTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/AppearanceTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/BillingTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/CalDAVTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/ConnectedAccounts.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/FeaturesTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-301 | `frontend/components/Profile/tabs/GeneralTab.tsx` | fa locale, document direction without reload, Vazirmatn for lang=fa | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/KeyboardShortcutsTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/NotificationsTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/OIDCTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/OidcProviderConfig.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/PlanningTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/SecurityTab.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Profile/tabs/TabsNav.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/BannerEditModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/ProjectAttachmentsWidget.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/ProjectBanner.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/ProjectDetails.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/ProjectHero.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/ProjectItem.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/ProjectOverviewRail.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Project/ProjectsListSettings.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Projects.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/PublicNote/PublicNoteArticle.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/AreaDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/AttachmentCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/AttachmentViewer.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/AttachmentsPanel.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/BackButton.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/BannerBadge.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/BlankSlate.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/Breadcrumbs.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/CalloutBlock.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/ConfirmDialog.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-303 | `frontend/components/Shared/DatePicker.tsx` | Jalali display via Intl; storage stays ISO Gregorian | No; independent fork |
| T-302 | `frontend/components/Shared/DateTimePicker.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/DiscardChangesDialog.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/EntityCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/FilterDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/FirstDayOfWeekDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/GoalDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/IconSortDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-301 | `frontend/components/Shared/LanguageDropdown.tsx` | fa locale, document direction without reload, Vazirmatn for lang=fa | No; independent fork |
| T-302 | `frontend/components/Shared/LoadingSpinner.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/MarkdownRenderer.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/NoteCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/NumberSelectDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/PersonDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/PomodoroTimer.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/PriorityDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/ProjectDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/ProjectStateDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/RecurrenceSelectDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/SelectMenu.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/ShareModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/SortFilterButton.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/TimezoneDropdown.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/ToastContext.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Shared/ToggleSwitch.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/SidePanel/EntitySidePanel.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarAdmin.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarAreas.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarBookmarks.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarGoals.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarHabits.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarNotes.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarNotesTree.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarPeople.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarProjects.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarResizeHandle.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarTags.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Sidebar/SidebarViews.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Tag/TagDetails.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Tag/TagHero.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Tag/TagInput.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Tag/TagModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Tag/TagRow.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Tags.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/CommentComposer.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/GroupedTaskList.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/NewTask.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/RecurrenceDisplay.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskComments.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskAreaCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskContentCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskDeferUntilCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskDueDateCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskGoalCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskProjectCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskRecurrenceCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskRecurringInstanceInfo.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskRelationsCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskSubtasksCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskDetails/TaskTagsCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskForm/TaskRecurrenceSection.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskRow/TaskRowExpanded.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskRow/index.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/TaskStatusControl.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Task/__tests__/TaskStatusControl.test.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Tasks.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Templates/MarketplacePreviewModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Templates/MarketplaceTemplateCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Templates/MarketplaceTemplates.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Templates/TemplateCard.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Templates/TemplateCloneModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Templates/TemplatePreviewModal.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/UniversalSearch/SearchResults.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/UniversalSearch/UniversalSearch.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/View/ViewRow.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/ViewDetail.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-302 | `frontend/components/Views.tsx` | logical Tailwind / RTL chevron / inline-start / bdi; no physical-direction classes | No; independent fork |
| T-301 | `frontend/i18n.ts` | fa locale, document direction without reload, Vazirmatn for lang=fa | No; independent fork |
| T-303 | `frontend/utils/dateUtils.ts` | Jalali display via Intl; storage stays ISO Gregorian | No; independent fork |
| T-303 | `frontend/utils/profileService.ts` | Jalali display via Intl; storage stays ISO Gregorian | No; independent fork |
| T-305 | `frontend/utils/swUtils.ts` | offline queue clone-before-fetch, session uid, Idempotency-Key replay | No; independent fork |
| T-305 | `frontend/utils/tasksService.ts` | offline queue clone-before-fetch, session uid, Idempotency-Key replay | No; independent fork |
| T-305 | `public/sw.js` | offline queue clone-before-fetch, session uid, Idempotency-Key replay | No; independent fork |

## Phase 4 planning domain

<!-- LTD-PATCH(T-401): Keep the additive planning boundary reviewable against upstream. -->

JSON translation files cannot contain JavaScript comments; their patch markers are recorded here. No spike branch was merged. No upstream pull request was created.

| Task | File | Why | Upstream PR |
| --- | --- | --- | --- |
| T-401 | `backend/models/goal.js` | Extend the existing horizons without replacing season/year; additive parent, period and achievement fields | No; fork planning domain |
| T-401 | `backend/models/task.js` | Index the existing nullable goal link for projections | No |
| T-401 | `backend/models/project.js` | Index the existing nullable goal link for projections | No |
| T-401 | `backend/models/index.js` | Register parent/child and metric/check-in associations and fork domain models | No |
| T-401 | `backend/modules/goals/service.js` | Validate graph rules in the service transaction; explicit human achievement and journaled edits | No |
| T-401 | `backend/tests/upgrade/legacy-sqlite-upgrade.test.js` | Assert additive planning schema, old values and default, and migration idempotence on legacy fixtures | No |
| T-402 | `backend/app.js` | Mount thin planning routers under the existing API prefixes, before generic goal UID routes | No |
| T-403 | `backend/models/index.js` | Invalidate disposable projection snapshots for task, habit, goal, project and schedule mutations | No |
| T-403 | `.github/workflows/ci.yml` | Enforce at least 90% statements, branches, functions and lines for progress and journal | No |
| T-404 | `backend/modules/goals/controller.js` | Infer journal actor from authentication and deny integration hard deletion | No |
| T-404 | `backend/tests/helpers/setup.js` | Clean planning children before goal/user parents in both database engines | No |
| T-405 | `frontend/entities/Goal.ts` | Six optional horizons and additive hierarchy/period fields | No |
| T-405 | `frontend/components/Goals.tsx` | Add a horizon tree while retaining existing goal list, filters and creation flow | No |
| T-405 | `frontend/components/Goal/GoalModal.tsx` | Expose horizons, parent and editable periods; revalidate all planning projections | No |
| T-405 | `frontend/components/Goal/GoalDetails.tsx` | Show computed A/O, metrics, history and reversible journal entries | No |
| T-405 | `frontend/components/Goal/GoalHero.tsx` | Replace the misleading task-count progress display with separate computed signals | No |
| T-405 | `frontend/components/Task/TaskRow/TaskRowCollapsed.tsx` | Render the server why-chain on task cards with isolated user text | No |
| T-405 | `frontend/utils/tasksService.ts` | Revalidate planning reads after task mutations | No |
| T-405 | `public/locales/*/translation.json` | Add planning strings, Persian copy and English fallback keys to all locales | No |
| T-406 | `frontend/App.tsx` | Route weekly goal priorities inside the existing planning shell | No |
| T-407 | `backend/modules/mcp/tools/goalTools.js` | Shared owner-scoped tree, progress, vision and contribution reads; no goal write tools | No |
| T-407 | `backend/modules/mcp/toolRegistry.js` | Deny registration and execution of legacy hard-deletion tools in both transports | No |
| T-407 | `backend/modules/mcp/controller.js` | Reflect the read-only goal catalogue and deletion restrictions | No |
| T-407 | `backend/modules/mcp/httpTransport.js` | Return a protocol tool error for denied or unknown tool calls | No |
| T-407 | `backend/modules/mcp/server.js` | Apply the same denied-tool behavior to the stdio transport | No |
| T-407 | `backend/tests/integration/mcp/mcp-tools.test.js` | Assert that denied deletions preserve records and existing reads remain compatible | No |
| T-407 | `backend/tests/integration/mcp/mcp-routing.test.js` | Include the planning category in the exposed catalogue | No |
| T-407 | `backend/tests/unit/modules/mcp/controller.test.js` | Verify the catalogue excludes destructive operations and includes planning reads | No |
| T-406 | `frontend/components/DailyPlan/PlanMyDay.tsx` | Make weekly priorities reachable directly from the existing Plan tab | No |
| T-406 | `frontend/components/Nav/LtdNav.tsx` | Keep the Plan destination active and accessible for day and week routes | No |
| T-406 | `frontend/components/Nav/__tests__/LtdNav.test.tsx` | Assert desktop and mobile active Plan state on the weekly route | No |
| T-405 | `frontend/i18n.ts` | Resolve translation reloads from the app base rather than nested goal/week URLs | No |
| T-405 | `frontend/App.tsx` | Avoid fetching an undefined locale during nested-route bootstrap | No |
| T-405 | `public/locales/*/translation.json` | Add keys the UI used but no locale defined (English placeholders outside en/fa); `task.attachments` becomes an object with its old text under `title` | No |
| T-405 | `frontend/components/Task/TaskDetails/TaskDetailsHeader.tsx` | Read the attachments label from `task.attachments.title` | No |
| T-405 | `frontend/components/Project/ProjectModal.tsx`, `frontend/components/Task/TaskRow/index.tsx` | Pass interpolation values so the locale strings can show the limit and task name | No |

## Phase 5 daily execution

Capacity (T-501), Focus (T-502), starter step (T-503), Recovery and Overwhelmed (T-504), Capture and contribution (T-505), first run (T-506). New code lives in `backend/modules/ltd-planner`, `backend/modules/ltd-focus`, `frontend/components/FocusMode` and `frontend/components/Recovery`; the rows below are the core touch points. `backend/modules/daily-plan` is unchanged. No upstream pull request was created.

| Task | File | Why | Upstream PR |
| --- | --- | --- | --- |
| T-501 | `backend/app.js` | Mount the ltd-planner (capacity, Recovery, contribution) and ltd-focus routes | No |
| T-501 | `frontend/components/DailyPlan/PlanMyDay.tsx` | Show the server capacity bar (window, busy, buffers, f) under the planner header | No |
| T-501 | `frontend/components/DailyPlan/TodayPage.tsx` | Capacity bar, Focus mode, Lighten/Overwhelmed and the contribution card on Today | No |
| T-502 | `backend/models/index.js` | Register `LtdFocusSession` and its user/task associations | No |
| T-502 | `frontend/components/Shared/PomodoroTimer.tsx` | Derive time left from the start timestamp via the shared Pomodoro clock instead of a counting interval | No |
| T-502 | `frontend/components/DailyPlan/TodayPlanned.tsx` | Pass Focus start and resume through to the Now card | No |
| T-502 | `backend/tests/upgrade/legacy-sqlite-upgrade.test.js` | Assert the Phase 5 migration on real legacy fixtures | No |
| T-503 | `backend/models/task.js` | Nullable `starter_step` attribute | No |
| T-503 | `backend/modules/tasks/core/parsers.js` | Validate `starter_step` (text, at most 500 characters, empty clears) | No |
| T-503 | `backend/modules/tasks/core/builders.js` | Accept `starter_step` on task create and update | No |
| T-503 | `frontend/entities/Task.ts` | `starter_step` field | No |
| T-503 | `frontend/components/DailyPlan/NowCard.tsx` | Starter step or five-minute start first; Focus and Continue buttons | No |
| T-503 | `frontend/components/Task/TaskDetails.tsx` | Starter step field in task editing | No |
| T-503 | `frontend/components/Task/TaskDetails/index.ts` | Export the starter step card | No |
| T-504 | `backend/modules/push/service.js` | Send no push while Overwhelmed mode is active (ends at the end of the local day) | No |
| T-504 | `backend/config/db.js` | SQLite transactions start IMMEDIATE so concurrent read-then-write transactions wait instead of failing with SQLITE_BUSY | No |
| T-505 | `frontend/components/Nav/LtdNav.tsx` | `C` opens the shared capture box on the Inbox, outside inputs, textareas and contenteditable | No |
| T-505 | `frontend/components/Nav/__tests__/LtdNav.test.tsx` | Capture shortcut and typing-target guard tests | No |
| T-506 | `frontend/components/Onboarding/Welcome.tsx` | The existing /welcome page becomes three skippable first-run steps ending at the Now card | No |
| T-506 | `frontend/components/Onboarding/__tests__/Welcome.test.tsx` | Tests for the three steps, skipping and defaults | No |
| T-506 | `public/locales/*/translation.json` | Phase 5 strings: Persian and English copy, English fallback in other locales | No |
| T-503 | `frontend/components/Task/__tests__/TaskDetails.test.tsx` | Include the starter step card in the mocked card set | No |

## Phase 6 Life timeline

Milestones (T-601) and the Life timeline with the Vision editor (T-602). New code lives in `backend/modules/ltd-milestones`, `backend/models/ltd_milestone.js`, `frontend/components/LifeTimeline`, `frontend/utils/timeline.ts` (PORT from lifeGLANCE, see THIRD_PARTY_NOTICES.md) and `frontend/utils/milestonesService.ts`; `frontend/components/Life/LifePage.tsx` and `backend/modules/ltd-journal` are Life-to-Day files. The rows below are the core touch points. No upstream pull request was created.

| Task | File | Why | Upstream PR |
| --- | --- | --- | --- |
| T-601 | `backend/app.js` | Mount the ltd-milestones routes | No |
| T-601 | `backend/models/index.js` | Register `LtdMilestone` and its user/goal associations | No |
| T-601 | `backend/tests/helpers/setup.js` | Clean `ltd_milestones` before goals and users between tests | No |
| T-601 | `backend/tests/upgrade/legacy-sqlite-upgrade.test.js` | Assert the Phase 6 table and foreign keys on real legacy fixtures | No |
| T-602 | `public/locales/*/translation.json` | Phase 6 strings (`ltdLife`): Persian and English copy, English fallback in other locales | No |
