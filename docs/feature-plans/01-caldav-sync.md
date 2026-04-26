# CalDAV Synchronization Implementation Plan

**GitHub Issue:** [#978 - Add CalDAV Synchronization Support](https://github.com/chrisvel/TaskNoteTaker/issues/978)

---

## Context

TaskNoteTaker currently supports hierarchical task management with sophisticated recurring tasks, but lacks external synchronization. This feature adds CalDAV protocol support to enable bidirectional sync with CalDAV servers (Nextcloud, Baikal, etesync) and clients (tasks.org, Apple Reminders, Thunderbird).

**Why This Change:**
- Enable mobile/desktop client access (tasks.org, Apple Reminders, Thunderbird)
- Support self-hosted CalDAV server sync (Nextcloud, Baikal)
- Maintain task data across multiple devices
- Enable offline task management with eventual sync
- Requested in [Discussion #246](https://github.com/chrisvel/TaskNoteTaker/discussions/246)

**Implementation Approach:**
- Custom CalDAV/WebDAV implementation (RFC 4791)
- `ical.js` library for iCalendar VTODO format
- Hybrid recurring task strategy (store once, expand for CalDAV)
- RFC 6578 compliance for incremental sync
- Database storage for calendar configurations (not .env like OIDC)

**Estimated Effort:** Significant development effort

---

## Key Architecture Decisions

### 1. Database Storage (not .env)
**Decision:** Store calendar configurations in database with web UI management.

**Why:** Unlike OIDC (system-wide, admin-configured), CalDAV is per-user. Users need to configure multiple calendars, update credentials frequently, and enable/disable sync without server restart.

### 2. Hybrid Recurring Task Expansion
**Decision:** Store parent task only, expand to VTODO instances on-demand at serialization time.

**Why:** Reuses existing virtual instance logic (`recurringTaskService.js`). CalDAV clients expect discrete VTODO entries with RECURRENCE-ID, but we don't persist all future instances.

### 3. HTTP Basic Auth Support
**Decision:** Add HTTP Basic Auth middleware for CalDAV routes.

**Why:** CalDAV clients (tasks.org, Thunderbird) require HTTP Basic Auth. Web UI continues using sessions. No changes to existing auth middleware needed.

### 4. Library Selection
- **iCalendar:** `ical.js` (v2.1.0) - industry standard
- **XML:** `xml2js` (v0.6.0) - bidirectional XML ↔ JS
- **CalDAV Protocol:** Custom implementation (no mature Node.js library)

### 5. Route Structure
**Mount CalDAV at `/caldav/`:**
```
/.well-known/caldav             → Discovery redirect
/caldav/{username}/tasks/       → User's default calendar
/caldav/{username}/tasks/{uid}/ → Individual task resource
```

---

## Database Schema Changes

### 1. `caldav_calendars` - Calendar configuration
```sql
CREATE TABLE caldav_calendars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid STRING NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Calendar identity
  name STRING NOT NULL,
  description TEXT,
  color STRING,

  -- CalDAV metadata
  ctag STRING,              -- Collection tag (change detection)
  sync_token STRING,        -- RFC 6578 sync-token

  -- Sync configuration
  enabled BOOLEAN DEFAULT 1,
  sync_direction STRING DEFAULT 'bidirectional',
  sync_interval_minutes INTEGER DEFAULT 15,
  last_sync_at DATETIME,
  last_sync_status STRING,
  conflict_resolution STRING DEFAULT 'last_write_wins',

  created_at DATETIME,
  updated_at DATETIME
);
```
**Migration:** `20260420000001-create-caldav-calendars.js`

### 2. `caldav_sync_state` - Per-task sync tracking
```sql
CREATE TABLE caldav_sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  calendar_id INTEGER NOT NULL REFERENCES caldav_calendars(id) ON DELETE CASCADE,

  -- CalDAV metadata
  etag STRING NOT NULL,
  last_modified DATETIME NOT NULL,

  -- Sync tracking
  last_synced_at DATETIME,
  sync_status STRING DEFAULT 'synced',

  -- Conflict data
  conflict_local_version JSON,
  conflict_remote_version JSON,
  conflict_detected_at DATETIME,

  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE(task_id, calendar_id)
);
```
**Migration:** `20260420000002-create-caldav-sync-state.js`

### 3. `caldav_occurrence_overrides` - Edited recurring instances
```sql
CREATE TABLE caldav_occurrence_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  calendar_id INTEGER NOT NULL REFERENCES caldav_calendars(id) ON DELETE CASCADE,

  recurrence_id DATETIME NOT NULL,  -- Which instance (original due date)

  -- Overridden fields (NULL = not overridden)
  override_name TEXT,
  override_due_date DATETIME,
  override_status INTEGER,
  override_priority INTEGER,
  override_note TEXT,

  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE(parent_task_id, calendar_id, recurrence_id)
);
```
**Migration:** `20260420000003-create-caldav-occurrence-overrides.js`

### 4. `caldav_remote_calendars` - External CalDAV servers
```sql
CREATE TABLE caldav_remote_calendars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_calendar_id INTEGER REFERENCES caldav_calendars(id) ON DELETE SET NULL,

  -- Remote server
  name STRING NOT NULL,
  server_url STRING NOT NULL,
  calendar_path STRING NOT NULL,
  username STRING NOT NULL,
  password_encrypted TEXT NOT NULL,  -- AES-256-GCM
  auth_type STRING DEFAULT 'basic',

  -- Sync configuration
  enabled BOOLEAN DEFAULT 1,
  sync_direction STRING DEFAULT 'bidirectional',
  last_sync_at DATETIME,
  last_sync_status STRING,
  last_sync_error TEXT,
  server_ctag STRING,
  server_sync_token STRING,

  created_at DATETIME,
  updated_at DATETIME
);
```
**Migration:** `20260420000004-create-caldav-remote-calendars.js`

**Note:** No changes to `tasks` table - existing `uid` field becomes CalDAV UID.

---

## Backend Implementation

### Module Structure
```
backend/modules/caldav/
├── index.js                    # Module exports
├── routes.js                   # WebDAV/CalDAV HTTP handlers
├── webdav/                     # WebDAV protocol
│   ├── propfind.js            # PROPFIND method
│   ├── report.js              # REPORT method (calendar-query)
│   ├── options.js             # OPTIONS method
│   └── utils.js               # WebDAV XML helpers
├── protocol/
│   ├── discovery.js           # .well-known handler
│   ├── capabilities.js        # CalDAV capabilities
│   └── sync-collection.js     # RFC 6578 sync-token
├── icalendar/                  # iCalendar transformation
│   ├── vtodo-serializer.js    # Task → VTODO
│   ├── vtodo-parser.js        # VTODO → Task
│   ├── rrule-generator.js     # Recurrence → RRULE
│   ├── rrule-parser.js        # RRULE → Recurrence
│   └── field-mappings.js      # Status, priority mappings
├── sync/                       # Synchronization engine
│   ├── sync-engine.js         # Main orchestrator
│   ├── pull-phase.js          # Fetch from remote
│   ├── merge-phase.js         # Conflict detection
│   ├── push-phase.js          # Send to remote
│   └── conflict-resolver.js   # Resolution strategies
├── repositories/
│   ├── calendar-repository.js
│   ├── sync-state-repository.js
│   ├── override-repository.js
│   └── remote-calendar-repository.js
├── services/
│   ├── calendar-service.js
│   ├── sync-scheduler.js      # Background sync (node-cron)
│   └── encryption-service.js  # AES-256-GCM password encryption
├── middleware/
│   ├── caldav-auth.js         # HTTP Basic Auth
│   └── xml-parser.js          # Parse XML bodies
└── utils/
    ├── etag-generator.js
    ├── ctag-generator.js
    └── validation.js
```

### Critical Services

#### 1. Task → VTODO Field Mappings

| TaskNoteTaker Field | VTODO Property | Transformation |
|--------------|----------------|----------------|
| `uid` | `UID` | Direct (15-char nanoid) |
| `name` | `SUMMARY` | Direct |
| `note` | `DESCRIPTION` | Direct |
| `due_date` | `DUE` | UTC DATE-TIME |
| `defer_until` | `DTSTART` | UTC DATE-TIME |
| `completed_at` | `COMPLETED` | UTC DATE-TIME |
| `status` (0-6) | `STATUS` | Map to NEEDS-ACTION/IN-PROCESS/COMPLETED/CANCELLED |
| `priority` (0-2) | `PRIORITY` | Inverse scale (0→7, 1→5, 2→3) |
| `recurrence_*` | `RRULE` | Generate RRULE string |
| `parent_task_id` | `RELATED-TO` | Parent UID |
| Custom | `X-TUDUDI-*` | Extended properties |

**Status Mapping:**
```javascript
// TaskNoteTaker → iCalendar
0 (NOT_STARTED) → NEEDS-ACTION
1 (IN_PROGRESS) → IN-PROCESS
2 (DONE) → COMPLETED
3 (ARCHIVED) → COMPLETED
4 (WAITING) → NEEDS-ACTION
5 (CANCELLED) → CANCELLED
6 (PLANNED) → NEEDS-ACTION
```

**Priority Mapping (Inverse):**
```javascript
// TaskNoteTaker 0=Low, 1=Medium, 2=High
// iCalendar 1=Highest, 5=Medium, 9=Lowest
TaskNoteTakerToIcal: priority => 9 - (priority * 2)
icalToTaskNoteTaker:
  1-3 → High (2)
  4-6 → Medium (1)
  7-9 → Low (0)
```

#### 2. RRULE Generation Examples

| TaskNoteTaker Pattern | RRULE |
|----------------|-------|
| daily, interval=2 | `FREQ=DAILY;INTERVAL=2` |
| weekly, weekdays=[1,3,5] | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| monthly, month_day=15 | `FREQ=MONTHLY;BYMONTHDAY=15` |
| monthly_weekday, week=2, weekday=4 | `FREQ=MONTHLY;BYDAY=2TH` |
| monthly_last_day | `FREQ=MONTHLY;BYMONTHDAY=-1` |

**Implementation:** `/backend/modules/caldav/icalendar/rrule-generator.js`

#### 3. Sync Engine Workflow

```
PULL PHASE (pull-phase.js)
├─ Fetch remote changes (REPORT with sync-token)
├─ Parse VTODO to tasks
└─ Store in temporary buffer

MERGE PHASE (merge-phase.js)
├─ Compare ETags (local vs remote)
├─ Detect conflicts (both changed)
├─ Apply resolution strategy:
│  ├─ last_write_wins: Compare timestamps
│  ├─ local_wins: Keep local
│  ├─ remote_wins: Keep remote
│  └─ manual: Flag for user resolution
└─ Update local database

PUSH PHASE (push-phase.js)
├─ Identify local changes (updated_at > last_synced_at)
├─ Serialize to VTODO
├─ PUT to remote server
└─ Update sync state (ETags, timestamps)
```

**Implementation:** `/backend/modules/caldav/sync/sync-engine.js`

#### 4. HTTP Basic Auth Middleware

**File:** `/backend/modules/caldav/middleware/caldav-auth.js`

```javascript
async function caldavAuth(req, res, next) {
  // Check existing session/Bearer token first
  if (req.session?.userId || req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  // Parse HTTP Basic Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Basic ')) {
    return res.status(401)
      .set('WWW-Authenticate', 'Basic realm="TaskNoteTaker CalDAV"')
      .json({ error: 'Authentication required' });
  }

  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  // Validate against User model
  const user = await User.findOne({ where: { email: username } });
  if (!user || !await bcrypt.compare(password, user.password_digest)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.currentUser = user;
  next();
}
```

### Routes

**WebDAV Protocol Routes:**
```javascript
// Discovery
GET /.well-known/caldav → Redirect to /caldav/

// CalDAV endpoints (use caldavAuth middleware)
PROPFIND /caldav/:username/tasks/       → List tasks
REPORT   /caldav/:username/tasks/       → Query/filter tasks
OPTIONS  /caldav/:username/tasks/       → Capabilities
GET      /caldav/:username/tasks/:uid/  → Fetch task
PUT      /caldav/:username/tasks/:uid/  → Create/update task
DELETE   /caldav/:username/tasks/:uid/  → Delete task
```

**REST API Routes (use requireAuth middleware):**
```javascript
// Calendar management
GET    /api/caldav/calendars
POST   /api/caldav/calendar
PUT    /api/caldav/calendar/:id
DELETE /api/caldav/calendar/:id

// Remote calendar configuration
GET    /api/caldav/remote-calendars
POST   /api/caldav/remote-calendar
PUT    /api/caldav/remote-calendar/:id
DELETE /api/caldav/remote-calendar/:id

// Sync operations
POST   /api/caldav/sync/:calendarId           → Manual sync trigger
GET    /api/caldav/sync-status/:calendarId    → Sync status

// Conflict resolution
GET    /api/caldav/conflicts                  → List conflicts
POST   /api/caldav/resolve-conflict/:taskId   → Resolve conflict
```

**Note:** Express doesn't natively support PROPFIND/REPORT. Register custom methods in `app.js`:
```javascript
['PROPFIND', 'REPORT', 'MKCALENDAR'].forEach(method => {
  express.Router[method.toLowerCase()] = function(path, ...handlers) {
    return this.route(path)[method.toLowerCase()] = handlers;
  };
});
```

---

## Frontend Implementation

### 1. CalDAV Settings Tab

**File:** `/frontend/components/Settings/tabs/CalDAVTab.tsx`

**Features:**
- List configured calendars
- Add/edit/delete calendars
- Configure remote CalDAV servers
- Enable/disable sync per calendar
- Manual sync trigger button
- View sync status (last sync time, errors)
- Sync interval selection (5, 15, 30, 60 minutes)
- Conflict resolution strategy selector

### 2. Conflict Resolution UI

**File:** `/frontend/components/CalDAV/ConflictResolver.tsx`

**Features:**
- List all tasks with sync conflicts
- Side-by-side comparison (local vs remote)
- Resolve individual conflict (choose local/remote/merge)
- Batch resolution (apply strategy to all)
- Field-level diff highlighting

### 3. Setup Wizard

**File:** `/frontend/components/CalDAV/SetupWizard.tsx`

**Steps:**
1. Select server type (Nextcloud, Baikal, Generic)
2. Enter server URL and credentials
3. Test connection
4. Select calendar to sync
5. Configure sync settings
6. Complete setup

---

## Security Considerations

### 1. Password Encryption (AES-256-GCM)
```javascript
// /backend/modules/caldav/services/encryption-service.js
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || process.env.SECRET_KEY, 'utf-8').slice(0, 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), encrypted, authTag: authTag.toString('hex') });
}
```

### 2. XML Injection Prevention
Use `xml2js` with strict parsing (disable external entities).

### 3. Rate Limiting
- CalDAV routes: 60 req/min (existing `apiLimiter`)
- Sync operations: 5 req/min (custom `syncLimiter`)

### 4. Authorization
Verify calendar ownership before operations:
```javascript
async function requireCalendarAccess(req, res, next) {
  const calendar = await CalendarRepository.findById(req.params.calendarId);
  if (!calendar || calendar.user_id !== req.currentUser.id) {
    return res.status(404).json({ error: 'Calendar not found' });
  }
  req.calendar = calendar;
  next();
}
```

### 5. CSRF Exemption
CalDAV routes must be exempt from CSRF (already handled in `app.js`):
```javascript
const isCalDAVPath = req.path.startsWith('/caldav/');
if (isCalDAVPath) req._csrfExempt = true;
```

---

## Implementation Phases

### Phase 1: Database & Models
- Schema design, create 4 migrations, write models
- Repository layer (CRUD operations)
- Encryption service (AES-256-GCM)
**Testing:** Unit tests for models, repositories, encryption

### Phase 2: iCalendar Transformation
- VTODO serialization (Task → VTODO)
- RRULE generation (recurrence → RRULE)
- VTODO parsing (VTODO → Task)
- RRULE parsing (RRULE → recurrence)
**Testing:** Unit tests for serialization, parsing, round-trip conversion

### Phase 3: WebDAV Protocol
- PROPFIND handler, XML utilities, multistatus responses
- REPORT handler (calendar-query, filters)
- GET/PUT/DELETE handlers (task CRUD)
- Discovery, HTTP Basic Auth, ETag generation
- Recurring task expansion (RECURRENCE-ID)
**Testing:** Integration tests with mock CalDAV requests

### Phase 4: Synchronization Engine
- Sync state management (ETags, CTags, sync-tokens)
- Pull phase (fetch from remote)
- Merge phase (conflict detection, resolution)
- Push phase (send to remote)
- Sync orchestrator (coordinate phases)
**Testing:** Integration tests with mock CalDAV server

### Phase 5: Background Scheduler & API
- Cron scheduler (node-cron, periodic sync)
- REST API endpoints (calendar CRUD, remote config)
- Error handling, retry logic, status reporting
**Testing:** API integration tests

### Phase 6: Frontend
- CalDAV settings tab (calendar list, forms)
- Sync controls (manual trigger, intervals, toggles)
- Conflict resolution UI (diff view, resolution)
- Setup wizard (step-by-step remote config)
**Testing:** E2E tests with Playwright

### Phase 7: Client Compatibility
- Test with tasks.org, Apple Reminders, Thunderbird, Evolution
- Performance optimization (indexes, caching, 1000+ tasks < 30s)
- Bug fixes, edge cases (timezones, deleted instances)
**Testing:** E2E tests with real CalDAV clients

### Phase 8: Documentation & Polish
- User docs (setup guides for Nextcloud, Baikal, client configs)
- Developer docs (protocol implementation, VTODO mappings)
- Final testing, README updates, release notes
**Testing:** Full E2E regression

---

## Environment Variables

```bash
# Feature toggle
CALDAV_ENABLED=true

# Encryption
ENCRYPTION_KEY=your-256-bit-key  # Falls back to SECRET_KEY

# Defaults
CALDAV_DEFAULT_SYNC_INTERVAL=15         # Minutes
CALDAV_MAX_RECURRING_INSTANCES=365      # Number of future instances to expand
CALDAV_CONFLICT_RESOLUTION=last_write_wins

# Performance
CALDAV_RATE_LIMIT=60                    # Requests per minute
CALDAV_MAX_SYNC_TASKS=1000             # Max tasks per sync
CALDAV_REQUEST_TIMEOUT=30000           # Milliseconds

# Debugging
CALDAV_LOG_LEVEL=info
CALDAV_LOG_REQUESTS=false
```

---

## Critical Files to Modify/Create

### Top 5 Most Critical Files

1. **`/backend/modules/caldav/icalendar/vtodo-serializer.js`**
   Core transformation logic (Task → VTODO). Handles all field mappings, recurrence, edge cases. Foundation of CalDAV interoperability.

2. **`/backend/modules/caldav/sync/sync-engine.js`**
   Orchestrates bidirectional sync (pull, merge, push). Handles conflict detection, resolution, error recovery. Critical for data integrity.

3. **`/backend/modules/caldav/webdav/propfind.js`**
   Primary CalDAV protocol handler. Clients use this to discover and list tasks. Must generate correct WebDAV XML per RFC 4791.

4. **`/backend/modules/caldav/routes.js`**
   Defines all CalDAV endpoints (WebDAV + REST API). Integrates auth middleware, mounts handlers. Central routing configuration.

5. **`/backend/migrations/20260420000001-create-caldav-calendars.js`**
   Foundational database schema. All other tables depend on `caldav_calendars`. Schema design affects entire implementation.

### Other Critical Files

- `/backend/app.js` - Register CalDAV routes, custom HTTP methods
- `/backend/models/caldav_calendar.js` - Calendar model
- `/backend/modules/caldav/middleware/caldav-auth.js` - HTTP Basic Auth
- `/backend/modules/caldav/icalendar/rrule-generator.js` - RRULE generation
- `/backend/modules/caldav/services/sync-scheduler.js` - Background sync
- `/frontend/components/Settings/tabs/CalDAVTab.tsx` - Settings UI

---

## Verification Steps

### 1. CalDAV Discovery
- Access `https://TaskNoteTaker.example.com/.well-known/caldav`
- Should redirect to `/caldav/`
- OPTIONS request returns CalDAV capabilities

### 2. Client Connection (tasks.org)
- Configure tasks.org with server URL: `https://TaskNoteTaker.example.com/caldav/`
- Username: user's email
- Password: user's TaskNoteTaker password
- Client discovers `/caldav/{username}/tasks/` calendar
- Tasks appear in tasks.org

### 3. Task Synchronization
- Create task in TaskNoteTaker web UI
- Sync in tasks.org → Task appears with correct fields
- Edit task in tasks.org
- Sync in TaskNoteTaker → Changes reflected

### 4. Recurring Tasks
- Create "Daily meeting" recurring task in TaskNoteTaker
- Sync to tasks.org → Next 7 instances appear
- Complete one instance in tasks.org
- Sync to TaskNoteTaker → Completion recorded

### 5. Conflict Resolution
- Edit task in TaskNoteTaker (status: "In Progress")
- Edit same task in tasks.org (status: "Completed")
- Trigger sync → Conflict detected and stored
- Resolve via UI (choose remote) → Status updated to "Completed"

### 6. Background Sync
- Configure calendar with 15-minute interval
- Wait 15 minutes → Check logs for automatic sync
- Verify `last_sync_at` updated in database

### 7. Performance
- Create 1000 tasks
- PROPFIND request completes in < 5 seconds
- Sync completes in < 30 seconds

### 8. Edge Cases
- Delete recurring task in TaskNoteTaker → Removed from tasks.org
- Invalid VTODO from client → Error logged, sync continues
- Network failure → Retry with exponential backoff
- Timezone changes → Dates preserved correctly

---

## Success Criteria

✅ CalDAV discovery works (`/.well-known/caldav`)
✅ PROPFIND/REPORT list tasks with proper WebDAV XML
✅ PUT/DELETE create/update/remove tasks
✅ Sync-collection provides incremental sync (RFC 6578)
✅ Tasks serialize to valid VTODO, all fields preserved
✅ VTODO parses back without data loss
✅ RRULE generation/parsing handles all recurrence patterns
✅ Virtual instances expanded with RECURRENCE-ID
✅ Edited instances stored in `caldav_occurrence_overrides`
✅ Status/priority mappings work bidirectionally
✅ Bidirectional sync works (local ↔ remote)
✅ Conflict detection and resolution functional
✅ Background scheduler runs automatically
✅ Manual sync trigger works
✅ **Client compatibility:**
  - ✅ tasks.org (Android/iOS)
  - ✅ Apple Reminders (iOS/macOS)
  - ✅ Thunderbird (desktop)
  - ✅ Evolution (Linux)
✅ HTTP Basic Auth works for CalDAV clients
✅ Password encryption secure (AES-256-GCM)
✅ 1000 tasks sync in < 30 seconds
✅ Settings UI complete
✅ Conflict resolver UI functional
✅ All tests pass (unit, integration, E2E)
✅ Documentation complete

---

## Known Limitations

1. **Subtasks:** RELATED-TO property used, but not all clients support hierarchical rendering
2. **Habit Mode:** Stored in X-TUDUDI-* properties, not visible in external clients
3. **Tags:** Exported as CATEGORIES, but tag colors/metadata only in TaskNoteTaker
4. **Projects:** Stored in X-TUDUDI-PROJECT-UID, external clients won't show association
5. **Status Granularity:** 7 TaskNoteTaker statuses mapped to 4 iCalendar statuses (some nuance lost)
6. **Timezone Handling:** Always use UTC in VTODO, convert in UI (document per-client quirks)
7. **Large Recurring Sequences:** Expanding far into the future creates many VTODOs (configurable limit)

---

## References

- [Issue #978](https://github.com/chrisvel/TaskNoteTaker/issues/978)
- [Discussion #246](https://github.com/chrisvel/TaskNoteTaker/discussions/246)
- [RFC 4791 (CalDAV)](https://datatracker.ietf.org/doc/html/rfc4791)
- [RFC 5545 (iCalendar)](https://datatracker.ietf.org/doc/html/rfc5545)
- [RFC 6578 (Sync-Collection)](https://datatracker.ietf.org/doc/html/rfc6578)
- [ical.js](https://github.com/kewisch/ical.js)
- [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js)
