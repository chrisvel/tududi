# Webhooks

A webhook is an address tududi POSTs JSON to when something happens: a reminder fires, a task is completed, the day starts. Point it at n8n, Home Assistant, a Slack or Discord incoming webhook, or your own server. Each user can have up to 10 webhooks, and each one picks its own events.

## Setup

1. Open **Profile → Notifications** and press **Add webhook** in the Webhooks card.
2. Give it a name, paste the address, and pick the events.
3. Copy the signing secret that appears. It is shown once; **New secret** makes another.
4. Press **Test**. The card shows whether the receiver accepted the message, and **History** lists the last 20 deliveries.

On tududi Cloud, webhooks are part of the paid plan and not of the free trial.

## Events

| Event | When |
|---|---|
| `task.due_soon`, `task.overdue` | A task is due within a day, or past due |
| `task.reminder` | A task's reminder time is reached |
| `task.deferred_ready` | A deferred task becomes active |
| `task.assigned` | Someone assigns a task to you |
| `project.due_soon`, `project.overdue` | Same, for projects |
| `habit.reminder` | A habit reminder fires |
| `comment.added`, `comment.mention` | A comment on your task, or a mention |
| `share.invitation` | Someone shares something with you |
| `task.created`, `task.updated`, `task.completed`, `task.deleted` | One of your tasks changes, from any source (web, API, MCP, inbox) |
| `daily_summary` | Once a day at the hour you pick, in your timezone: overdue, due today and in progress |

The reminder and alert events follow the same notifications as the in-app bell: if the in-app column is off for a type, no webhook is sent for it either. `task.updated` only fires for changes that matter outside tududi (name, note, status, priority, dates, project, parent, estimate) and lists them in `data.changed`. Habit check-ins do not count as task changes. Changes to many tasks at once through a bulk update are not sent.

## Payload

```json
{
  "id": "k3j2h1g0f9e8",
  "event": "task.completed",
  "created_at": "2026-10-24T08:00:00.000Z",
  "text": "Completed: Buy milk",
  "content": "Completed: Buy milk",
  "data": {
    "task": {
      "uid": "a1b2c3d4e5f6",
      "name": "Buy milk",
      "note": null,
      "status": "done",
      "priority": "high",
      "due_date": "2026-10-24T20:59:59.999Z",
      "due_has_time": false,
      "defer_until": null,
      "completed_at": "2026-10-24T08:00:00.000Z",
      "project_uid": null,
      "parent_task_uid": null,
      "url": "https://tududi.example.com/task/a1b2c3d4e5f6"
    }
  }
}
```

`text` and `content` carry the same readable message, so a Slack (`text`) or Discord (`content`) incoming webhook shows it without anything in between. Notification events put the notification under `data.notification` next to its own fields (`taskUid`, `taskName` and so on). `daily_summary` sends `data.date`, `data.timezone`, `data.overdue`, `data.due_today` and `data.in_progress`, each a list of tasks in the shape above.

## Verifying a request

Every request has these headers:

| Header | Value |
|---|---|
| `X-Tududi-Event` | The event name |
| `X-Tududi-Delivery` | The payload `id`; the same on every retry |
| `X-Tududi-Timestamp` | Unix seconds when this attempt was sent |
| `X-Tududi-Signature` | `sha256=` + hex HMAC-SHA256 of `<timestamp>.<raw body>` with the secret |

```js
const crypto = require('crypto');

function verify(req, rawBody, secret) {
    const ts = req.headers['x-tududi-timestamp'];
    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${ts}.${rawBody}`)
        .digest('hex');
    const given = String(req.headers['x-tududi-signature'] || '').replace('sha256=', '');
    const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300;
    return (
        fresh &&
        given.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    );
}
```

## Delivery and retries

- Events are queued in `webhook_deliveries` and sent right away. A 2xx answer counts as delivered.
- A timeout, network error, 5xx, 408 or 429 is retried after 1, 5, 30 and 120 minutes (5 attempts). Any other 4xx fails at once.
- After 10 deliveries in a row fail, the webhook turns itself off and the card says so. Turning it back on clears the count.
- Delivered and failed rows are kept for 7 days.

## Security

- The address and secret are encrypted at rest with the same key as calendar feeds and Apprise. Set `TUDUDI_SESSION_SECRET` (or `TUDUDI_OIDC_SECRET_ENCRYPTION_KEY`) before saving. Only the host is shown back.
- Addresses go through the same outbound checks as CalDAV, calendar feeds and Apprise. Private network addresses (an n8n on your LAN) need `CALDAV_ALLOW_PRIVATE_HOSTS=true`. Link-local and cloud metadata addresses are always refused, including after redirects.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/webhooks` | List webhooks (no address or secret) |
| `POST` | `/api/webhooks` | Create `{ name, url, events, summary_hour }`; returns the secret once |
| `PATCH` | `/api/webhooks/:uid` | Change `name`, `url`, `events`, `summary_hour` or `enabled` |
| `DELETE` | `/api/webhooks/:uid` | Delete it and its deliveries |
| `POST` | `/api/webhooks/:uid/secret` | Make a new secret; returns it once |
| `POST` | `/api/webhooks/:uid/test` | Send a `test` event now and report the answer |
| `GET` | `/api/webhooks/:uid/deliveries` | The last 20 deliveries |

## Code

- `backend/modules/webhooks/events.js`: the event names, and which notification maps to which
- `backend/modules/webhooks/dispatcher.js`: queueing, signing, sending, retries (`processDue`, every minute)
- `backend/modules/webhooks/taskEvents.js`: Task model hooks for the task change events
- `backend/modules/webhooks/summary.js`: the daily summary (`sendDueSummaries`, every 5 minutes)
- `backend/models/notification.js`: hands each notification to the dispatcher
- `frontend/components/Profile/tabs/WebhooksCard.tsx`: the settings card
