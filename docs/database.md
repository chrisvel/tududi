# Database & Migrations

[← Back to Index](../CLAUDE.md)

---

## Key Models

All Sequelize models are defined in `/backend/models/` and associations are configured in `/backend/models/index.js`.

### Core Models

| Model | File | Purpose | Key Fields |
|-------|------|---------|------------|
| **User** | `user.js` | User accounts | email, password (bcrypt), settings, preferences, timezone |
| **Role** | `role.js` | Role per user | user_id, role (admin/user/guest), is_admin, capabilities |
| **Task** | `task.js` | Tasks with recurrence | name, due_date, priority, status, recurrence_type, parent_task_id |
| **Project** | `project.js` | Project grouping | name, area_id, goal_id, status, is_maintenance, is_template, user_id |
| **Area** | `area.js` | Area categorization | name, color, user_id |
| **Goal** | `goal.js` | Outcome-level goals | title, why, horizon, target_date, status, color, area_id |
| **Note** | `note.js` | Notes | title, content, project_id, color, public_token, user_id |
| **Tag** | `tag.js` | Tags | name, tag_type (user/system), pinned, color, user_id |
| **Permission** | `permission.js` | Direct shares | user_id, resource_type, resource_uid, access_level, status (pending/accepted) |
| **ApiToken** | `api_token.js` | API tokens | user_id, name, token_hash, token_prefix, expires_at, revoked_at |
| **RecurringCompletion** | `recurringCompletion.js` | Recurring task history | task_id, completed_at, due_date |
| **TaskEvent** | `task_event.js` | Task audit log | task_id, user_id, event_type, field_name, old_value, new_value |
| **TaskAttachment** | `task_attachment.js` | File attachments | task_id, original_filename, stored_filename, mime_type, file_size |
| **Comment** | `comment.js` | Task comments | task_id, user_id, body, parent_comment_id, mentioned_person_uids, deleted_at |
| **CommentReaction** | `comment_reaction.js` | Comment reactions | comment_id, user_id, reaction_type (like/dislike) |
| **InboxItem** | `inbox_item.js` | Inbox entries | content, title, status, source, user_id |
| **Notification** | `notification.js` | User notifications | user_id, type, level, title, data, read_at, dismissed_at |
| **View** | `view.js` | Saved views | name, search_query, filters, is_pinned, user_id |
| **Backup** | `backup.js` | Backup records | user_id, file_path, file_size, item_counts, version |

### Sharing, People and Groups

| Model | File | Purpose | Key Fields |
|-------|------|---------|------------|
| **UserGroup** | `userGroup.js` | Admin-managed group | name, description, created_by_user_id |
| **UserGroupMember** | `userGroupMember.js` | Group membership | group_id, user_id |
| **GroupShare** | `groupShare.js` | An item shared with a group | group_id, resource_type, resource_uid, access_level |
| **GroupPermission** | `groupPermission.js` | Per-member grant from a group share | group_share_id, user_id, resource_uid, access_level, status |
| **Person** | `person.js` | Contact or member card | name, linked_user_id, relationship_type, email |
| **MemberSignInLink** | `memberSignInLink.js` | Sign-in link for members without an email | user_id, token_hash, expires_at, used_at |
| **UserProjectArea** | `user_project_area.js` | Per-user area placement of a shared project | user_id, project_id, area_id |

Read shared access through `permissionSources`, never `Permission` alone: group grants live in `group_permissions` (see [User Groups](18-user-groups.md)).

### Auth, Integrations and Hosted Mode

| Model | File | Purpose |
|-------|------|---------|
| **OIDCIdentity**, **OIDCStateNonce** | `oidc_identity.js`, `oidc_state_nonce.js` | Linked SSO identities and login state |
| **AuthAuditLog** | `auth_audit_log.js` | Sign-in and auth events |
| **CalDAVCalendar**, **CalDAVRemoteCalendar**, **CalDAVSyncState**, **CalDAVOccurrenceOverride** | `caldav_*.js` | CalDAV server and sync (see [CalDAV](11-caldav-sync.md)) |
| **CalendarToken** | `calendar_token.js` | External calendar OAuth tokens |
| **BillingAccount**, **BillingEvent**, **UsageCounter** | `billing_account.js`, `billing_event.js`, `usage_counter.js` | Subscriptions, webhook events and metered usage (see [Hosted Mode](17-hosted-mode.md)) |
| **WaitlistSubscriber** | `waitlist_subscriber.js` | Release-notes signups from the marketing page (formerly the Cloud waitlist) |
| **RateLimit** | `rate_limit.js` | Shared rate-limit store |
| **Setting**, **Action** | `setting.js`, `action.js` | Instance key-value settings; audit trail of share actions (actor, verb, resource, target) |

---

## Model Relationships

Defined in `/backend/models/index.js`:

```javascript
// User relationships (one user has many resources)
User.hasMany(Task, { foreignKey: 'user_id' });
User.hasMany(Project, { foreignKey: 'user_id' });
User.hasMany(Area, { foreignKey: 'user_id' });
User.hasMany(Note, { foreignKey: 'user_id' });

// Hierarchical relationships
// Area > Project
Area.hasMany(Project, { foreignKey: 'area_id' });
Project.belongsTo(Area, { foreignKey: 'area_id' });

// Project > Task
Project.hasMany(Task, { foreignKey: 'project_id' });
Task.belongsTo(Project, { foreignKey: 'project_id' });

// Project > Note
Project.hasMany(Note, { foreignKey: 'project_id' });
Note.belongsTo(Project, { foreignKey: 'project_id' });

// Self-referential (subtasks and recurring tasks)
Task.hasMany(Task, { as: 'Subtasks', foreignKey: 'parent_task_id' });
Task.belongsTo(Task, { as: 'ParentTask', foreignKey: 'parent_task_id' });

// Many-to-many relationships (tags)
Task.belongsToMany(Tag, { through: 'tasks_tags' });
Tag.belongsToMany(Task, { through: 'tasks_tags' });

Project.belongsToMany(Tag, { through: 'projects_tags' });
Tag.belongsToMany(Project, { through: 'projects_tags' });

Note.belongsToMany(Tag, { through: 'notes_tags' });
Tag.belongsToMany(Note, { through: 'notes_tags' });
```

---

## Database Schema Diagram

The following diagram visualizes the database structure and relationships:

```mermaid
%%{init: {'theme':'dark'}}%%
erDiagram
    User ||--o{ Task : owns
    User ||--o{ Project : owns
    User ||--o{ Area : owns
    User ||--o{ Note : owns
    User ||--o{ Tag : owns
    User ||--o{ ApiToken : has
    User ||--o{ Notification : receives
    User ||--o{ View : creates
    User ||--o{ InboxItem : has
    User ||--o{ Backup : has
    User ||--o| Role : has_role

    Area ||--o{ Project : contains

    Project ||--o{ Task : contains
    Project ||--o{ Note : contains
    Project }o--o{ Tag : tagged_with
    Project ||--o{ Permission : shared_via

    Task ||--o{ Task : subtasks
    Task ||--o{ TaskEvent : events
    Task ||--o{ TaskAttachment : attachments
    Task ||--o{ RecurringCompletion : completions
    Task }o--o{ Tag : tagged_with
    Task ||--o{ Permission : shared_via

    Note }o--o{ Tag : tagged_with
    Note ||--o{ Permission : shared_via

    User {
        int id PK
        string uid UK
        string email UK
        string password_hash
        string timezone
        json settings
        json preferences
        int role_id FK
        datetime created_at
        datetime updated_at
    }

    Role {
        int id PK
        string name
        boolean is_admin
    }

    Area {
        int id PK
        string uid UK
        string name
        text description
        int user_id FK
        datetime created_at
        datetime updated_at
    }

    Project {
        int id PK
        string uid UK
        string name
        text description
        int status
        date due_date
        int priority
        int area_id FK
        int user_id FK
        datetime created_at
        datetime updated_at
    }

    Task {
        int id PK
        string uid UK
        string name
        text description
        date due_date
        date defer_until
        int priority
        int status
        boolean is_habit
        string recurrence_type
        int recurrence_interval
        date recurrence_end_date
        int parent_task_id FK
        int project_id FK
        int user_id FK
        datetime created_at
        datetime updated_at
    }

    Note {
        int id PK
        string uid UK
        string name
        text text
        string color
        int project_id FK
        int user_id FK
        datetime created_at
        datetime updated_at
    }

    Tag {
        int id PK
        string uid UK
        string name UK
        string color
        int user_id FK
        datetime created_at
        datetime updated_at
    }

    TaskEvent {
        int id PK
        int task_id FK
        int user_id FK
        string action
        json changes
        datetime created_at
    }

    TaskAttachment {
        int id PK
        string uid UK
        int task_id FK
        string filename
        string path
        int size
        string mime_type
        datetime created_at
    }

    RecurringCompletion {
        int id PK
        int task_id FK
        date due_date
        datetime completed_at
        int user_id FK
    }

    Permission {
        int id PK
        int user_id FK
        string resource_type
        string resource_uid
        string access_level
        datetime created_at
    }

    ApiToken {
        int id PK
        string uid UK
        int user_id FK
        string name
        string token_hash
        datetime last_used_at
        datetime expires_at
        datetime created_at
    }

    Notification {
        int id PK
        string uid UK
        int user_id FK
        string type
        string message
        boolean read
        string linked_resource_type
        string linked_resource_uid
        datetime created_at
    }

    View {
        int id PK
        string uid UK
        int user_id FK
        string name
        string resource_type
        json filters
        json sort
        int position
        boolean pinned
        datetime created_at
        datetime updated_at
    }

    InboxItem {
        int id PK
        string uid UK
        int user_id FK
        string name
        text description
        datetime created_at
    }

    Backup {
        int id PK
        int user_id FK
        string filename
        string path
        int size
        datetime created_at
    }
```

**Key Observations:**
- **Hierarchical Structure:** User → Area → Project → Task (with subtasks)
- **Self-Referential:** Tasks can have subtasks via `parent_task_id`
- **Many-to-Many:** Tags are shared across Tasks, Projects, and Notes (via junction tables)
- **Polymorphic Sharing:** Permissions work across multiple resource types
- **Recurring Tasks:** Tracked via `RecurringCompletion` records for history
- **Audit Trail:** `TaskEvent` logs all task changes

---

## Migration Workflow

### Creating a New Migration

```bash
npm run migration:create -- --name add-field-to-tasks
```

This creates: `/backend/migrations/YYYYMMDDHHMMSS-add-field-to-tasks.js`

The timestamp ensures migrations run in chronological order.

### Migration File Template

```javascript
// backend/migrations/20260313120000-add-priority-level-to-tasks.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Changes to apply
    await queryInterface.addColumn('Tasks', 'priority_level', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    // How to reverse the changes
    await queryInterface.removeColumn('Tasks', 'priority_level');
  }
};
```

### Running Migrations

```bash
# Apply all pending migrations
npm run migration:run

# Rollback last migration
npm run migration:undo

# Check migration status
npm run db:status

# Rollback all migrations (CAREFUL!)
npm run migration:undo:all
```

---

## Migration Best Practices

### 1. Always Implement `down` Method

Make migrations reversible:

```javascript
// ✅ Good - Reversible
async down(queryInterface, Sequelize) {
  await queryInterface.removeColumn('Tasks', 'priority_level');
}

// ❌ Bad - Not reversible
async down(queryInterface, Sequelize) {
  // Not implemented
}
```

### 2. Test Both Directions

```bash
# Test up
npm run migration:run

# Test down (rollback)
npm run migration:undo

# Re-apply to verify
npm run migration:run
```

### 3. Never Modify Released Migrations

Once a migration is released (in main branch or deployed), create a new one instead:

```bash
# ❌ Bad - Modifying existing migration
# Edit: migrations/20260101-create-tasks.js

# ✅ Good - Create new migration
npm run migration:create -- --name modify-tasks-table
```

### 4. Update Corresponding Model

After creating migration, update the Sequelize model:

```javascript
// Migration adds field
await queryInterface.addColumn('Tasks', 'estimated_time', {
  type: Sequelize.INTEGER
});

// Update /backend/models/task.js
Task.init({
  // ... existing fields ...
  estimated_time: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});
```

### 5. Use Transactions for Data Migrations

```javascript
async up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();
  
  try {
    // Multiple operations in transaction
    await queryInterface.addColumn('Tasks', 'new_field', {...}, { transaction });
    
    // Data migration
    await queryInterface.sequelize.query(
      'UPDATE Tasks SET new_field = old_field WHERE old_field IS NOT NULL',
      { transaction }
    );
    
    await queryInterface.removeColumn('Tasks', 'old_field', { transaction });
    
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### 6. Include Migrations in PRs

When schema changes are needed, always include the migration file in your PR.

---

## Common Migration Operations

### Add Column

```javascript
await queryInterface.addColumn('TableName', 'column_name', {
  type: Sequelize.STRING,
  allowNull: false,
  defaultValue: 'default'
});
```

### Remove Column

```javascript
await queryInterface.removeColumn('TableName', 'column_name');
```

### Change Column Type

```javascript
await queryInterface.changeColumn('TableName', 'column_name', {
  type: Sequelize.TEXT,  // Changed from STRING
  allowNull: true
});
```

### Rename Column

```javascript
await queryInterface.renameColumn('TableName', 'old_name', 'new_name');
```

### Add Index

```javascript
await queryInterface.addIndex('TableName', ['column_name'], {
  name: 'index_name',
  unique: false
});
```

### Remove Index

```javascript
await queryInterface.removeIndex('TableName', 'index_name');
```

### Create Table

```javascript
await queryInterface.createTable('NewTable', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  uid: {
    type: Sequelize.STRING(15),
    allowNull: false,
    unique: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  created_at: {
    type: Sequelize.DATE,
    allowNull: false
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false
  }
});
```

### Drop Table

```javascript
await queryInterface.dropTable('TableName');
```

### Add Foreign Key

```javascript
await queryInterface.addConstraint('Tasks', {
  fields: ['project_id'],
  type: 'foreign key',
  name: 'tasks_project_fk',
  references: {
    table: 'Projects',
    field: 'id'
  },
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});
```

---

## Database Configuration

### Connecting

tududi runs on **PostgreSQL** 14 or newer, the only supported engine since 2.0. The connection is built from environment variables in `/backend/config/database-settings.js` and every consumer (the app in `models/index.js`, sequelize-cli via `config/database.js`, and the scripts) builds its connection from the same `buildSequelizeOptions()` in `/backend/config/db.js`. tududi refuses to start when no database is configured.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgres://user:pass@host:5432/dbname` (required unless the discrete variables are set) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Connection parts; each overrides the matching part of `DATABASE_URL` |
| `DB_SSL` | `true` to connect over TLS (`?sslmode=require` in the URL also enables it) |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` to accept self-signed server certificates (default `true`, verified) |
| `DB_POOL_MAX` | Connections per app process (default 10) |

The root `docker-compose.yml` ships a `db` service; deployment, backup and tuning notes are in [16-postgresql.md](16-postgresql.md).

### How the schema is created

`backend/scripts/db-prepare.js` runs on every start (from `cmd/start.sh`), before migrations:

- **Leftover SQLite data:** if the 1.x SQLite file is still on the volume and holds data, startup stops and points to [30-moving-to-postgres.md](30-moving-to-postgres.md) (override with `TUDUDI_ALLOW_DIALECT_SWITCH=true`).
- **Empty database:** `sequelize.sync()` creates the tables from the models, then every migration file is recorded in `SequelizeMeta` as already applied (a *baseline*).
- **Existing database:** it must have run every 1.x migration, otherwise startup stops with "This database was last used by an older tududi 1.x release". Pending migrations then run as usual.

The 1.x migrations live in `backend/migrations/archive/`. sequelize-cli only reads the top level of `backend/migrations/`, so they never run again; they stay for reference.

### Keeping migrations and models in step

Because a fresh install gets its schema from the models while existing installs only ever see migrations, every migration has to produce exactly what the model change describes: same column types, defaults, nullability and unique indexes. Check a new migration by running it against a database created from the previous models and comparing `\d <table>` in `psql` with a fresh `sequelize.sync()`.


### Writing migrations

A migration only ever runs on an existing PostgreSQL database (fresh installs baseline it). Checklist:

- Use the `safe*` helpers from `backend/utils/migration-utils.js` (`safeAddColumns`, `safeCreateTable`, `safeAddIndex`, `safeRemoveColumn`, `safeChangeColumn`) so a migration can run twice without failing.
- Compare and write booleans as `true`/`false`, never `0`/`1`.
- JSON columns come back as objects: bind objects (or cast `::json`) rather than pre-stringified text.
- Quote table aliases in raw SQL (`"Task"."id"`), as PostgreSQL lowercases unquoted identifiers.
- Change columns in place with `ALTER TABLE` (`safeChangeColumn`); there is no need to rebuild a table.

### Location

`/backend/config/database.js` (sequelize-cli), `/backend/config/db.js` (shared options)

---

## Database Management Commands

```bash
# Initialize database (create + migrate)
npm run db:init

# Reset database (WIPES ALL DATA!)
npm run db:reset

# Seed development data
npm run db:seed

# Check migration status
npm run db:status

# Create new migration
npm run migration:create -- --name description

# Run pending migrations
npm run migration:run

# Rollback last migration
npm run migration:undo

# Rollback all migrations (CAREFUL!)
npm run migration:undo:all
```

---

## Model Definition Example

```javascript
// /backend/models/task.js
'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Task extends Model {
    static associate(models) {
      // Defined in models/index.js
    }
  }

  Task.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    uid: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 2
      }
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Recurrence fields
    recurrence_type: {
      type: DataTypes.STRING,
      allowNull: true
    },
    recurrence_interval: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Foreign keys
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    parent_task_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Task',
    tableName: 'Tasks',
    underscored: true,
    timestamps: true
  });

  return Task;
};
```

---

## Special Task Model Fields

The Task model has special fields for recurring tasks:

```javascript
// Recurrence pattern
recurrence_type: 'daily' | 'weekly' | 'monthly' | 'monthly_weekday' | 'monthly_last_day'
recurrence_interval: 1, 2, 3, ... (every N days/weeks/months)
recurrence_end_date: Optional end date for series

// Relationships
parent_task_id: Links subtasks to parent task (self-referential)
recurring_parent_id: Links recurring instances to original pattern
```

**Task Status Values:**
- 0: Not started
- 1: In progress
- 2: Done/Completed
- 3: Archived
- 4: Waiting
- 5: Cancelled
- 6: Planned

**Priority Values:**
- 0: Low
- 1: Medium
- 2: High

---

[← Back to Index](../CLAUDE.md)
