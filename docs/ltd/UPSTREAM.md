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
