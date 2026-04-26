# CalDAV Implementation - Developer Guide

This document provides detailed technical information about TaskNoteTaker's CalDAV implementation for developers working on the codebase.

---

## Architecture Overview

### Protocol Stack

```
┌─────────────────────────────────────┐
│   CalDAV Clients (tasks.org, etc)  │
└─────────────────┬───────────────────┘
                  │ HTTP/HTTPS
┌─────────────────┴───────────────────┐
│   WebDAV/CalDAV Protocol Layer      │
│   (PROPFIND, REPORT, GET, PUT, etc) │
└─────────────────┬───────────────────┘
                  │
┌─────────────────┴───────────────────┐
│   iCalendar Transformation Layer    │
│   (Task ↔ VTODO serialization)     │
└─────────────────┬───────────────────┘
                  │
┌─────────────────┴───────────────────┐
│   Synchronization Engine            │
│   (Pull → Merge → Push phases)      │
└─────────────────┬───────────────────┘
                  │
┌─────────────────┴───────────────────┐
│   Repository & Database Layer       │
│   (SQLite with CalDAV tables)       │
└─────────────────────────────────────┘
```

### Module Structure

```
backend/modules/caldav/
├── index.js                    # Module exports
├── routes.js                   # WebDAV/CalDAV HTTP handlers
├── webdav/                     # WebDAV protocol implementation
│   ├── propfind.js            # PROPFIND method handler
│   ├── report.js              # REPORT method handler (calendar-query)
│   ├── options.js             # OPTIONS method handler
│   ├── task-handlers.js       # GET/PUT/DELETE task operations
│   └── utils.js               # WebDAV XML utilities
├── protocol/
│   ├── discovery.js           # .well-known handler
│   ├── capabilities.js        # CalDAV capabilities
│   └── sync-collection.js     # RFC 6578 sync-token (future)
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
├── repositories/               # Data access layer
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
├── api/                        # REST API endpoints
│   ├── routes.js              # API route definitions
│   ├── calendar-controller.js # Calendar CRUD
│   ├── remote-calendar-controller.js
│   └── sync-controller.js     # Manual sync, status
└── utils/
    ├── etag-generator.js
    ├── ctag-generator.js
    └── validation.js
```

---

## Database Schema

### Tables

#### caldav_calendars

Local calendar configurations (per-user calendars served by TaskNoteTaker).

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

**Indexes:**
- `idx_caldav_calendars_user_id` on `user_id`
- `idx_caldav_calendars_enabled` on `enabled`
- `idx_caldav_calendars_user_enabled` on `(user_id, enabled)`

#### caldav_sync_state

Per-task sync tracking metadata.

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

**Indexes:**
- `idx_caldav_sync_state_task_id` on `task_id`
- `idx_caldav_sync_state_calendar_id` on `calendar_id`
- `idx_caldav_sync_state_status` on `sync_status`
- `idx_caldav_sync_state_modified` on `last_modified`

#### caldav_occurrence_overrides

Stores edited instances of recurring tasks.

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

**Indexes:**
- `idx_caldav_overrides_parent` on `parent_task_id`
- `idx_caldav_overrides_calendar` on `calendar_id`
- `idx_caldav_overrides_recurrence` on `recurrence_id`

#### caldav_remote_calendars

External CalDAV server configurations.

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

**Indexes:**
- `idx_caldav_remote_user_id` on `user_id`
- `idx_caldav_remote_enabled` on `enabled`
- `idx_caldav_remote_local_cal` on `local_calendar_id`

---

## WebDAV Protocol Implementation

### HTTP Method Registration

Express doesn't support WebDAV methods (PROPFIND, REPORT, etc.) by default. Register custom methods in [app.js](../../backend/app.js):

```javascript
['PROPFIND', 'REPORT', 'MKCALENDAR'].forEach(method => {
  express.Router[method.toLowerCase()] = function(path, ...handlers) {
    return this.route(path)[method.toLowerCase()] = handlers;
  };
});
```

### Discovery Endpoint

**Location:** [backend/modules/caldav/protocol/discovery.js](../../backend/modules/caldav/protocol/discovery.js)

**RFC 6764 .well-known Discovery:**

```javascript
router.get('/.well-known/caldav', (req, res) => {
  res.redirect(301, '/caldav/');
});
```

### PROPFIND Handler

**Location:** [backend/modules/caldav/webdav/propfind.js](../../backend/modules/caldav/webdav/propfind.js)

**Purpose:** List calendar resources and properties

**Request Example:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <D:getcontenttype/>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
</D:propfind>
```

**Response Structure:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/caldav/user@example.com/tasks/task-uid-123/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
        <D:getcontenttype>text/calendar; component=VTODO</D:getcontenttype>
        <D:getetag>"etag-value-here"</D:getetag>
        <C:calendar-data>BEGIN:VCALENDAR...END:VCALENDAR</C:calendar-data>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>
```

**Implementation Notes:**
- Depth: 0 returns collection properties only
- Depth: 1 returns collection + all resources
- ETags generated from task `updated_at` timestamp
- Recurring tasks expanded into virtual instances

### REPORT Handler

**Location:** [backend/modules/caldav/webdav/report.js](../../backend/modules/caldav/webdav/report.js)

**Purpose:** Query/filter calendar resources

**Supported Reports:**
- `calendar-query` - Query with filters
- `calendar-multiget` - Fetch specific resources by URL
- `sync-collection` - Incremental sync (RFC 6578)

**calendar-query Example:**

```xml
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VTODO">
        <C:time-range start="20260401T000000Z" end="20260430T235959Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>
```

**Supported Filters:**
- `comp-filter` - Component type (VCALENDAR, VTODO)
- `time-range` - Date/time range filtering
- `prop-filter` - Property value filtering (limited support)

### Task Operations (GET/PUT/DELETE)

**Location:** [backend/modules/caldav/webdav/task-handlers.js](../../backend/modules/caldav/webdav/task-handlers.js)

#### GET - Fetch Task

```http
GET /caldav/{username}/tasks/{uid}/ HTTP/1.1
Authorization: Basic base64(email:password)
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: text/calendar; charset=utf-8
ETag: "etag-value"

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskNoteTaker//CalDAV Server//EN
BEGIN:VTODO
UID:task-uid-123
SUMMARY:Task Title
...
END:VTODO
END:VCALENDAR
```

#### PUT - Create/Update Task

```http
PUT /caldav/{username}/tasks/{uid}/ HTTP/1.1
Authorization: Basic base64(email:password)
Content-Type: text/calendar; charset=utf-8

BEGIN:VCALENDAR
...
END:VCALENDAR
```

**Response:**
- 201 Created (new task)
- 204 No Content (updated task)

**ETag Handling:**
- If-Match header supported for optimistic locking
- If-None-Match: * to prevent overwrite

#### DELETE - Remove Task

```http
DELETE /caldav/{username}/tasks/{uid}/ HTTP/1.1
Authorization: Basic base64(email:password)
```

**Response:**
- 204 No Content (success)
- 404 Not Found (task doesn't exist)

---

## iCalendar Transformation

### Task → VTODO Serialization

**Location:** [backend/modules/caldav/icalendar/vtodo-serializer.js](../../backend/modules/caldav/icalendar/vtodo-serializer.js)

**Field Mappings:**

```javascript
const fieldMappings = {
  uid: (task) => task.uid,
  summary: (task) => task.name,
  description: (task) => task.note || '',
  due: (task) => task.due_date ? formatDateTimeUTC(task.due_date) : null,
  dtstart: (task) => task.defer_until ? formatDateTimeUTC(task.defer_until) : null,
  completed: (task) => task.completed_at ? formatDateTimeUTC(task.completed_at) : null,
  status: (task) => mapStatus(task.status),
  priority: (task) => mapPriority(task.priority),
  created: (task) => formatDateTimeUTC(task.created_at),
  dtstamp: () => formatDateTimeUTC(new Date()),
  'last-modified': (task) => formatDateTimeUTC(task.updated_at)
};
```

**Status Mapping:**

```javascript
const STATUS_MAP = {
  0: 'NEEDS-ACTION',  // NOT_STARTED
  1: 'IN-PROCESS',    // IN_PROGRESS
  2: 'COMPLETED',     // DONE
  3: 'COMPLETED',     // ARCHIVED
  4: 'NEEDS-ACTION',  // WAITING
  5: 'CANCELLED',     // CANCELLED
  6: 'NEEDS-ACTION'   // PLANNED
};
```

**Priority Mapping (Inverse Scale):**

```javascript
function mapPriority(tasknotetakerPriority) {
  // TaskNoteTaker: 0=Low, 1=Medium, 2=High
  // iCalendar: 1=Highest, 5=Medium, 9=Lowest
  const priorityMap = { 0: 7, 1: 5, 2: 3 };
  return priorityMap[tasknotetakerPriority] || 5;
}
```

**Recurrence (RRULE) Generation:**

```javascript
function generateRRule(task) {
  const rruleMap = {
    daily: () => `FREQ=DAILY;INTERVAL=${task.recurrence_interval || 1}`,
    weekly: () => {
      const days = task.recurrence_weekdays || [1]; // Default Monday
      const byDay = days.map(d => ['SU','MO','TU','WE','TH','FR','SA'][d]).join(',');
      return `FREQ=WEEKLY;BYDAY=${byDay}`;
    },
    monthly: () => {
      if (task.recurrence_month_day) {
        return `FREQ=MONTHLY;BYMONTHDAY=${task.recurrence_month_day}`;
      }
      // Monthly by weekday (e.g., 2nd Thursday)
      const week = task.recurrence_week || 1;
      const day = ['SU','MO','TU','WE','TH','FR','SA'][task.recurrence_weekday || 1];
      return `FREQ=MONTHLY;BYDAY=${week}${day}`;
    },
    yearly: () => `FREQ=YEARLY;BYMONTH=${task.recurrence_month || 1}`
  };

  let rrule = rruleMap[task.recurrence_pattern]?.();
  if (!rrule) return null;

  // Add count or until
  if (task.recurrence_count) {
    rrule += `;COUNT=${task.recurrence_count}`;
  } else if (task.recurrence_end_date) {
    rrule += `;UNTIL=${formatDateTimeUTC(task.recurrence_end_date)}`;
  }

  return rrule;
}
```

### VTODO → Task Parsing

**Location:** [backend/modules/caldav/icalendar/vtodo-parser.js](../../backend/modules/caldav/icalendar/vtodo-parser.js)

**Parsing Workflow:**

```javascript
function vtodoToTask(vtodoString) {
  // 1. Parse iCalendar string
  const jcalData = ICAL.parse(vtodoString);
  const comp = new ICAL.Component(jcalData);
  const vtodoComp = comp.getFirstSubcomponent('vtodo');

  // 2. Extract basic properties
  const task = {
    uid: vtodoComp.getFirstPropertyValue('uid'),
    name: vtodoComp.getFirstPropertyValue('summary'),
    note: vtodoComp.getFirstPropertyValue('description'),
  };

  // 3. Parse dates (convert to UTC)
  const due = vtodoComp.getFirstPropertyValue('due');
  if (due) task.due_date = due.toJSDate().toISOString();

  const dtstart = vtodoComp.getFirstPropertyValue('dtstart');
  if (dtstart) task.defer_until = dtstart.toJSDate().toISOString();

  // 4. Parse status and priority
  const status = vtodoComp.getFirstPropertyValue('status');
  task.status = reverseMapStatus(status);

  const priority = vtodoComp.getFirstPropertyValue('priority');
  task.priority = reverseMapPriority(priority);

  // 5. Parse recurrence
  const rrule = vtodoComp.getFirstPropertyValue('rrule');
  if (rrule) {
    Object.assign(task, parseRRule(rrule));
  }

  // 6. Parse custom properties
  const customProps = vtodoComp.getAllProperties().filter(p =>
    p.name.startsWith('x-tasknotetaker-')
  );
  customProps.forEach(prop => {
    // Handle X-TASKNOTETAKER-* properties
  });

  return task;
}
```

**Reverse Priority Mapping:**

```javascript
function reverseMapPriority(icalPriority) {
  // iCalendar 1-9 → TaskNoteTaker 0-2
  if (icalPriority >= 1 && icalPriority <= 3) return 2; // High
  if (icalPriority >= 4 && icalPriority <= 6) return 1; // Medium
  if (icalPriority >= 7 && icalPriority <= 9) return 0; // Low
  return 1; // Default to medium
}
```

---

## Synchronization Engine

### Architecture

**Location:** [backend/modules/caldav/sync/sync-engine.js](../../backend/modules/caldav/sync/sync-engine.js)

**Three-Phase Process:**

```
┌─────────────┐
│ PULL PHASE  │ Fetch changes from remote CalDAV server
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ MERGE PHASE │ Detect conflicts, apply resolution strategy
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PUSH PHASE  │ Send local changes to remote server
└─────────────┘
```

### Pull Phase

**Location:** [backend/modules/caldav/sync/pull-phase.js](../../backend/modules/caldav/sync/pull-phase.js)

```javascript
async function pullChanges(remoteCalendar) {
  // 1. Send PROPFIND or REPORT to remote server
  const response = await fetch(`${remoteCalendar.server_url}${remoteCalendar.calendar_path}`, {
    method: 'PROPFIND',
    headers: {
      'Authorization': `Basic ${getAuthHeader(remoteCalendar)}`,
      'Depth': '1',
      'Content-Type': 'application/xml'
    },
    body: buildPropfindRequest(['getetag', 'calendar-data'])
  });

  // 2. Parse multistatus response
  const remoteResources = parseMultistatusResponse(await response.text());

  // 3. Convert VTODOs to tasks
  const remoteTasks = remoteResources.map(resource => ({
    task: vtodoParser.vtodoToTask(resource.calendarData),
    etag: resource.etag,
    href: resource.href
  }));

  return remoteTasks;
}
```

### Merge Phase

**Location:** [backend/modules/caldav/sync/merge-phase.js](../../backend/modules/caldav/sync/merge-phase.js)

```javascript
async function mergeChanges(localTasks, remoteTasks, conflictStrategy) {
  const conflicts = [];
  const toUpdate = [];
  const toCreate = [];

  for (const remoteTask of remoteTasks) {
    const localTask = localTasks.find(t => t.uid === remoteTask.task.uid);

    if (!localTask) {
      // New remote task, create locally
      toCreate.push(remoteTask);
      continue;
    }

    const syncState = await SyncStateRepository.findByTaskAndCalendar(
      localTask.id,
      calendar.id
    );

    // Check for conflicts
    if (syncState.etag !== remoteTask.etag &&
        localTask.updated_at > syncState.last_synced_at) {
      // Both local and remote changed
      conflicts.push({
        task: localTask,
        localVersion: localTask,
        remoteVersion: remoteTask.task,
        remoteEtag: remoteTask.etag
      });
      continue;
    }

    // Remote changed, local didn't
    if (syncState.etag !== remoteTask.etag) {
      toUpdate.push(remoteTask);
    }
  }

  // Apply conflict resolution
  const resolved = await resolveConflicts(conflicts, conflictStrategy);

  return { toCreate, toUpdate, resolved };
}
```

### Push Phase

**Location:** [backend/modules/caldav/sync/push-phase.js](../../backend/modules/caldav/sync/push-phase.js)

```javascript
async function pushChanges(localChanges, remoteCalendar) {
  for (const task of localChanges) {
    const vtodo = vtodoSerializer.taskToVTodo(task);
    const href = `${remoteCalendar.server_url}${remoteCalendar.calendar_path}${task.uid}/`;

    const response = await fetch(href, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${getAuthHeader(remoteCalendar)}`,
        'Content-Type': 'text/calendar; charset=utf-8',
        'If-Match': task.syncState?.etag || '*'
      },
      body: vtodo
    });

    if (response.ok) {
      const newEtag = response.headers.get('etag');
      await SyncStateRepository.updateEtag(task.id, remoteCalendar.id, newEtag);
    }
  }
}
```

### Conflict Resolution Strategies

**Location:** [backend/modules/caldav/sync/conflict-resolver.js](../../backend/modules/caldav/sync/conflict-resolver.js)

```javascript
const strategies = {
  last_write_wins: (local, remote) => {
    return new Date(local.updated_at) > new Date(remote.updated_at)
      ? local
      : remote;
  },

  local_wins: (local, remote) => local,

  remote_wins: (local, remote) => remote,

  manual: (local, remote) => {
    // Store both versions for manual resolution
    return {
      requiresManualResolution: true,
      local,
      remote
    };
  }
};
```

---

## Authentication

### HTTP Basic Auth

**Location:** [backend/modules/caldav/middleware/caldav-auth.js](../../backend/modules/caldav/middleware/caldav-auth.js)

```javascript
async function caldavAuth(req, res, next) {
  // 1. Check for existing session (web UI)
  if (req.session?.userId) {
    req.currentUser = await User.findByPk(req.session.userId);
    return next();
  }

  // 2. Check for Bearer token (API)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    // Validate API token
    return next();
  }

  // 3. Parse HTTP Basic Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Basic ')) {
    return res.status(401)
      .set('WWW-Authenticate', 'Basic realm="TaskNoteTaker CalDAV"')
      .json({ error: 'Authentication required' });
  }

  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  // 4. Validate credentials
  const user = await User.findOne({ where: { email: username } });
  if (!user || !await bcrypt.compare(password, user.password_digest)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.currentUser = user;
  next();
}
```

---

## Security

### Password Encryption

**Location:** [backend/modules/caldav/services/encryption-service.js](../../backend/modules/caldav/services/encryption-service.js)

**AES-256-GCM Encryption:**

```javascript
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || process.env.SECRET_KEY, 'utf-8').slice(0, 32);

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex')
  });
}

function decrypt(ciphertext) {
  const { iv, encrypted, authTag } = JSON.parse(ciphertext);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };
```

### XML Injection Prevention

**Location:** [backend/modules/caldav/middleware/xml-parser.js](../../backend/modules/caldav/middleware/xml-parser.js)

```javascript
const xml2js = require('xml2js');

const parser = new xml2js.Parser({
  explicitArray: false,
  ignoreAttrs: false,
  trim: true,
  normalize: true,
  // Security: Disable external entities
  xmlns: false,
  explicitRoot: true,
  // Prevent billion laughs attack
  strict: true
});
```

---

## Performance Optimizations

### Database Indexes

**Migration:** [20260420000005-add-caldav-indexes.js](../../backend/migrations/20260420000005-add-caldav-indexes.js)

Critical indexes for performance:
- `tasks.uid` - Fast task lookup by UID
- `tasks.updated_at` - Identify changed tasks
- `caldav_sync_state.task_id` - Sync state lookup
- `caldav_sync_state.calendar_id` - Calendar-based queries
- `caldav_sync_state.last_modified` - Incremental sync

### Caching Strategy

**ETag Caching:**
- ETags generated from task `updated_at` timestamp
- Clients cache VTODO data, re-fetch only if ETag changed
- Reduces bandwidth and serialization overhead

**CTag (Collection Tag):**
- Single tag for entire calendar collection
- Changes when any task in calendar changes
- Enables quick "has anything changed?" check

### Recurring Task Expansion

**Lazy Expansion:**
- Parent task stored once in database
- Instances generated on-demand during serialization
- Configurable limit (default: 365 instances)
- Prevents database bloat from thousands of future instances

**Implementation:**

```javascript
function expandRecurringTask(parentTask, maxInstances = 365) {
  if (!parentTask.recurrence_pattern) return [parentTask];

  const instances = [];
  const rrule = parseRRule(parentTask);
  const dates = rrule.between(new Date(), addDays(new Date(), 365), true, maxInstances);

  dates.forEach((date, index) => {
    const instance = {
      ...parentTask,
      uid: `${parentTask.uid}`,  // Same UID
      recurrenceId: date.toISOString(),  // RECURRENCE-ID property
      due_date: date.toISOString()
    };
    instances.push(instance);
  });

  return instances;
}
```

---

## Testing

### Unit Tests

**Location:** [backend/tests/unit/caldav/](../../backend/tests/unit/caldav/)

Test coverage:
- iCalendar serialization/parsing
- RRULE generation/parsing
- Field mappings (status, priority)
- Encryption/decryption
- ETag/CTag generation

### Integration Tests

**Location:** [backend/tests/integration/caldav.test.js](../../backend/tests/integration/caldav.test.js)

Test scenarios:
- WebDAV method handlers (PROPFIND, REPORT, etc.)
- Authentication (Basic Auth, sessions)
- Task CRUD operations
- Recurring task expansion
- Conflict detection and resolution
- Sync engine phases

### E2E Tests

**Location:** [e2e/tests/caldav-client.spec.ts](../../e2e/tests/caldav-client.spec.ts)

Test real-world client interactions:
- CalDAV discovery
- PROPFIND with Depth: 0 and 1
- REPORT with calendar-query
- GET/PUT/DELETE task operations
- Recurring task synchronization
- Performance (large calendars)

---

## Debugging

### Enable Debug Logging

```bash
CALDAV_LOG_LEVEL=debug
CALDAV_LOG_REQUESTS=true
```

### Common Issues

**Issue:** PROPFIND returns empty multistatus

**Debug:**
```javascript
console.log('Tasks found:', tasks.length);
console.log('Expanded instances:', expandedTasks.length);
console.log('XML response:', xmlResponse);
```

**Issue:** RRULE parsing fails

**Debug:**
```javascript
const rrule = vtodoComp.getFirstPropertyValue('rrule');
console.log('RRULE object:', rrule);
console.log('Frequency:', rrule.freq);
console.log('Interval:', rrule.interval);
```

**Issue:** Sync conflicts not detected

**Debug:**
```javascript
console.log('Local updated_at:', localTask.updated_at);
console.log('Sync state updated_at:', syncState.last_synced_at);
console.log('Remote etag:', remoteTask.etag);
console.log('Sync state etag:', syncState.etag);
```

---

## References

### RFCs

- [RFC 4791 - CalDAV](https://datatracker.ietf.org/doc/html/rfc4791) - CalDAV protocol
- [RFC 5545 - iCalendar](https://datatracker.ietf.org/doc/html/rfc5545) - iCalendar format
- [RFC 6578 - Sync-Collection](https://datatracker.ietf.org/doc/html/rfc6578) - Incremental sync
- [RFC 4918 - WebDAV](https://datatracker.ietf.org/doc/html/rfc4918) - WebDAV protocol

### Libraries

- [ical.js](https://github.com/kewisch/ical.js) - iCalendar parsing/generation
- [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) - XML parsing
- [node-cron](https://github.com/node-cron/node-cron) - Background scheduling

### External Resources

- [CalDAV Client Implementation Guide](https://sabredav.org/dav/building-a-caldav-client/)
- [Apple CalDAV Server](https://github.com/apple/ccs-calendarserver)
- [Radicale CalDAV Server](https://radicale.org/)

---

## Contributing

When working on CalDAV features:

1. **Follow existing patterns** - Use repository pattern for data access
2. **Write tests** - Unit tests for logic, integration tests for HTTP handlers
3. **Update docs** - Keep user and developer docs in sync
4. **Test with clients** - Verify with tasks.org, Thunderbird, or Apple Reminders
5. **Performance matters** - Profile with 1000+ tasks, optimize queries
6. **Security first** - Validate all inputs, use prepared statements, encrypt passwords

### Adding New VTODO Properties

1. Update field mappings in [field-mappings.js](../../backend/modules/caldav/icalendar/field-mappings.js)
2. Add serialization in [vtodo-serializer.js](../../backend/modules/caldav/icalendar/vtodo-serializer.js)
3. Add parsing in [vtodo-parser.js](../../backend/modules/caldav/icalendar/vtodo-parser.js)
4. Write round-trip tests in [backend/tests/unit/caldav/](../../backend/tests/unit/caldav/)
5. Update user documentation in [docs/11-caldav-sync.md](../11-caldav-sync.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-04-20
**Maintainer:** Update when CalDAV implementation changes
