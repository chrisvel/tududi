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

| | Free | Pro |
|---|---|---|
| Active tasks (not done, archived or cancelled) | 200 | unlimited |
| Projects | 10 | unlimited |
| Notes | 50 | unlimited |
| Attachment storage | 50 MB | 5 GB |
| AI requests per day | 0 | 200 |
| AI assistant, MCP, CalDAV, Telegram, backup import | no | yes |

`null` means unlimited. Override any number with `TUDUDI_PLANS_JSON`, a JSON
object deep-merged over the defaults:

```bash
TUDUDI_PLANS_JSON='{"free":{"limits":{"max_tasks":100}},"pro":{"limits":{"storage_mb":10000}}}'
```

Other knobs:

| Variable | Default | Meaning |
|---|---|---|
| `TUDUDI_TRIAL_DAYS` | `14` | new accounts get Pro for this long, counted from the account creation date |
| `TUDUDI_PAST_DUE_GRACE_DAYS` | `14` | after a failed payment, Pro continues this long past the period end |
| `TUDUDI_HOSTED_EXEMPT_ADMINS` | `true` | admins are treated as Pro |

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
completing tasks or deleting attachments frees quota immediately. Per-day
budgets (AI requests) use the `usage_counters` table.

## Tables

- `billing_accounts`: one row per user, created on first use. Subscription
  state as reported by Stripe, the local trial end, and the admin override.
- `billing_events`: every Stripe webhook event id, so redeliveries are
  applied once.
- `usage_counters`: `(user, metric, day)` counters.

All three are removed with the account by `services/accountErasureService.js`.

## Stripe

Billing is Stripe Checkout plus the Customer Portal; tududi never sees card
details. Set:

| Variable | Meaning |
|---|---|
| `STRIPE_SECRET_KEY` | secret API key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the webhook endpoint below |
| `STRIPE_PRICE_PRO_MONTHLY` | price id of the monthly Pro price |
| `STRIPE_PRICE_PRO_ANNUAL` | price id of the annual Pro price |

Point a Stripe webhook at `https://your-host/api/billing/webhook` with the
events `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.paid` and `invoice.payment_failed`. The endpoint reads the raw
body, verifies the signature, records every event id in `billing_events`
(a redelivered event is acknowledged and not applied twice), and answers
500 on an internal fault so Stripe retries.

Endpoints (all 404 on a self-hosted instance):

| Route | Purpose |
|---|---|
| `GET /api/billing` | plan, status, usage, and what the UI may offer |
| `GET /api/billing/plans` | the catalog, without price ids |
| `POST /api/billing/checkout` `{ interval: "month" \| "year" }` | Checkout session URL |
| `POST /api/billing/portal` | Customer Portal URL |
| `POST /api/billing/sync` `{ session_id? }` | re-read the subscription from Stripe (the checkout redirect can beat the webhook) |
| `GET /api/admin/billing` | overview and account list (admin) |
| `PUT /api/admin/billing/:userId/override` `{ plan, expires_at?, reason? }` | comp or restrict an account (admin) |
| `DELETE /api/admin/billing/:userId/override` | remove the override (admin) |
| `POST /api/admin/billing/:userId/sync` | force a re-read from Stripe (admin) |

After a failed payment the account is `past_due`: Pro continues for
`TUDUDI_PAST_DUE_GRACE_DAYS` past the period end while Stripe retries, and
the user gets an in-app warning. A cancelled subscription drops to Free at
once but nothing is deleted or hidden. Deleting an account cancels its
subscription and removes the Stripe customer.

Local testing: `stripe listen --forward-to localhost:3002/api/billing/webhook`
and `stripe trigger checkout.session.completed`.

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
