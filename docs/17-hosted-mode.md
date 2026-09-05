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
