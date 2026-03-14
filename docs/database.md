# Database & Migrations

[← Back to Index](../CLAUDE.md)

---

## Key Models

All Sequelize models are defined in `/backend/models/` and associations are configured in `/backend/models/index.js`.

### Core Models

| Model | File | Purpose | Key Fields |
|-------|------|---------|------------|
| **User** | `user.js` | User accounts | email, password (bcrypt), settings, preferences, timezone |
| **Task** | `task.js` | Tasks with recurrence | name, due_date, priority, status, recurrence_type, parent_task_id |
| **Project** | `project.js` | Project grouping | name, area_id, user_id |
| **Area** | `area.js` | Area categorization | name, user_id |
| **Note** | `note.js` | Notes | text, project_id, user_id |
| **Tag** | `tag.js` | Tags | name, color, user_id |
| **Permission** | `permission.js` | Sharing/permissions | user_id, resource_type, resource_uid, access_level |
| **ApiToken** | `apiToken.js` | API tokens | user_id, token_hash, expires_at |
| **RecurringCompletion** | `recurringCompletion.js` | Recurring task history | task_id, completed_at, due_date |
| **TaskEvent** | `taskEvent.js` | Task audit log | task_id, user_id, action, changes |
| **TaskAttachment** | `taskAttachment.js` | File attachments | task_id, filename, path |
| **InboxItem** | `inboxItem.js` | Inbox entries | name, user_id |
| **Notification** | `notification.js` | User notifications | user_id, type, read, linked_resource |
| **Role** | `role.js` | User roles | name, is_admin |
| **View** | `view.js` | Saved views | name, filters, user_id |
| **Backup** | `backup.js` | Backup records | user_id, filename, created_at |

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

### Location

`/backend/config/database.js`

### SQLite Performance Optimizations

```javascript
// Applied in models/index.js
await sequelize.query('PRAGMA journal_mode=WAL'); // Write-Ahead Logging
await sequelize.query('PRAGMA synchronous=NORMAL'); // Faster with single user
await sequelize.query('PRAGMA busy_timeout=5000'); // 5s timeout
await sequelize.query('PRAGMA cache_size=-64000'); // 64MB cache
await sequelize.query('PRAGMA mmap_size=268435456'); // 256MB memory-mapped I/O
await sequelize.query('PRAGMA temp_store=MEMORY'); // Memory-based temp storage
```

**Benefits:**
- WAL mode: Better concurrency for writes
- Larger cache: Fewer disk reads
- Memory-mapped I/O: Faster random access
- Memory temp storage: Faster temp operations

### Database File Location

- **Development:** `/backend/database.sqlite`
- **Docker:** Mounted volume at `/app/backend/db/`
- **Test:** Separate test database (auto-created)

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
