# DECISION — قفل تصمیم فاز ۰ (T-007)

| مورد | مقدار |
|---|---|
| تاریخ | 2026-10-11 |
| upstream آزموده‌شده | `chrisvel/tududi` `222460fa9462b7ddeaa00fefa35685b1f77d6126` (v1.9.0) |
| مخزن محصول | `DanialMasghati/life-to-day` (fork واقعی `chrisvel/tududi`)؛ `main` = `e7b290edeeb02ea64d721b7b972f47491d7800d2` پیش از commit این گزارش‌ها |
| کد spike | فقط روی شاخه‌های محلی `spike/g1` تا `spike/g5`. **هیچ‌کدام به `main` merge یا push نشده است.** |

## دروازه‌ها

| دروازه | وضعیت | شاهد اصلی | SHA شاخه | تاریخ |
|---|---|---|---|---|
| G1 baseline | **GREEN** (iCal: BLOCKED) | بازیابی روی پوشهٔ خالی: سطرها و API یکسان؛ Claude Code 2.1.296 ← `mcp__tududi__list_tasks` ← 5 تسک واقعی | `spike/g1` `0815a537dbcd8c3154f5a599725af4aea9c3549f` | 2026-10-10 |
| G2 سلسله‌مراتب اهداف | **GREEN** | 277/277 suite، 4021 تست پاس؛ migration فقط `ADD COLUMN` (up/down/up روی DB واقعی)؛ roll-up 500 هدف: 11.25ms، 0 ناهمخوانی | `spike/g2` `6eb441fb44269254fb418e064a997908c6a19464` | 2026-10-10 |
| G3 هزینهٔ RTL | **GREEN** (حاشیهٔ باریک) | 877 تغییر خودکار، 21 اصلاح دستی در ۵ صفحه؛ تخمین باقی‌مانده 2.5 روز (۵ صفحه) و **7.5 روز** (کل frontend، بازه 6 تا 9.5)؛ تست‌های frontend بدون شکست تازه | `spike/g3` `f61c0b782be69313ef1eadd2f7143dc811e13230` | 2026-10-11 |
| G4 OAuth و MCP راه‌دور | **YELLOW** (ChatGPT: BLOCKED) | `oidc-provider` 9.12.2 داخل Express؛ 23/23 بررسی قراردادی HTTP؛ claude.ai به‌خاطر حساب و HTTPS عمومی وصل نشد | `spike/g4` `11503e61103d6f37b363dffdee0ab330564785bf` | 2026-10-11 |
| G5 PWA آفلاین | **GREEN** برای «رفتار ثبت شد» (Android و iOS: BLOCKED) | A-08 درست؛ صف آفلاین **بدنهٔ خالی** ذخیره می‌کند؛ پاسخ گم‌شده ← **2 سطر** برای یک کنش | `spike/g5` `ceef057eba7ae631d5f837a885de80e7dd7b376b` | 2026-10-11 |
| G6 upstream | **DRAFT** | متن آماده در `G6.md`؛ پست نشده | — | 2026-10-11 |

قاعدهٔ سند (§1.5 و §24): G2 یا G3 قرمز ← Fallback E. هیچ‌کدام قرمز نیست.

## تصمیم

الف) ادامه با fork tududi. فاز بعدی مجاز: فاز ۳ فقط بعد از تمام شدن فاز ۱ و ۲.

## ADRها

| ADR | وضعیت | شاهد (یک خط) |
|---|---|---|
| ADR-001 پایه = fork tududi | Accepted | G1، G2 و G3 سبز: اجرا، بکاپ و MCP بدون تغییر کار کرد؛ سلسله‌مراتب با 55 خط در هسته؛ RTL بدون مهاجرت stack. |
| ADR-002 SSOT = SQLite (WAL) | Accepted | G1: یک فایل `/app/db/production.sqlite3` (WAL) با `sqlite3 .backup` بکاپ و روی پوشهٔ خالی بازیابی شد؛ G2: roll-up روی همان SQLite 11ms. |
| ADR-003 E2EE نیست | Accepted | تصمیم برنامه‌ریزی، در فاز ۰ آزمایش نشده. |
| ADR-004 کنار گذاشتن glance-sync، vault و intents | Accepted | تصمیم برنامه‌ریزی، در فاز ۰ آزمایش نشده. |
| ADR-005 سلسله‌مراتب = توسعهٔ جدول `goals` | Accepted | G2: migration افزایشی، 8 تست قاعده، کل تست‌های upstream و schema parity سبز. |
| ADR-006 سه سیگنال، منطق قطعی | Accepted | تصمیم برنامه‌ریزی، در فاز ۰ آزمایش نشده (فقط query سیگنال فعالیت در G2 سنجیده شد). |
| ADR-007 Journal + Proposal | Accepted | تصمیم برنامه‌ریزی، در فاز ۰ آزمایش نشده (G5 نشان داد نوشتن‌ها idempotent نیستند، که نیاز به این لایه و `ltd_idempotency_keys` را تقویت می‌کند). |
| ADR-008 OAuth AS تعبیه‌شده (`oidc-provider`) | Accepted | G4: در همان فرایند Express، 23/23 قلم قراردادی (DCR با allowlist، PKCE S256، aud، RFC 9207، refresh چرخشی)؛ اتصال واقعی claude.ai هنوز آزموده نشده. |
| ADR-009 Provider abstraction با Vercel AI SDK | Accepted | تصمیم برنامه‌ریزی، در فاز ۰ آزمایش نشده. |
| ADR-010 بدون مهاجرت stack frontend | Accepted | G3: Tailwind 3.4.19 همهٔ utilityهای منطقی و واریانت `rtl:` را دارد؛ RTL ۵ صفحه بدون تغییر stack. |
| ADR-011 Google Calendar مرحله‌ای | Accepted | تصمیم برنامه‌ریزی، در فاز ۰ آزمایش نشده (فید iCal در G1، BLOCKED تا دریافت آدرس). |
| ADR-012 Modular monolith در یک کانتینر | Accepted | G1 یک container؛ G4 همان AS را داخل همان فرایند Express بالا آورد (mount شرطی). |
| ADR-013 نگهداری fork | Accepted | تصمیم برنامه‌ریزی، در فاز ۰ آزمایش نشده (G6 هنوز DRAFT است؛ codemod RTL idempotent است و پس از هر merge قابل اجرای دوباره است). |

## معیار پذیرش فاز ۰ و نتیجه

| معیار (تعریف تمام‌شدن در دستور کار) | نتیجه |
|---|---|
| G1، G2، G3 و G5 وضعیتی غیر از «نانوشته» دارند | ✅ |
| G4 حداقل یک وضعیت مستند دارد | ✅ YELLOW |
| DECISION.md یکی از دو تصمیم الف یا ب را ثبت کرده | ✅ الف |
| شاخهٔ spike به main merge نشده | ✅ (`main` فقط سند و گزارش دارد) |

| معیار سخت‌گیرانه‌تر سند (§24، DoD فاز ۰) | نتیجه |
|---|---|
| G1، G2، G3 و G5 سبز | ✅ با زیرقلم‌های BLOCKED: iCal در G1؛ Android و iOS در G5 |
| G4 حداقل با claude.ai سبز | ❌ هنوز YELLOW: نیاز به حساب و HTTPS شما |
| تصمیم «ادامه یا Fallback» ثبت شده | ✅ |

## فایل‌های شاهد

| دروازه | محل |
|---|---|
| G1 | `spike/g1:scripts/ltd/spike-g1/{seed.sh,restore-drill.sh,restore-drill.txt,mcp-http.json}` |
| G2 | `spike/g2:docs/ltd/spikes/{g2-tests.txt,g2-rollup-bench.json}`، `spike/g2:backend/tests/ltd/goal-hierarchy.test.js` |
| G3 | `spike/g3:docs/ltd/spikes/g3-shots/` (69 اسکرین‌شات)، `g3-count-upstream-v2.json`، `g3-frontend-tests.txt`، `spike/g3:scripts/ltd/rtl-codemod.mjs` |
| G4 | `spike/g4:scripts/ltd/{oauth-contract.mjs,oauth-contract.result.json,backend-tests.txt}` |
| G5 | `spike/g5:scripts/ltd/{pwa-offline.mjs,pwa-offline.result.json,pwa-offline.events.ndjson}` |
| G6 | `docs/ltd/spikes/G6.md` |

## ریسک باز

| ریسک | منبع | یادداشت |
|---|---|---|
| R-06 ChatGPT | G4 | Developer Mode و پلن شما معلوم نیست؛ طبق مستند OpenAI، MCP کامل فقط Business، Enterprise و Edu است. |
| اتصال واقعی claude.ai | G4 | قرارداد محلی پاس شد، ولی کلاینت واقعی آزموده نشد. |
| از دست رفتن داده در صف آفلاین upstream | G5 | `sw.js` بدنه را پیش از صف‌کردن مصرف می‌کند؛ رفع یک‌خطی؛ پیش از هر وعدهٔ «ثبت آفلاین» لازم است. |
| تکرار رکورد بدون idempotency | G5 | retry شبکه روی پاسخ گم‌شده 2 سطر ساخت؛ `uid` کلاینت و `ltd_idempotency_keys` در فاز ۳ Must است. |
| نگهبان «کاربر دیگر» در SW کار نمی‌کند | G5 | `current_user` فیلد `id` ندارد ← همه `"undefined"`؛ باید طبق `SECURITY.md` upstream خصوصی گزارش شود. |
| iOS بدون replay آفلاین | G5 | Background Sync در Safari نیست و مسیر جایگزینی در `sw.js` نیست. |
| حاشیهٔ باریک RTL | G3 | 7.5 در برابر 8 روز؛ پیشنهاد: سقف زمانی در فاز ۳، و بازبینی ADR-001 اگر از ۱۰ روز گذشت. |
| conflict با upstream به‌خاطر RTL | G3، R-01 | codemod 192 فایل را لمس می‌کند؛ کاهش: پذیرش upstream (G6) یا اجرای دوبارهٔ codemod پس از هر merge. |
| لایه‌های اضافه در `app.js` | G4 | از ۱۰۰ لایهٔ همزمان Express رد شد و تست‌های fake-timer upstream را شکست؛ هر ماژول جدید باید mount شرطی یا ادغام‌شده داشته باشد. |
| PostgreSQL آزموده نشد | G2 | شاخهٔ `ALTER TYPE … ADD VALUE` نوشته شده، اجرا نشده. |
| تست وابسته به تاریخ upstream | G2، G4 | `recurring-tasks › weekly completion_based` در یکشنبهٔ 2026-10-11 روی upstream هم شکست می‌خورد. CI ما نباید آن را به spike نسبت دهد. |

## صریح

**هیچ کدی از شاخه‌های `spike/*` merge نشده است.** `main` فقط این فایل‌ها را دارد: `docs/ltd/PRODUCT_BLUEPRINT.md`، `docs/ltd/spikes/G1.md` تا `G6.md` و `docs/ltd/spikes/DECISION.md`. شاخه‌های spike فقط محلی‌اند و push نشده‌اند.
