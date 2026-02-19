# Calendar module

Syncs external calendars via ICS URL to display events alongside tasks in Tududi.

## API Endpoints

### `POST /api/v1/calendar/sync`

Triggers a manual calendar sync for the authenticated user.

**Response:**

```json
{
    "added": 5,
    "updated": 2,
    "deleted": 1,
    "skippedNotModified": 10,
    "syncedAt": "2026-02-19T12:00:00.000Z"
}
```

### `POST /api/v1/calendar/sync-if-stale`

Triggers a sync only if the user is due based on their `syncPreset` and `lastSyncedAt`.

**Response:**

```json
{
    "triggered": true
}
```

### `GET /api/v1/calendar/events`

Fetches calendar events for the authenticated user.

**Query Parameters:**

- `type`: `today` or `upcoming` (default: `upcoming`)
- `maxDays`: Number of days to fetch (default: 7)
- `groupBy`: `day` (default: `day`)

**Response:**

```json
{
  "events": [...],
  "groupedEvents": {
    "Today": [...],
    "Tomorrow": [...]
  }
}
```

## Settings

Calendar settings are stored in the `User.calendar_settings` JSON field:

- `enabled`: Boolean. Whether calendar sync is active.
- `icsUrl`: String. The URL of the external ICS feed.
- `syncPreset`: String. Sync frequency (`1h`, `3h`, `6h`, `12h`, `24h`).
- `lastSyncedAt`: Date. Timestamp of the last successful sync.
- `lastSyncError`: String. Error message from the last failed sync.
- `etag`: String. HTTP ETag for conditional requests.
- `lastModified`: String. HTTP Last-Modified header for conditional requests.

### Masking Behavior

For security, the `icsUrl` is masked in standard profile responses (e.g., `GET /api/v1/profile`).

To retrieve the full URL, use the reveal endpoint:
`POST /api/v1/profile/calendar-settings/reveal`
