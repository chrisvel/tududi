# Phase 3 — Persian RTL, Jalali display, six-destination nav, offline identity

Phase 2 is on main. This phase started from current main `5bafdb2f` on `feat/T-301-foundation`. Existing brand commits stay; no new brand work. Spike branches were not merged: the RTL codemod was re-run from `scripts/ltd/rtl-codemod.mjs` (copied from `spike/g3`) onto the current tree.

Source of truth: [PRODUCT_BLUEPRINT.md](../PRODUCT_BLUEPRINT.md) §§12.3–12.5, 13.5, criteria F16/F17, Phase 3 in §24, tasks T-301–T-305. ADR-010 stands: Webpack, Tailwind 3.4, React 18. No Vite, no Tailwind 4, no `date-fns-jalali` (A-09).

## Acceptance evidence

| Task | Status | Evidence / remaining dependency |
| --- | --- | --- |
| T-301 | **GREEN** | `fa` is a full key-complete locale (2972/2972). `direction.ts` sets `dir`/`lang` on `languageChanged` without reload. fa and ar are RTL; other languages stay LTR. Vazirmatn OFL is self-hosted and applied only under `:lang(fa)`. Latin-digit preference is independent of language. `localeCoverage`, `direction`, and `jalali` unit tests passed. |
| T-302 | **GREEN** | Codemod on current frontend: 718 auto, 74 reverse, 27 icon, 15 translate; second pass 0 auto. Manual RTL: sidebar chevrons `rtl:-scale-x-100`, inbox handmade SVG, `paddingInlineStart` / `borderInlineStartColor`, `bdi` on Goal/Tag/Person/Candidate/WrapUp/Inbox, Insights charts `dir=ltr`, Notes MarkdownEditor `dir=ltr` (CodeMirror left-anchored handles — leftover, see below). Local ESLint rule `ltd/no-physical-classes` on `frontend/components`. |
| T-303 | **GREEN** (unit) | `jalali.ts` is Intl-only (`fa-IR-u-ca-persian`, optional `nu-latn`). `calendarSystem` is independent of language and lives in `ui_settings.locale`. Storage and API stay ISO Gregorian. Jalali week start is Saturday (`PERSIAN_WEEK_START = 6`). Esfand length comes from ICU, not a Nowruz table. DatePicker uses the Jalali month grid when the preference is Persian. |
| T-304 | **GREEN** | Desktop six destinations (Today / Plan / Goals / Life / Inbox / Review). Mobile: Today / Plan / Capture / Goals / More. Shortcuts T/P/G/L/I/R skip `input`/`textarea`/`contenteditable`. Life and Review are route+label stubs only. Capture phone FAB is hidden; capture is the mobile center button. LtdNav unit tests: 3/3. |
| T-305 | **GREEN** (real-phone install still **BLOCKED**) | `backend/modules/ltd-idempotency/` + `safeCreateTable` migration `ltd_idempotency_keys`. Client `uid` (nanoid alphabet, length 15) on POST `/task`. `Idempotency-Key` on create/update. SW clones the request before `fetch`, catches `sync.register`, and honors `REPLAY_QUEUE`. Session queue is keyed by `user.uid`. `storage.persist()` after install. Trust proxy / cookie Secure: reviewed, no change. Isolated migration up/down on `/tmp/ltd-mig-test.sqlite3` succeeded (idempotent second up). Integration: 7/7 (re-run recorded below). |

## Codemod counts

```text
first pass:  718 auto, 74 reverse, 27 icon, 15 translate
second pass: 0 auto
```

Spike `spike/g3` was not cherry-picked and was not merged.

## Translation leftover

- `public/locales/fa/translation.json` is a full Persian assembly of six parts (2972 keys). Formal-friendly tone; product terms (API, MCP, OIDC, CalDAV, Telegram, PWA) stay English where that is how Persian users say them.
- Other locales received English placeholders for historically missing keys so the shared key set matches `en`. Those are not human-reviewed translations.
- Notes MarkdownEditor stays `dir=ltr` because CodeMirror's selection handles are left-anchored. Recorded as a known leftover, not a silent skip.
- Insights charts stay `dir=ltr` so axes do not flip.

## Trust proxy / cookies

`TUDUDI_TRUST_PROXY` and cookie `Secure` were reviewed against the Phase 2 deployment notes. No change was required.

## Real-phone install

**BLOCKED.** F17 on a physical Android/iOS device is out of scope for this phase and is not marked GREEN.

## Scope and exclusions

- Spike branches were not merged or pushed. The G3 codemod was re-run on current main.
- Brand assets already on main were left as-is; no new brand work was committed in this phase.
- Phase 4 was not started: no `parent_goal_id`, Metric, three signals, Journal, GoalTree, weekly plan, fullscreen Focus, Recovery, life timeline body, OAuth, or Google Calendar API.
- Energy frame / schedule buffer / capacity warning were not built.
- restic / public domain / G6 post were not done.
- `date-fns-jalali` was not installed.
- `.env`, `deploy/.env`, `deploy/data`, tokens, SQLite databases, and `graphify-out/` were not committed.
- `docs/ltd/.tmp-fa/` is gitignored scratch and is not in the PR.

## Playwright / browser

Run via `e2e/bin/run-e2e.sh` (frontend `:4180`, backend `:3310`), Chromium.

```text
ltd-nav: desktop bar + mobile More — passed
rtl-f16: five pages, fa rtl / en ltr, no horizontal overflow — passed
offline-idempotency: two creates + one edit replay as exactly two tasks — passed
axe-f16: no new serious/critical — passed
```

`html-has-lang` was fixed: `i18n.init()` can emit `languageChanged` before the direction listener is attached, so a full navigation left `<html>` without `lang`/`dir`. Direction is applied again when init resolves. Default `lang="en" dir="ltr"` is on the document.

Vazirmatn `@font-face` lives in `public/fonts/vazirmatn/vazirmatn.css`. Webpack css-loader cannot resolve root-absolute `url()` from `tokens.css` and failed the dev compile.

Inherited axe findings, logged and not treated as Phase 3 regressions: `button-name`, `color-contrast`, `label`, and moderate `meta-viewport` (zoom disabled in the existing viewport meta).

Screenshot directory: `docs/ltd/phases/phase-3-shots/` (`desktop|mobile` × `fa|en` × today, plan, goals, inbox, settings).

The dev server registers `/sw.js?push-only` so the offline queue does not fight hot reload. The offline spec sets `localStorage.ltd-e2e-full-sw=1` and reloads so the full worker controls the page, then posts `REPLAY_QUEUE`.

## Completion gate

Merge requires the unit/integration evidence above, the four Playwright specs GREEN or an explicit BLOCKED with cause, and no secrets/spike files in the PR. After merge, stop. Do not start Phase 4.
