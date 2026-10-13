# Connecting Google Calendar

Life-to-Day can read busy time from every Google calendar you show in Google Calendar and count it in the day plan's capacity (blueprint 20.1 B, ADR-011). It can also, if you turn it on, show your time blocks in a separate calendar named "Life-to-Day" (20.1 C). It never changes any other calendar.

The Google Cloud steps below are yours to do. Life-to-Day does not create the project or publish the consent screen for you.

## What it can and cannot do

| Permission asked                 | Why                                                         |
| -------------------------------- | ----------------------------------------------------------- |
| `calendar.calendarlist.readonly` | See which calendars you have                                |
| `calendar.events.readonly`       | Read event times, free/busy and whether you declined        |
| `calendar.app.created`           | Make and edit only the calendars Life-to-Day itself creates |
| `openid`                         | Remember which Google account is connected                  |

It does not ask for `calendar` or `calendar.events`, so it cannot write to your primary calendar or any calendar it did not create. The server also refuses, before any request, a write to any calendar id other than its own "Life-to-Day" calendar.

Event titles, descriptions and locations are not requested from Google and are not stored. Only start, end, all-day date, free/busy and the event id are kept. The AI assistant therefore never receives a Google event title.

## 1. Create the Google Cloud project

1. Open <https://console.cloud.google.com/> and create a project, for example "Life-to-Day".
2. In **APIs & Services → Library**, enable **Google Calendar API**.

## 2. Consent screen

1. Open **Google Auth Platform** (formerly _OAuth consent screen_).
2. Audience: **External**. Fill in the app name and your support email.
3. Under **Data access**, add the four scopes in the table above.
4. Under **Audience**, press **Publish app** so the status is **In production**.

Do not leave it in **Testing**. In Testing, Google expires the refresh token after 7 days and the connection stops. An unverified app in production shows a "Google hasn't verified this app" screen. That is acceptable for personal use. Unverified apps are limited to 100 new users.

## 3. OAuth client

1. **Google Auth Platform → Clients → Create client**. Type: **Web application**.
2. **Authorized redirect URIs**: add exactly
   `https://YOUR-ADDRESS/api/ltd/gcal/callback`
   where `YOUR-ADDRESS` is the public address of your Life-to-Day (`BASE_URL`). Scheme, host, port and path must match character for character.
3. Copy the client ID and client secret. Keep the secret out of chat, git, logs and screenshots.

## 4. Server settings

Put these in the server's environment file (`.env` in the repo root, which is never committed), then restart:

```
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
# Only if it differs from ${BASE_URL}/api/ltd/gcal/callback:
# GOOGLE_CALENDAR_REDIRECT_URI=https://YOUR-ADDRESS/api/ltd/gcal/callback
```

`TUDUDI_SESSION_SECRET` must also be set. The refresh token is encrypted with the same key that already protects the iCal secret address and OIDC secrets.

## 5. Connect

1. In Life-to-Day: **Profile → Calendars → Connect Google Calendar**.
2. On the unverified-app screen choose **Advanced → Go to … (unsafe)**, then allow the permissions.
3. You return to Profile → Calendars. The first sync runs at once; after that the server polls every 10 minutes.

While Google is connected, the day plan counts only Google busy time and ignores your iCal secret address for the same days, so a meeting is never counted twice. Your iCal feeds still show on the Calendar page. All-day events never use up hours of capacity.

Optional: tick **Show my time blocks in a separate "Life-to-Day" calendar in Google**. Life-to-Day creates that calendar and keeps today's and tomorrow's timed blocks in it. If you move a block there, Life-to-Day puts it back on the next sync: the app wins for its own blocks. Unticking deletes that calendar.

## Disconnect

**Disconnect** deletes the "Life-to-Day" calendar if it exists, revokes access at Google, and then deletes the stored token, sync tokens and event links. If Google does not confirm the revoke, the local data is still deleted and the page tells you; remove Life-to-Day yourself at <https://myaccount.google.com/permissions>. Planning goes back to your iCal feeds.

If you remove access at Google first, the next sync notices, the status says to connect again, and planning goes back to iCal.

## If the secret leaks

In Google Cloud, reset the client secret (or delete the client and create a new one), update `GOOGLE_CALENDAR_CLIENT_SECRET`, restart, and connect again.
