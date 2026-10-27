# Hosted Mode

Hosted mode is how tududi runs as a public, multi-user service (a single
shared instance where unrelated people sign up). It is off by default and a
self-hosted install never needs it. Everything in this document is a no-op
until `TUDUDI_HOSTED_MODE=true`.

## What the flag changes

| Area | Self-hosted (default) | Hosted mode |
|---|---|---|
| First registered user | becomes admin | regular user; admin comes from `TUDUDI_USER_EMAIL` |
| `POST /api/admin/set-admin-role` with no roles | any user may bootstrap | refused |
| OIDC auto-provisioning | always creates accounts | only while registration is enabled |
| Boot | starts with whatever is set | refuses to start until session secret, trust proxy, allowed origins, public URLs, email and PostgreSQL are configured (`config/hostedConfig.js`) |
| `GET /api/health` | includes environment and proxy setting | omits them |
| Plans and limits | none, everything unlimited | the plan catalog below applies |

## Plans and limits

The catalog lives in `backend/config/plans.js`:

| | Free | Pro | Team (`team_N`) |
|---|---|---|---|
| Active tasks (not done, archived or cancelled) | 200 | unlimited | unlimited |
| Projects | 10 | unlimited | unlimited |
| Notes | 50 | unlimited | unlimited |
| Attachment storage | 50 MB | 5 GB | 5 GB |
| AI requests per month | 0 | 200 | 200 |
| Members an owner may add (`max_members`) | 0 | 0 | N minus 1 |
| AI assistant, MCP, CalDAV, backup import | no | yes | yes |

Pro is one person. Team plans are sold in fixed seat buckets, like
monday.com: `team_3`, `team_5`, `team_10`, `team_15`, `team_20`, `team_25`,
`team_30` and `team_40` (`TEAM_SEATS` in `plans.js`). Each is Pro for everyone
in it, and the owner holds one of the seats, so `team_5` adds 4 members.
Larger teams are sold by hand with an override (below).

`null` means unlimited. Override any number with `TUDUDI_PLANS_JSON`, a JSON
object deep-merged over the defaults:

```bash
TUDUDI_PLANS_JSON='{"free":{"limits":{"max_tasks":100}},"pro":{"limits":{"storage_mb":10000}}}'
```

Other knobs:

| Variable | Default | Meaning |
|---|---|---|
| `TUDUDI_TRIAL_DAYS` | `7` | a self-registered account gets the trial plan for this long, counted from when it verifies its email (SSO sign-ups: from creation). `0` turns trials off |
| `TUDUDI_TRIAL_READ_ONLY_DAYS` | `30` | with `TUDUDI_REQUIRE_SUBSCRIPTION`, how long an unpaid ended trial stays readable before the account is deleted |
| `TUDUDI_DELETE_EXPIRED_TRIALS` | `true` | set `false` to keep ended trials read-only instead of deleting them; past the window they get the usual 402 wall |
| `RATE_LIMIT_SIGNUP_MAX` / `RATE_LIMIT_SIGNUP_WINDOW_MS` | `3` / 24 h | password sign-ups per IP on a hosted instance; only created accounts count |
| `TUDUDI_PAST_DUE_GRACE_DAYS` | `14` | after a failed payment, Pro continues this long past the period end |
| `TUDUDI_HOSTED_EXEMPT_ADMINS` | `true` | admins are treated as Pro |
| `TUDUDI_REQUIRE_SUBSCRIPTION` | `false` | sell access rather than upgrades: see below |

## Trials

A trial is its own plan (`trial` in `config/plans.js`): Pro with a smaller AI
allowance and one member, minus public note links, which could be abused by
someone who signed up only to misuse them.

- **Starts on email verification**, once per account. Signing up does not
  start it, so an address that never receives mail never gets one. Members
  added by an owner and admins never get a trial of their own.
- **Returning accounts get one too.** A verified account that never had a
  trial under these rules, never subscribed and has no comp gets its trial on
  its first request after trials are switched on (`startTrialOnReturn`, run
  by the subscription gate). A `trial_ends_at` with no `trial_started_at`
  dates from before these rules and counts as never started.
- **Limited AI** (30 requests and 10 credits a month, against Pro's 200 and
  50), **one member** (`max_members: 1`) and **no public note links**
  (`features.public_notes: false`; turning a link off still works). A member
  added on a trial shares the owner's trial while it runs, and keeps access
  if the owner subscribes to a Team plan. A feature the trial leaves out answers
  `402 FEATURE_NOT_IN_PLAN` with `details.plan: "trial"`, and the app sends
  the browser to `/subscription/new?feature=<name>`. Set any of these to `0`
  or `false` with `TUDUDI_PLANS_JSON` to take them out again.
- **One trial per mailbox.** `users.email_canonical` folds `+tags`, Gmail dots
  and googlemail.com, and a hosted sign-up (password or SSO) whose mailbox
  already has an account is refused. Self-hosted instances skip this check.
- **Always visible.** During the trial a bar on every page counts the days
  left and links to `/subscription/new`.
- **Reminded before it ends.** The daily `account_lifecycle` job emails a
  running, never-paid trial owner when 3 days are left and again on the last
  day (`billing_accounts.trial_reminder_days`), with or without
  `TUDUDI_REQUIRE_SUBSCRIPTION`.
- **Then read-only.** With `TUDUDI_REQUIRE_SUBSCRIPTION`, an ended, never-paid
  trial can still `GET` everything (and export) for
  `TUDUDI_TRIAL_READ_ONLY_DAYS`; writes answer `402 TRIAL_ENDED`.
- **Warned, then deleted.** The daily `account_lifecycle` job (03:00 UTC)
  emails a deletion warning when deletion is a week or less away, and deletes
  only accounts warned at least 7 days earlier; a late warning pushes the date
  back. No email, no warning, so no deletion. It only touches accounts whose
  trial started under these rules (`billing_accounts.trial_started_at`), that
  never subscribed, have no override and no members, and are not admins.
- **Verification reminder.** The same job sends one reminder, with a fresh
  link, to a self-registered sign-up that has not verified 1 to 7 days after
  signing up (`users.verification_reminder_sent_at`).
- **Empty and quiet accounts.** The same job emails an owner whose account
  started 2 to 14 days ago and still has nothing in it, once, and an owner
  who made things and then nothing for 7 to 30 days, again only after they
  have been active since. Members, admins and read-only accounts are left
  out; the email log (`email_deliveries`) keeps either from going twice.

## Selling access rather than upgrades

With `TUDUDI_REQUIRE_SUBSCRIPTION=true` the Free plan stops being a place to
live. An account with no subscription, no trial, no admin override and no
admin exemption cannot use the app at all: every API route answers `402`
with `code: SUBSCRIPTION_REQUIRED`, and the browser is sent to
`/subscription/new`, which lists the plans and starts a checkout.

Four things stay open, because locking someone out of their own data would
make it theirs in name only:

- `GET/PATCH/DELETE /api/profile` and the password change, so an account can
  be corrected or deleted
- `POST /api/backup/export`, `GET /api/backup/list` and the download route
- every `/api/billing` route, so a plan can actually be bought
- the auth routes, which sit before this check

The flag is meaningless when hosted mode is off, so a self-hosted instance
is never gated. Leave it unset for the usual free-tier-plus-Pro shape.

## Accounts: customers are admins of their own

On a hosted instance every customer owns an **account**
(`backend/services/accountsService.js`, table `accounts`, `users.account_id`).
Whoever signs up owns a new account and is an **admin** of it (role
`account_admin`, shown as "Admin"). Members added to it, by the owner or by
any other admin of the account, join the same account; a partner with an
email, or a child without one.

Admins of an account open **Access** (Users, Groups, Roles) and see only their
own account there. They add and remove members, make a member an admin or
take that back, set permissions, set a password for a user or guest, and
manage the account's groups (group names are unique per account, and a group
only takes and is shared with from its own account). They do not see each
other's tasks, notes or projects unless those are shared. The owner always
stays an admin, and no other admin can remove it, change its email or set its
password. Only the owner manages billing.

The instance admin is the **Superadmin** (`is_admin`), and there is only one:
making a second is refused, including through an OIDC admin email domain.
Every other admin page (dashboard, billing, AI usage, feedback, waitlist,
registration, OIDC) is the superadmin's alone. A customer never gets
`is_admin`, which would bypass every access check.
`cloud-superadmin-isolation.test.js` and `cloud-accounts.test.js` check that
an account admin is refused every superadmin route, never sees another account
or the superadmin, and that a member who is not an admin is refused Access.

Accounts exist only with hosted mode on. The migration adds the empty table
and columns everywhere; when a hosted instance starts, every user without an
account is put into one (members join their creator's account, everyone else
owns one) and groups join their creator's account. Accounts the superadmin
creates stand on their own. When an owner's account is deleted its members
stay and each gets an account of its own.

Each member takes a seat of the account owner's plan, whichever admin added
it. Seats come from the plan (a Team bucket), never from a quantity on the
subscription, so the app never changes a subscription itself.
`backend/services/seatsService.js`:

- **Adding** a member checks `max_members` of the owner's plan
  (`assertCanAddSeat`). The owner counts as one seat. Nothing reaches the
  payment provider.
- **Removing** a member frees its seat for someone else. There is no refund
  before the renewal.
- **A bigger team** moves to a bigger bucket through checkout or the
  provider's portal, so the customer approves the change (this also works for
  PayPal subscriptions, which a merchant cannot change). The
  `subscription_plan_changed` webhook stores the new plan.
- **A smaller bucket** than the members already added keeps them; adding is
  refused until there is room again.
- **Who may add**: an admin of an account whose owner has a subscription, its
  grace window, or an admin override. Without one the request answers `402
  SUBSCRIPTION_REQUIRED`; past the plan's seats `402 PLAN_LIMIT_REACHED` with
  `details.resource: "member"`, which the app shows as "All N seats are in
  use".
- **Invoiced teams**: set an override to a `team_N` plan with an expiry in
  Admin > Billing. `billing_accounts.seat_quantity` is kept for reference and
  not used.

A member with nothing of its own is covered by its account owner: `getEntitlements`
returns the owner's plan with `reason: 'seat'` and `seat_owner`. When the
owner stops paying, its members hit the paywall with it (export stays open).
Accounts the instance admin creates are not covered this way, since the admin
pays for nothing; give those an override instead.

## How limits are enforced

`backend/services/entitlementsService.js` answers "what may this user do"
from their `billing_accounts` row and the catalog. Resolution order: hosted
off, admin exemption, admin override, active or trialing subscription,
past-due grace, local trial, free.

Only creation is ever limited. Reads, edits, completing, deleting,
exporting and downloading always work, so a downgraded account above the
free limits loses nothing; it just cannot add more until it is back under
the limit or upgrades. Limits answer `402` with `code: PLAN_LIMIT_REACHED`
and `details: { resource, limit, current, plan }`; plan-only features answer
`402` with `code: FEATURE_NOT_IN_PLAN`.

Stock limits (tasks, projects, notes, storage) are counted live, so
completing tasks or deleting attachments frees quota immediately. Per-month
budgets (AI requests) use the `usage_counters` table.

## Tables

- `billing_accounts`: one row per user, created on first use. Subscription
  state as reported by Stripe, the local trial end, and the admin override.
- `billing_events`: every Stripe webhook event id, so redeliveries are
  applied once.
- `usage_counters`: `(user, metric, month)` counters.

All three are removed with the account by `services/accountErasureService.js`.

## Payments

Plans are sold through one of three providers, chosen by `BILLING_PROVIDER`
(`polar`, `lemonsqueezy` or `stripe`; when unset, Polar is used if
`POLAR_ACCESS_TOKEN` is set, then Lemon Squeezy if only its key is present,
Stripe otherwise). tududi never sees card details with any of them. The
billing tab, the webhook endpoint and the admin page are the same for all;
only the credentials differ.

Only the selling provider takes new checkouts, but a subscription bought
through another configured provider stays there: while it is live, its
billing tab, "Manage subscription", sync and cancellation go to the
provider in `billing_accounts.provider`, and that provider's webhooks are
still applied. The one webhook URL tells providers apart by their signature
header. Once such a subscription ends, the next checkout goes through the
selling provider. The hosted tududi sells through Polar and keeps its
earlier Lemon Squeezy subscriptions this way.

**Polar** is a merchant of record: it charges VAT and issues the invoices.
Each plan and interval is its own product.

| Variable | Meaning |
|---|---|
| `POLAR_ACCESS_TOKEN` | organization access token |
| `POLAR_WEBHOOK_SECRET` | signing secret (`whsec_…`) of the webhook below |
| `POLAR_PRODUCTS_JSON` | product ids by plan, `{"pro":{"month":"…","year":"…"},"team_5":{"month":"…","year":"…"}}` |
| `POLAR_SERVER` | `sandbox` for sandbox-api.polar.sh; production otherwise |

Create a monthly and a yearly product per plan, turn on "Enable
subscription plan changes" under Settings > Customer portal so customers
move between Team sizes themselves, and add a webhook (format Raw) at
`https://your-host/api/billing/webhook` with the events
`subscription.created`, `subscription.updated`, `subscription.active`,
`subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`,
`subscription.past_due` and `order.paid`. The checkout sets the customer's
external id to the user's uid, which is how webhooks and sync find the
user; the success redirect carries the checkout id. A subscription
canceled at period end keeps its plan until it is revoked, which drops it
to Free. "Manage subscription" opens the Polar customer portal.

**Lemon Squeezy** is a merchant of record too, and sold the hosted tududi
before Polar.

| Variable | Meaning |
|---|---|
| `LEMONSQUEEZY_API_KEY` | API key from Settings > API |
| `LEMONSQUEEZY_STORE_ID` | numeric store id |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | signing secret of the webhook below |
| `LEMONSQUEEZY_VARIANT_PRO_MONTHLY` | variant id of the monthly Pro subscription |
| `LEMONSQUEEZY_VARIANT_PRO_ANNUAL` | variant id of the annual Pro subscription |
| `LEMONSQUEEZY_TEAM_VARIANTS_JSON` | Team variants, `{"team_5":{"month":"123","year":"456"}}`; put them in the same product as Pro so the portal offers them as plan changes |

Create one product ("tududi Pro") with a subscription variant per
interval, then a webhook at `https://your-host/api/billing/webhook` with the
events `subscription_created`, `subscription_updated`,
`subscription_cancelled`, `subscription_resumed`, `subscription_expired`,
`subscription_paused`, `subscription_unpaused`,
`subscription_payment_success`, `subscription_payment_failed` and
`subscription_payment_recovered`. A cancelled subscription keeps Pro until
its `ends_at`; `expired` drops to Free. "Manage subscription" opens the
Lemon Squeezy customer portal. The success redirect carries no reference,
so the app re-reads the newest subscription for the account's email when
the billing tab reloads.

**Stripe** is Checkout plus the Customer Portal:

| Variable | Meaning |
|---|---|
| `STRIPE_SECRET_KEY` | secret API key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the webhook endpoint below |
| `STRIPE_PRICE_PRO_MONTHLY` | price id of the monthly Pro price |
| `STRIPE_PRICE_PRO_ANNUAL` | price id of the annual Pro price |
| `STRIPE_TEAM_PRICES_JSON` | Team prices, `{"team_5":{"month":"price_…","year":"price_…"}}` |

Point a Stripe webhook at `https://your-host/api/billing/webhook` with the
events `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.paid` and `invoice.payment_failed`. Local testing:
`stripe listen --forward-to localhost:3002/api/billing/webhook` and
`stripe trigger checkout.session.completed`.

For all of them, the endpoint reads the raw body, verifies the signature, records
every event id in `billing_events` (a redelivered event is acknowledged and
not applied twice; Polar's is the `webhook-id` header, and Lemon Squeezy
sends none, so the resource id plus its `updated_at` stands in), drops an update older than the last one
applied, and answers 500 on an internal fault so the provider retries.

Endpoints (all 404 on a self-hosted instance):

| Route | Purpose |
|---|---|
| `GET /api/billing` | plan, status, usage, the provider, and what the UI may offer |
| `GET /api/billing/plans` | the catalog, without price ids |
| `POST /api/billing/checkout` `{ interval: "month" \| "year", plan? }` | checkout URL (`plan` defaults to `pro`) |
| `POST /api/billing/portal` | customer portal URL |
| `POST /api/billing/sync` `{ session_id? }` | re-read the subscription from the provider (the checkout redirect can beat the webhook) |
| `GET /api/admin/billing` | overview and account list, each with this month's AI request/token usage (admin) |
| `PUT /api/admin/billing/:userId/override` `{ plan, expires_at?, reason? }` | comp or restrict an account (admin) |
| `DELETE /api/admin/billing/:userId/override` | remove the override (admin) |
| `POST /api/admin/billing/:userId/sync` | force a re-read from the provider (admin) |

After a failed payment the account is `past_due`: Pro continues for
`TUDUDI_PAST_DUE_GRACE_DAYS` past the period end while the provider
retries, and the user gets an in-app warning. Nothing is deleted or hidden
on a downgrade. Deleting an account cancels its subscription.

## Captcha

Registration, password reset and verification resend are the three forms
anyone on the internet can submit. With Cloudflare Turnstile configured they
carry a challenge that is invisible for most visitors:

| Variable | Meaning |
|---|---|
| `TURNSTILE_SITE_KEY` | public key, rendered in the forms |
| `TURNSTILE_SECRET_KEY` | server key used to verify tokens |

Create the widget at dash.cloudflare.com under Turnstile (the domain does
not need to be on Cloudflare DNS). The forms send the token as
`captcha_token`; a missing or invalid token answers `400` with
`code: CAPTCHA_FAILED`. If Cloudflare itself is unreachable the request is
let through and logged, so an outage there never locks people out; the
rate limiters still apply. Unset (the default) means no captcha anywhere.

## Google sign-in

Google is configured as an ordinary OIDC provider (see
[OIDC/SSO](10-oidc-sso.md#google)) with slug `google`, which gives its button
the Google mark on both the login and the register page. On a hosted
instance a first Google sign-in creates an account only while registration
is enabled, skips the captcha (Google has already vouched for the person) and
then meets the same subscription gate as any other new account.

The Google OAuth client needs `https://<app host>/api/oidc/callback/google`
as a redirect URI, and `BASE_URL` must be the app's public URL because the
callback is built from it. On the consent screen, publish the app (a client
left in testing admits only its listed test users) and link the landing
page's `/privacy` and `/terms`.

## Public demo

`TUDUDI_DEMO_ENABLED=true` stands up a sandbox anyone can open without
signing up: one shared account, seeded with plausible content, wiped and
seeded again on a timer.

| Variable | Default | Meaning |
|---|---|---|
| `TUDUDI_DEMO_ENABLED` | `false` | off unless set, so a self-hosted instance never grows a public login |
| `TUDUDI_DEMO_EMAIL` | `demo@tududi.com` | the shared account |
| `TUDUDI_DEMO_PASSWORD` | `demodemo` | only used to create the account; visitors never type it |
| `TUDUDI_DEMO_RESET_MINUTES` | `60` | how often everything in it is thrown away |

`POST /api/demo/login` signs the caller into the shared account, so the
marketing site links straight to `/demo` on the app and nobody has to be
told a password. The account can never hold an admin role, cannot change
its own password or email, and cannot delete itself; everything else it may
do, because the reset clears up after it. On an instance that requires a
subscription the demo passes through an admin override rather than a
payment, so it shows up in the admin billing list as a comped account.

The reset runs in whichever process has background jobs enabled and takes
the `demo-reset` job lock, so several app containers cannot wipe it at once.

## Marketing page

The same image can serve the public marketing page, so a hosted deployment
needs no second application for `example.com` beside `app.example.com`.
The page lives in `backend/modules/landing/` (an EJS template, its own
`locales/<code>/landing.json` catalogs in 26 languages, and a few assets)
and is switched on per hostname:

| Variable | Meaning |
|---|---|
| `TUDUDI_LANDING_HOSTS` | comma-separated hostnames that get the marketing page, e.g. `tududi.com,www.tududi.com`. Empty (default) means it is never served |
| `TUDUDI_LANDING_URL` | canonical origin used in `hreflang` and canonical tags; defaults to `https://` plus the first host |
| `TUDUDI_LANDING_PRICING_JSON` | overrides for the prices printed on the page: `{"monthly":5,"annual":49,"standard":99,"business":499,"launchActive":true}` |

On a landing host, `/` and `/<locale>` render the page, `/landing-assets/*`
serves its images, `/api/*` still works (so health checks do), and every
other path answers `301` to the same path on `FRONTEND_URL`, so product
pages exist on exactly one hostname. On any other host the middleware is a
no-op. The Free plan limits printed on the page come from the plan catalog,
so `TUDUDI_PLANS_JSON` changes the copy too.

The page carries its own `Content-Security-Policy` (Google Fonts, Font
Awesome from cdnjs, Google Analytics, the GitHub API for the star count).
`node backend/scripts/landing-i18n-check.js` reports locale keys that are
missing or whose `{{placeholders}}` differ from English.

### Release-notes signup

The page's signup section and its footer take an email for release notes.
Both post to `POST /waitlist` on the landing host, never to a third party,
and write one `waitlist_subscribers` row per address (the name is older than
the feature), counting a repeat submission in `submission_count` rather than
adding a row. The answer is the same redirect whether the address was new,
already listed or malformed, so the form cannot be used to find out who has
signed up. `source` records which form it was (`waitlist`, `footer`, and
older rows may say `hero`, `cloud`, `pricing` or `app`).

Every Cloud call to action links to `/register` on the app. Registration on
a hosted instance follows the admin toggle (`registration_enabled`) alone,
which is also the way to close it quickly.

Admins read the list at `/admin/waitlist` in the app: newest first, search
by address, and "Export CSV" (`GET /api/admin/waitlist/export`). The
dashboard shows the total and the last seven days beside it.

## Visits and dashboard metrics

The admin dashboard (`/admin`) shows three panels. **Trial funnel, last 30
days** follows the people who signed up in that span: site visitors
(marketing site and blog), trial signups (people who made their own account;
members added to another account are left out), activated users (5 or more
tasks, or a planned day) and paid (activated and has had a subscription).
Each step shows its count, the share that made it from the step before, and
how that share moved against the 30 days before. Paid needs a hosted
instance, and visitors need visit tracking. Recent signups may still be on
their trial, so the paid step trails the others.

**Last 7 days** groups the week into new users (verified email, created
something, planned a first day, kept planning, waitlist joins), usage
(active users, tasks created and completed) and, when hosted, trials and
churn. **Visits, last 7 days** shows how people arrive and what they do:
visitors and page views per day, blog readers, app opens, app users (this
week, today, last 30 days), top pages and top referrers. Every figure sits
next to the week before.

A visit is a navigation answered with a page: a marketing page, a blog page
(a blog host, or `/blog` on the app host), or the app shell. Redirects,
errors, API calls, assets, prefetches, requests without a browser
`Accept: text/html` header and crawlers, monitors and scripts (by user agent)
are not counted. The app counts full page loads, not in-app navigation, so
"App opens" is sessions rather than screens. Each load is one `site_visits`
row: surface (`landing`, `blog`, `app`), the page (two path segments on the
marketing site and blog, one in the app, never a query string or a record
id), the referring hostname when it is another site, and for the app the
signed-in user.

No address or user agent is stored. The visitor is a hash of the address and
user agent salted with the UTC day and the session secret, so it separates
two people within one day and cannot follow anyone to the next. Visitors are
therefore counted per day (back on another day counts again), the marketing
site and the blog are added together, and a restart without a fixed
`TUDUDI_SESSION_SECRET` can count a returning visitor twice that day.
Rows older than 90 days are deleted by the nightly token cleanup, and an
account's rows go with it when it is erased.

| Variable | Meaning |
|---|---|
| `TUDUDI_VISIT_TRACKING` | `false` stops recording visits and hides the Visits panel. Default on |

## Deploying on one machine

`docs/examples/docker-compose.hosted.yml` and `docs/examples/Caddyfile` are
a complete single-VPS layout: Caddy (automatic TLS) in front of a `web`
container that serves HTTP with the background jobs off, a `worker`
container from the same image that runs the schedulers and the Telegram
poller, and PostgreSQL 16. Both app containers share `uploads/` and
`backups/`; secrets live in `.env` on the server. The comments at the end
of the compose file list the variables hosted mode requires; the server
refuses to start until they are set.

Point uptime monitoring at `/api/health/ready`, run `scripts/pg-backup.sh`
from cron and copy its output off the machine, and deploy by pinning
`TUDUDI_VERSION` to a release tag and running `docker compose pull && docker
compose up -d`. Migrations run in the container entrypoint under a database
lock, so `web` and `worker` can start together.
