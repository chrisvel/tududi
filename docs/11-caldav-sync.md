# CalDAV Synchronization

This guide explains how to configure and use CalDAV synchronization in Tududi to access your tasks across multiple devices and applications.

**Related:** [Tasks Behavior](00-tasks-behavior.md), [Recurring Tasks](01-recurring-tasks-behavior.md), [Architecture Overview](architecture.md)

---

## Table of Contents

- [Overview](#overview)
- [How CalDAV Works](#how-caldav-works)
- [Why Use CalDAV](#why-use-caldav)
- [Supported Clients](#supported-clients)
- [Configuration](#configuration)
  - [Quick Setup](#quick-setup)
  - [Environment Variables Reference](#environment-variables-reference)
- [Client Setup Guides](#client-setup-guides)
  - [tasks.org (Android/iOS)](#tasksorg-androidios)
  - [Apple Reminders (iOS/macOS)](#apple-reminders-iosmacos)
  - [Thunderbird (Desktop)](#thunderbird-desktop)
  - [Evolution (Linux)](#evolution-linux)
- [Remote Server Synchronization](#remote-server-synchronization)
  - [Nextcloud](#nextcloud)
  - [Baikal](#baikal)
  - [Generic CalDAV Server](#generic-caldav-server)
- [User Features](#user-features)
  - [Managing Calendars](#managing-calendars)
  - [Manual Sync](#manual-sync)
  - [Conflict Resolution](#conflict-resolution)
- [Advanced Topics](#advanced-topics)
  - [Sync Direction](#sync-direction)
  - [Sync Intervals](#sync-intervals)
  - [Field Mappings](#field-mappings)
  - [Recurring Tasks](#recurring-tasks)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

---

## Overview

CalDAV (Calendar Distributed Authoring and Versioning) is an industry-standard protocol for accessing and managing calendar data. Tududi implements CalDAV to enable task synchronization with external applications and servers.

**Key Features:**
- **Bidirectional Sync:** Changes sync in both directions (Tududi ↔ CalDAV clients/servers)
- **Popular Client Support:** tasks.org, Apple Reminders, Thunderbird, Evolution, and more
- **Recurring Tasks:** Full support via RRULE (RFC 5545)
- **Conflict Detection:** Automatic conflict detection with configurable resolution strategies
- **Background Sync:** Automatic periodic synchronization
- **Standards-Compliant:** Implements RFC 4791 (CalDAV) and RFC 5545 (iCalendar)

---

## How CalDAV Works

### The Protocol

CalDAV extends WebDAV to provide a standard way of accessing and managing calendar objects over HTTP. In Tududi:

1. **Tasks as VTODO:** Tududi tasks are represented as iCalendar VTODO components
2. **HTTP Methods:** Standard HTTP methods (GET, PUT, DELETE) plus WebDAV extensions (PROPFIND, REPORT)
3. **Discovery:** Clients find calendars via `.well-known/caldav` endpoint
4. **Authentication:** HTTP Basic Auth for CalDAV clients, sessions/tokens for web UI

### Data Flow

**CalDAV Client Access:**
```
┌─────────────────┐
│  CalDAV Client  │  (tasks.org, Thunderbird, etc.)
│  (Mobile/PC)    │
└────────┬────────┘
         │ HTTP Basic Auth
         │ PROPFIND, REPORT, GET, PUT, DELETE
         ▼
┌─────────────────┐
│     Tududi      │  Serves as CalDAV server
│  CalDAV Server  │  /caldav/{username}/tasks/
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SQLite Database │  Tasks stored with CalDAV metadata
│  (tasks table)  │  (ETags, CTags, sync state)
└─────────────────┘
```

**Remote Server Sync:**
```
┌─────────────────┐
│     Tududi      │  Acts as CalDAV client
│  CalDAV Client  │
└────────┬────────┘
         │ Periodic sync (every 5-60 min)
         │ PROPFIND, REPORT, GET, PUT, DELETE
         ▼
┌─────────────────┐
│  Remote CalDAV  │  Nextcloud, Baikal, etc.
│     Server      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Remote Tasks   │  Synced bidirectionally
└─────────────────┘
```

### Synchronization Process

Tududi uses a **three-phase sync algorithm**:

**1. Pull Phase:**
- Fetch changes from remote CalDAV server
- Parse VTODO items into Tududi task format
- Store in temporary buffer

**2. Merge Phase:**
- Compare local and remote versions using ETags
- Detect conflicts (both modified since last sync)
- Apply conflict resolution strategy:
  - `last_write_wins`: Keep most recent change
  - `local_wins`: Always keep Tududi version
  - `remote_wins`: Always keep remote version
  - `manual`: Flag for user resolution

**3. Push Phase:**
- Identify local changes since last sync
- Serialize tasks to VTODO format
- PUT to remote server
- Update sync state (ETags, timestamps)

### Task Transformation

**Tududi Task → VTODO:**
```javascript
// Tududi task
{
  uid: "abc123",
  name: "Buy groceries",
  due_date: "2026-04-20T14:00:00Z",
  status: 0,  // NOT_STARTED
  priority: 2  // High
}

// Becomes VTODO
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tududi//CalDAV Server//EN
BEGIN:VTODO
UID:abc123
SUMMARY:Buy groceries
DUE:20260420T140000Z
STATUS:NEEDS-ACTION
PRIORITY:3
CREATED:20260415T100000Z
DTSTAMP:20260415T100000Z
END:VTODO
END:VCALENDAR
```

### Change Detection

**ETags (Entity Tags):**
- Unique identifier for each task version
- Generated from task's `updated_at` timestamp
- Clients use ETags to detect changes efficiently
- `If-Match` headers prevent conflicting updates

**CTags (Collection Tags):**
- Single tag for entire calendar collection
- Changes whenever any task in calendar changes
- Enables quick "has anything changed?" check
- Reduces unnecessary full syncs

### Recurring Task Handling

Tududi stores recurring tasks as **single parent tasks** with recurrence rules:

**Storage:**
- Parent task stored once with RRULE
- No duplicate database entries for future instances
- Configurable expansion limit (default: 365 instances)

**CalDAV Serialization:**
- Parent task expanded into virtual instances on-demand
- Each instance gets unique RECURRENCE-ID
- Clients see discrete VTODO entries
- Modified instances stored in `caldav_occurrence_overrides` table

**Example:**
```
Parent Task: "Daily standup"
  recurrence_pattern: "daily"
  due_date: "2026-04-20T09:00:00Z"

CalDAV Expansion:
  - VTODO (UID: daily-standup, RECURRENCE-ID: 20260420T090000Z)
  - VTODO (UID: daily-standup, RECURRENCE-ID: 20260421T090000Z)
  - VTODO (UID: daily-standup, RECURRENCE-ID: 20260422T090000Z)
  ... (up to 365 future instances)
```

---

## Why Use CalDAV

**For Mobile Users:**
- Access tasks on Android/iOS via tasks.org or Apple Reminders
- Offline access with eventual sync
- Native mobile notifications and widgets
- Work seamlessly across devices

**For Desktop Users:**
- Use Thunderbird or Evolution for desktop task management
- Integrated with email workflow
- Keyboard shortcuts and power user features
- Calendar/task views side-by-side

**For Self-Hosters:**
- Sync with existing infrastructure (Nextcloud, Baikal)
- Keep data on your own servers
- No third-party cloud dependencies
- Standards-based interoperability

**For Teams:**
- Share Tududi tasks via CalDAV-compatible platforms
- Collaborate using familiar tools (Nextcloud Tasks)
- Maintain single source of truth (Tududi)
- Cross-platform compatibility

---

## Configuration

CalDAV is configured via environment variables in your `.env` file. After making changes, **restart the Tududi server** for them to take effect.

### Quick Setup

**Enable CalDAV:**

```bash
# Enable CalDAV feature
CALDAV_ENABLED=true

# Encryption key for remote calendar passwords (32 characters minimum)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Optional: Configure defaults
CALDAV_DEFAULT_SYNC_INTERVAL=15              # Minutes between syncs
CALDAV_MAX_RECURRING_INSTANCES=365           # Future recurring instances
CALDAV_CONFLICT_RESOLUTION=last_write_wins   # Default strategy
```

**Restart Tududi:**

```bash
docker compose restart  # For Docker
npm start              # For standalone
```

**Configure in Web UI:**

1. Navigate to **Profile > Settings > CalDAV** tab
2. Click **Add Calendar** to create a local calendar
3. Click **Add Remote Calendar** to sync with external servers
4. Follow the setup wizard

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CALDAV_ENABLED` | Yes | `false` | Enable/disable CalDAV feature |
| `ENCRYPTION_KEY` | Recommended | `SECRET_KEY` | AES-256-GCM encryption key for passwords |
| `CALDAV_DEFAULT_SYNC_INTERVAL` | No | `15` | Default sync interval in minutes |
| `CALDAV_MAX_RECURRING_INSTANCES` | No | `365` | Max future recurring instances to expand |
| `CALDAV_CONFLICT_RESOLUTION` | No | `last_write_wins` | Default conflict strategy |
| `CALDAV_RATE_LIMIT` | No | `60` | Requests per minute per IP |
| `CALDAV_MAX_SYNC_TASKS` | No | `1000` | Max tasks per sync operation |
| `CALDAV_REQUEST_TIMEOUT` | No | `30000` | Request timeout in milliseconds |
| `CALDAV_LOG_LEVEL` | No | `info` | Log level: error, warn, info, debug |
| `CALDAV_LOG_REQUESTS` | No | `false` | Log all CalDAV HTTP requests |

**Important:** The `ENCRYPTION_KEY` should be a secure random string (32 bytes). If not set, falls back to `SECRET_KEY`.

**Conflict Resolution Strategies:**
- `last_write_wins`: Most recent change wins (default, recommended)
- `local_wins`: Always keep Tududi's version
- `remote_wins`: Always keep remote server's version
- `manual`: Flag conflicts for manual resolution in UI

---

## Supported Clients

## Client Setup Guides

### tasks.org (Android/iOS)

**Setup Instructions:**

1. Open tasks.org app
2. Tap **☰ Menu** > **Settings** > **Synchronization**
3. Select **CalDAV**
4. Enter connection details:
   - **URL:** `https://your-tududi-domain.com/caldav/`
   - **Username:** Your Tududi email
   - **Password:** Your Tududi password
5. Tap **Add Account**
6. Select the **tasks** calendar
7. Tap **Sync** to start synchronization

**Features:**
- ✅ Full task CRUD (create, read, update, delete)
- ✅ Recurring tasks with RRULE
- ✅ Due dates and start dates (defer until)
- ✅ Priority levels
- ✅ Task status (needs action, in progress, completed)
- ✅ Subtasks via RELATED-TO
- ⚠️ Limited: Habit mode, tags stored in custom fields

### Apple Reminders (iOS/macOS)

**Setup Instructions (iOS):**

1. Open **Settings** > **Reminders** > **Accounts**
2. Tap **Add Account** > **Other**
3. Select **Add CalDAV Account**
4. Enter connection details:
   - **Server:** `your-tududi-domain.com`
   - **Username:** Your Tududi email
   - **Password:** Your Tududi password
   - **Description:** Tududi Tasks
5. Tap **Next** > **Save**
6. Open **Reminders** app to view synced tasks

**Setup Instructions (macOS):**

1. Open **System Settings** > **Internet Accounts**
2. Click **+** > **Add Other Account** > **CalDAV Account**
3. Enter connection details:
   - **Account Type:** Manual
   - **Username:** Your Tududi email
   - **Password:** Your Tududi password
   - **Server Address:** `https://your-tududi-domain.com/caldav/`
4. Click **Sign In**
5. Open **Reminders** app to view synced tasks

**Features:**
- ✅ Task creation and editing
- ✅ Due dates and reminders
- ✅ Priority levels (high, medium, low)
- ✅ Task completion
- ✅ Recurring tasks (limited patterns)
- ⚠️ Limited: Advanced recurrence patterns, custom fields

### Thunderbird (Desktop)

**Setup Instructions:**

1. Install **Lightning** or **Task Calendar** extension (if not built-in)
2. Open **Calendar** tab
3. Right-click in calendar list > **New Calendar**
4. Select **On the Network**
5. Choose **CalDAV**
6. Enter connection details:
   - **Location:** `https://your-tududi-domain.com/caldav/{your-username}/tasks/`
   - Replace `{your-username}` with your Tududi username
7. Enter credentials when prompted
8. Select **Tasks** calendar type
9. Click **Finish**

**Features:**
- ✅ Full task management
- ✅ Recurring tasks with advanced patterns
- ✅ Due dates, start dates, completion dates
- ✅ Priority and status
- ✅ Task descriptions (notes)
- ✅ Subtask hierarchy

### Evolution (Linux)

**Setup Instructions:**

1. Open **Evolution** > **File** > **New** > **Task List**
2. Select **CalDAV**
3. Enter connection details:
   - **URL:** `https://your-tududi-domain.com/caldav/{your-username}/tasks/`
   - **Username:** Your Tududi email
   - **Password:** Your Tududi password
4. Click **Apply**
5. View tasks in **Tasks** view

**Features:**
- ✅ Full task CRUD
- ✅ Recurring tasks
- ✅ Due dates and priorities
- ✅ Task completion tracking

---

## Remote Server Synchronization

Tududi can sync with external CalDAV servers like Nextcloud, Baikal, or other CalDAV-compatible services.

### Overview

When configured as a CalDAV client, Tududi periodically fetches changes from remote servers and pushes local changes back. This enables:
- **Cloud Backup:** Keep tasks synced with cloud CalDAV services
- **Multi-Instance Sync:** Run multiple Tududi instances synced via central server
- **Legacy Integration:** Sync with existing calendar infrastructure

### Nextcloud

**Setup Instructions:**

1. In Tududi, go to **Profile > Settings > CalDAV** tab
2. Click **Add Remote Calendar**
3. Select **Nextcloud** as server type
4. Enter connection details:
   - **Name:** My Nextcloud Tasks
   - **Server URL:** `https://your-nextcloud-domain.com`
   - **Calendar Path:** `/remote.php/dav/calendars/{username}/tasks/`
     - Replace `{username}` with your Nextcloud username
   - **Username:** Your Nextcloud username
   - **Password:** Your Nextcloud password or app password
5. Choose sync direction:
   - **Bidirectional:** Changes sync both ways
   - **Pull Only:** Import from Nextcloud to Tududi
   - **Push Only:** Export from Tududi to Nextcloud
6. Set sync interval (default: 15 minutes)
7. Click **Save**
8. Click **Sync Now** to test connection

**Creating App Password (Recommended):**

1. In Nextcloud, go to **Settings > Security**
2. Scroll to **Devices & sessions**
3. Enter app name: `Tududi`
4. Click **Create new app password**
5. Copy the generated password
6. Use this password in Tududi CalDAV settings

### Baikal

**Setup Instructions:**

1. In Tududi, go to **Profile > Settings > CalDAV** tab
2. Click **Add Remote Calendar**
3. Select **Baikal** as server type
4. Enter connection details:
   - **Name:** My Baikal Tasks
   - **Server URL:** `https://your-baikal-domain.com`
   - **Calendar Path:** `/dav.php/calendars/{username}/tasks/`
     - Replace `{username}` with your Baikal username
   - **Username:** Your Baikal username
   - **Password:** Your Baikal password
5. Configure sync settings
6. Click **Save** and **Sync Now**

### Generic CalDAV Server

**Setup Instructions:**

1. In Tududi, go to **Profile > Settings > CalDAV** tab
2. Click **Add Remote Calendar**
3. Select **Generic CalDAV** as server type
4. Enter connection details:
   - **Name:** Custom calendar name
   - **Server URL:** Full CalDAV server URL
   - **Calendar Path:** Path to specific calendar
   - **Username:** Your CalDAV username
   - **Password:** Your CalDAV password
   - **Auth Type:** Basic (default)
5. Configure sync settings
6. Click **Save** and **Sync Now**

**Finding Your Calendar Path:**

Most CalDAV servers follow this pattern:
```
/calendars/{username}/{calendar-name}/
```

Check your CalDAV server's documentation for the exact path format.

---

## Configuration Options

### Sync Direction

- **Bidirectional:** Changes sync in both directions (default)
- **Pull Only:** Import tasks from remote to Tududi
- **Push Only:** Export tasks from Tududi to remote

### Sync Interval

Choose how frequently automatic sync runs:
- 5 minutes
- 15 minutes (default)
- 30 minutes
- 60 minutes
- Manual only (disable automatic sync)

### Conflict Resolution

When the same task is modified both locally and remotely:

- **Last Write Wins:** Most recent change overwrites older change (default)
- **Local Wins:** Always keep Tududi's version
- **Remote Wins:** Always keep remote server's version
- **Manual:** Flag conflicts for manual resolution in UI

---

## Field Mappings

### Task Fields → VTODO Properties

| Tududi Field | VTODO Property | Notes |
|--------------|----------------|-------|
| Name | SUMMARY | Task title |
| Note | DESCRIPTION | Task description |
| Due Date | DUE | ISO 8601 UTC timestamp |
| Defer Until | DTSTART | Start date/time |
| Completed At | COMPLETED | Completion timestamp |
| Status | STATUS | See status mapping below |
| Priority | PRIORITY | Inverse scale (see below) |
| Recurrence | RRULE | RFC 5545 recurrence rule |
| Subtasks | RELATED-TO | Parent task UID |

### Status Mapping

| Tududi Status | VTODO STATUS |
|---------------|--------------|
| Not Started | NEEDS-ACTION |
| In Progress | IN-PROCESS |
| Done | COMPLETED |
| Archived | COMPLETED |
| Waiting | NEEDS-ACTION |
| Cancelled | CANCELLED |
| Planned | NEEDS-ACTION |

### Priority Mapping

CalDAV uses inverse priority scale (1=highest, 9=lowest):

| Tududi Priority | VTODO PRIORITY |
|-----------------|----------------|
| High (2) | 3 |
| Medium (1) | 5 |
| Low (0) | 7 |

### Custom Fields

Tududi-specific features are stored as extended properties:

- `X-TUDUDI-HABIT-MODE`: Habit tracking settings
- `X-TUDUDI-PROJECT-UID`: Project association
- `X-TUDUDI-TAGS`: Task tags (comma-separated)

These fields are preserved but may not be visible in external clients.

---

## Recurring Tasks

Tududi supports CalDAV recurring tasks via RRULE (RFC 5545):

### Supported Patterns

| Pattern | RRULE Example |
|---------|---------------|
| Daily | `FREQ=DAILY` |
| Every N days | `FREQ=DAILY;INTERVAL=3` |
| Weekly | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| Monthly by day | `FREQ=MONTHLY;BYMONTHDAY=15` |
| Monthly by weekday | `FREQ=MONTHLY;BYDAY=2TH` (2nd Thursday) |
| Yearly | `FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1` |

### Limitations

- External clients see individual instances (next 365 occurrences)
- Editing a single instance creates an override
- Deleting parent task removes all instances

---

## Troubleshooting

### Authentication Fails

**Symptoms:** Client can't connect, 401 Unauthorized error

**Solutions:**
1. Verify credentials (email and password are correct)
2. Check that `CALDAV_ENABLED=true` in environment
3. Ensure HTTP Basic Auth is supported by client
4. Try creating a new API token in Profile settings

### Tasks Not Syncing

**Symptoms:** Changes don't appear after sync

**Solutions:**
1. Check sync status in CalDAV tab (last sync time, errors)
2. Click **Sync Now** to force manual sync
3. Verify sync direction is **Bidirectional**
4. Check conflict list for unresolved conflicts
5. Review backend logs for sync errors

### Recurring Tasks Missing

**Symptoms:** Only first instance appears

**Solutions:**
1. Ensure client supports RRULE recurrence
2. Check that `CALDAV_MAX_RECURRING_INSTANCES` environment variable is set (default: 365)
3. Some clients require manual refresh to see new instances

### Performance Issues

**Symptoms:** Sync takes very long or times out

**Solutions:**
1. Reduce number of tasks (archive completed tasks)
2. Increase `CALDAV_REQUEST_TIMEOUT` environment variable
3. Lower sync frequency (change from 5 min to 15 min)
4. Check server resources (CPU, memory, disk I/O)

### Connection Timeouts

**Symptoms:** "Connection timeout" or "Network error"

**Solutions:**
1. Verify server URL is correct and accessible
2. Check firewall allows HTTPS traffic
3. Ensure SSL certificate is valid (not self-signed)
4. Try increasing timeout: `CALDAV_REQUEST_TIMEOUT=60000`

### Invalid Calendar Data

**Symptoms:** "Invalid VTODO" or "Parse error"

**Solutions:**
1. Check that client sends valid iCalendar format
2. Review backend logs for specific validation errors
3. Test with different CalDAV client to isolate issue
4. Report issue with example VTODO data

---

## Security Considerations

### Password Storage

Remote calendar passwords are encrypted with AES-256-GCM before storage. Encryption key is derived from `ENCRYPTION_KEY` or `SECRET_KEY` environment variable.

**Best Practice:** Use app-specific passwords instead of main account passwords when available (e.g., Nextcloud app passwords).

### Authentication

CalDAV endpoints use HTTP Basic Authentication. Always use HTTPS in production to prevent credential interception.

### Rate Limiting

CalDAV endpoints are rate-limited:
- 60 requests per minute for CalDAV protocol
- 5 requests per minute for manual sync triggers

---

## Environment Variables

```bash
# Feature toggle
CALDAV_ENABLED=true

# Encryption key (32 characters minimum)
ENCRYPTION_KEY=your-256-bit-encryption-key

# Sync defaults
CALDAV_DEFAULT_SYNC_INTERVAL=15              # Minutes
CALDAV_MAX_RECURRING_INSTANCES=365           # Future instances
CALDAV_CONFLICT_RESOLUTION=last_write_wins   # Strategy

# Performance tuning
CALDAV_RATE_LIMIT=60                         # Requests per minute
CALDAV_MAX_SYNC_TASKS=1000                   # Max tasks per sync
CALDAV_REQUEST_TIMEOUT=30000                 # Milliseconds

# Debugging
CALDAV_LOG_LEVEL=info                        # error, warn, info, debug
CALDAV_LOG_REQUESTS=false                    # Log all CalDAV requests
```

---

## Known Limitations

1. **Subtasks:** Supported via RELATED-TO, but not all clients render hierarchically
2. **Habit Mode:** Stored in custom fields, not visible in external clients
3. **Tags:** Exported as CATEGORIES, but colors/metadata only in Tududi
4. **Projects:** Association stored in X-TUDUDI-PROJECT-UID, not shown externally
5. **Status Granularity:** 7 Tududi statuses mapped to 4 CalDAV statuses (some nuance lost)
6. **Timezone Handling:** All dates stored as UTC; local timezone conversion in clients
7. **Large Recurring Sequences:** Expanding far into future creates many VTODOs (configurable limit)

---

## FAQs

### Can I use multiple CalDAV clients simultaneously?

Yes, multiple clients can sync with the same Tududi calendar. Changes from any client will sync to all others.

### What happens if I delete a task in a CalDAV client?

The task will be deleted in Tududi after the next sync (if bidirectional sync is enabled).

### Can I sync multiple calendars?

Yes, you can configure multiple remote calendars in the CalDAV settings tab. Each calendar syncs independently.

### Do I need a CalDAV server to use this feature?

No, you can use Tududi directly as a CalDAV server. Clients like tasks.org, Apple Reminders, and Thunderbird can connect directly to Tududi.

### How do I resolve sync conflicts?

Navigate to **Profile > Settings > CalDAV** tab and click **View Conflicts**. The conflict resolver shows side-by-side comparison and lets you choose which version to keep.

### Can I disable automatic sync?

Yes, set sync interval to "Manual only" in calendar settings. You can still trigger sync manually via **Sync Now** button.

---

## User Features

### Managing Calendars

**View Calendars:**

Navigate to **Profile > Settings > CalDAV** tab to see:
- Local calendars (Tududi as CalDAV server)
- Remote calendars (syncing with external servers)
- Sync status (last sync time, errors)
- Configuration options

**Create Local Calendar:**

1. Click **Add Calendar**
2. Enter calendar name and description
3. Choose sync settings (enabled by default)
4. Click **Save**
5. Calendar URL: `https://your-domain.com/caldav/{username}/tasks/`

**Add Remote Calendar:**

1. Click **Add Remote Calendar**
2. Select server type (Nextcloud, Baikal, Generic)
3. Enter connection details (URL, credentials)
4. Choose sync direction and interval
5. Click **Save** and **Sync Now**

**Edit Calendar:**

1. Click **Edit** button on calendar card
2. Modify settings (name, interval, sync direction)
3. Click **Save**

**Delete Calendar:**

1. Click **Delete** button on calendar card
2. Confirm deletion
3. **Note:** Deleting a calendar does NOT delete tasks, only the CalDAV configuration

### Manual Sync

**Trigger Manual Sync:**

1. Go to **Profile > Settings > CalDAV** tab
2. Find the calendar you want to sync
3. Click **Sync Now** button
4. Sync status updates in real-time
5. Check **Last Synced** timestamp

**View Sync Status:**

Each calendar card shows:
- **Last Synced:** Timestamp of last successful sync
- **Status:** Synced, Syncing, Error
- **Error Details:** If sync failed, error message is displayed

### Conflict Resolution

**When Conflicts Occur:**

A conflict happens when the same task is modified both locally (in Tududi) and remotely (in client/server) between syncs.

**Automatic Resolution:**

By default, `last_write_wins` strategy is used:
- Compare `updated_at` timestamps
- Keep the version with most recent change
- Discard older version

**Manual Resolution:**

If conflict strategy is set to `manual`:

1. Navigate to **Profile > Settings > CalDAV** tab
2. Click **View Conflicts** (if conflicts exist)
3. See side-by-side comparison:
   - **Local Version:** Current Tududi state
   - **Remote Version:** CalDAV client/server state
4. Choose resolution:
   - **Keep Local:** Use Tududi version
   - **Keep Remote:** Use client/server version
   - **Merge:** (not yet implemented)
5. Click **Resolve**

**Conflict Indicators:**

- Red badge on CalDAV settings tab
- Conflict count shown on calendar card
- Task marked with conflict icon (if applicable)

---

## Support

**Issues:** [GitHub Issues](https://github.com/chrisvel/tududi/issues)
**Discussions:** [GitHub Discussions](https://github.com/chrisvel/tududi/discussions)
**Discord:** [Join our community](https://discord.gg/fkbeJ9CmcH)

**Related Documentation:**
- [Tasks Behavior](00-tasks-behavior.md)
- [Recurring Tasks Behavior](01-recurring-tasks-behavior.md)
- [User Management](08-user-management.md)
- [Architecture Overview](architecture.md)
- [Developer Guide: CalDAV Implementation](dev/caldav-implementation.md)

**Protocol References:**
- [RFC 4791 - CalDAV](https://datatracker.ietf.org/doc/html/rfc4791)
- [RFC 5545 - iCalendar](https://datatracker.ietf.org/doc/html/rfc5545)
- [RFC 6578 - Sync Collection](https://datatracker.ietf.org/doc/html/rfc6578)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-04-20
**Maintainer:** Update when CalDAV features change
