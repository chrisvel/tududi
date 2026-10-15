# Apprise Notifications

Apprise sends tududi notifications through a self-hosted [apprise-api](https://github.com/caronc/apprise-api) server. Apprise then delivers them to any service it supports (Pushover, ntfy, Discord, Matrix, email and more), so tududi does not need a separate integration for each one.

## Setup

1. Run apprise-api, for example:

   ```bash
   docker run -d --name apprise -p 8000:8000 caronc/apprise:latest
   ```

2. Create a configuration in apprise-api that lists the services you want (its web UI or config files), and note its config key.
3. In tududi, open **Profile → Notifications**, enter the server address (for example `http://192.168.1.10:8000`) and the config key, then press **Save**.
4. Turn on the **Apprise** column for the notification types you want, and press **Test** under it.

Optional tags are sent with every message, so you can route them inside apprise-api.

## Which notifications are sent

Apprise is opt-in per notification type, like Telegram and push. It covers due and overdue tasks and projects, deferred tasks becoming active, habit reminders, comments, mentions and task assignments. The daily task summary is still Telegram only.

## Storage and security

- The server address and config key are encrypted at rest with the same key as the calendar feed addresses. Set `TUDUDI_SESSION_SECRET` (or `TUDUDI_OIDC_SECRET_ENCRYPTION_KEY`) before saving.
- Only the host name is shown back in the settings. The config key is never returned to the browser.
- Addresses go through the same outbound checks as CalDAV and calendar feeds. Private network addresses are refused unless the server sets `CALDAV_ALLOW_PRIVATE_HOSTS=true`, which you need for an apprise-api on your LAN. Link-local and cloud metadata addresses are always refused.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/apprise/config` | Whether a server is saved, its host and tags |
| `PUT` | `/api/apprise/config` | Save `{ url, key, tags }` |
| `DELETE` | `/api/apprise/config` | Remove the saved server |
| `POST` | `/api/apprise/test` | Send a test message |

## Code

- `backend/modules/apprise/service.js`: saving, sending and the outbound request
- `backend/models/notification.js`: the `apprise` source and sender
- `backend/utils/notificationPreferences.js`: per-type `apprise` preference
- `frontend/components/Profile/tabs/AppriseCard.tsx`: the settings form
