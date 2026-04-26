# Backend Module Architecture

[← Back to Index](../CLAUDE.md)

---

## Standard Module Structure

All feature modules in `/backend/modules/` follow a consistent architecture pattern. This ensures code is organized, maintainable, and easy to navigate.

### Typical Module Directory

```
/backend/modules/[module-name]/
├── routes.js              # Express router with endpoint definitions
├── repository.js          # Data access layer (Sequelize queries)
├── operations/            # Business logic operations (optional)
│   ├── create.js
│   ├── update.js
│   ├── delete.js
│   └── ...
├── queries/              # Complex query builders (optional)
├── core/                 # Core utilities (optional)
│   ├── serializers.js    # Format data for API responses
│   ├── parsers.js        # Parse request data
│   └── builders.js       # Build database objects
├── middleware/           # Route-specific middleware (optional)
│   └── access.js         # Access control
└── utils/                # Module-specific utilities
    └── validation.js     # Input validation
```

**Note:** Not all modules have all directories. Simpler modules may only have `routes.js` and basic logic.

---

## Example: Tasks Module (Complex)

The tasks module (`/backend/modules/tasks/`) is the most comprehensive example, showing the full potential of the module pattern:

```
/backend/modules/tasks/
├── routes.js                    # Main routes: GET /tasks, POST /task, etc.
├── repository.js                # Data access: findTaskById, findTasksForUser
├── recurringTaskService.js      # Recurring task pattern logic (8.5KB)
├── taskEventService.js          # Task activity logging
├── taskScheduler.js             # Cron-based task scheduling with node-cron
│
├── operations/                  # Business logic operations
│   ├── list.js                 # List operations and filtering
│   ├── completion.js           # Task completion/status changes
│   ├── recurring.js            # Recurrence pattern handling
│   ├── subtasks.js             # Subtask CRUD operations
│   ├── tags.js                 # Tag assignment to tasks
│   ├── grouping.js             # Task grouping logic
│   ├── sorting.js              # Sort order logic
│   └── parent-child.js         # Parent-child relationship handling
│
├── queries/
│   ├── query-builders.js       # filterTasksByParams, buildWhereClause
│   ├── metrics-queries.js      # Task metrics and analytics queries
│   └── metrics-computation.js  # Metric calculations and aggregations
│
├── core/
│   ├── serializers.js          # serializeTask, serializeTasks
│   ├── builders.js             # buildTaskAttributes for create/update
│   ├── parsers.js              # parseTaskInput from requests
│   └── comparators.js          # Detect task changes for audit log
│
├── middleware/
│   └── access.js               # Task-specific access control
│
└── utils/
    ├── constants.js            # Task-specific constants (status codes, etc.)
    ├── validation.js           # Task input validation rules
    └── logging.js              # Change tracking helpers
```

---

## Example: Projects Module (Simpler)

The projects module (`/backend/modules/projects/`) follows the same pattern but with less complexity:

```
/backend/modules/projects/
├── routes.js              # Project CRUD endpoints
├── repository.js          # Project data access (findAll, findById, create, etc.)
└── utils/
    └── validation.js      # Project validation (name required, etc.)
```

This shows that modules scale based on complexity - simple features don't require the full directory structure.

---

## Module Pattern Details

### routes.js - Express Router

**Purpose:** Define HTTP endpoints for the module

**Pattern:**
```javascript
// /backend/modules/[module]/routes.js
const express = require('express');
const router = express.Router();
const repository = require('./repository');
const { hasAccess } = require('../../middleware/authorize');

// List all resources (collection)
router.get('/[resources]', async (req, res, next) => {
  try {
    const items = await repository.findAll(req.currentUser.id, req.query);
    res.json(items);
  } catch (error) {
    next(error); // Pass to global error handler
  }
});

// Create new resource (singular)
router.post('/[resource]', async (req, res, next) => {
  try {
    const item = await repository.create(req.body, req.currentUser.id);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

// Get single resource (with authorization)
router.get('/[resource]/:id',
  hasAccess('ro', '[resource]', (req) => req.params.id),
  async (req, res, next) => {
    try {
      const item = await repository.findById(req.params.id, req.currentUser.id);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Update resource (with authorization)
router.put('/[resource]/:id',
  hasAccess('rw', '[resource]', (req) => req.params.id),
  async (req, res, next) => {
    try {
      const updated = await repository.update(req.params.id, req.body, req.currentUser.id);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete resource
router.delete('/[resource]/:id',
  hasAccess('rw', '[resource]', (req) => req.params.id),
  async (req, res, next) => {
    try {
      await repository.destroy(req.params.id, req.currentUser.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
```

**Key Conventions:**
- Plural for collections: `GET /tasks`
- Singular for single resource: `GET /task/:id`, `POST /task`
- Always use try/catch
- Pass errors to `next(error)` for global error handler
- Use `hasAccess()` middleware for authorization
- Return proper HTTP status codes (200, 201, 204, 404, etc.)

---

### repository.js - Data Access Layer

**Purpose:** Abstract database queries from routes

**Pattern:**
```javascript
// /backend/modules/[module]/repository.js
const { Model } = require('../../models');

async function findAll(userId, filters = {}) {
  return await Model.findAll({
    where: {
      user_id: userId,
      ...buildWhereClause(filters)
    },
    include: [...],
    order: [['created_at', 'DESC']]
  });
}

async function findById(id, userId) {
  return await Model.findOne({
    where: { id, user_id: userId },
    include: [...]
  });
}

async function create(data, userId) {
  return await Model.create({
    ...data,
    user_id: userId
  });
}

async function update(id, data, userId) {
  const instance = await findById(id, userId);
  if (!instance) {
    throw new NotFoundError('Resource not found');
  }
  return await instance.update(data);
}

async function destroy(id, userId) {
  const instance = await findById(id, userId);
  if (!instance) {
    throw new NotFoundError('Resource not found');
  }
  await instance.destroy();
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  destroy
};
```

**Why Repository Pattern:**
- Separates data access from business logic
- Makes testing easier (can mock repository)
- Centralizes query logic
- Prevents Model usage directly in routes

---

### core/serializers.js - Response Formatting

**Purpose:** Transform database objects into API-friendly format

**Pattern:**
```javascript
// /backend/modules/[module]/core/serializers.js

function serializeItem(item) {
  if (!item) return null;

  return {
    id: item.id,
    uid: item.uid,
    name: item.name,
    description: item.description,
    created_at: item.created_at,
    updated_at: item.updated_at,
    // Include associations if loaded
    tags: item.Tags ? item.Tags.map(serializeTag) : undefined,
    user: item.User ? serializeUser(item.User) : undefined
  };
}

function serializeItems(items) {
  return items.map(serializeItem);
}

module.exports = {
  serializeItem,
  serializeItems
};
```

**Usage in routes:**
```javascript
const { serializeItem, serializeItems } = require('./core/serializers');

router.get('/items', async (req, res) => {
  const items = await repository.findAll(req.currentUser.id);
  res.json(serializeItems(items)); // Transform before sending
});
```

---

### core/builders.js - Object Construction

**Purpose:** Build objects for database creation/update from request data

**Pattern:**
```javascript
// /backend/modules/[module]/core/builders.js

function buildItemAttributes(data, userId) {
  const attributes = {
    user_id: userId,
    name: data.name?.trim(),
    description: data.description?.trim() || null
  };

  // Optional fields
  if (data.due_date) {
    attributes.due_date = parseDate(data.due_date);
  }

  if (data.priority !== undefined) {
    attributes.priority = parseInt(data.priority, 10);
  }

  return attributes;
}

module.exports = { buildItemAttributes };
```

**Usage:**
```javascript
const { buildItemAttributes } = require('./core/builders');

router.post('/item', async (req, res) => {
  const attributes = buildItemAttributes(req.body, req.currentUser.id);
  const item = await repository.create(attributes);
  res.status(201).json(serializeItem(item));
});
```

---

### operations/ - Business Logic

**Purpose:** Complex operations that don't fit in simple CRUD

**Example: operations/completion.js (from tasks module)**
```javascript
// /backend/modules/tasks/operations/completion.js

async function completeTask(taskId, userId, completionData) {
  // Get task with associations
  const task = await repository.findById(taskId, userId);

  if (task.recurrence_type) {
    // Handle recurring task completion
    await recurringTaskService.handleCompletion(task, completionData);
  } else {
    // Simple completion
    task.status = 2; // completed
    task.completed_at = new Date();
    await task.save();
  }

  // Log event
  await taskEventService.logEvent(taskId, 'completed', userId);

  // Update related subtasks
  if (completionData.completeSubtasks) {
    await completeSubtasks(taskId);
  }

  return task;
}

module.exports = { completeTask };
```

---

## Module Communication

### Accessing Other Modules

Modules can import other module repositories and services:

```javascript
// In /backend/modules/projects/routes.js

// Import task repository from tasks module
const taskRepository = require('../tasks/repository');

// Import shared service
const permissionsService = require('../../services/permissionsService');

router.get('/project/:id/tasks', async (req, res) => {
  // Use task repository
  const tasks = await taskRepository.findTasksForProject(req.params.id);
  res.json(tasks);
});
```

### Avoid Circular Dependencies

**Bad:**
```javascript
// Module A imports Module B
const moduleB = require('../moduleB');

// Module B imports Module A
const moduleA = require('../moduleA'); // CIRCULAR!
```

**Good:**
```javascript
// Extract shared logic to /backend/services/
// Both modules import from services
const sharedService = require('../../services/sharedService');
```

---

## How to Add a New Module

**Example: Creating a "labels" module**

### Step 1: Create Directory Structure

```bash
mkdir -p /Users/chris/c0deLab/ProjectLand/TaskNoteTaker/backend/modules/labels
mkdir -p /Users/chris/c0deLab/ProjectLand/TaskNoteTaker/backend/modules/labels/utils
```

### Step 2: Create routes.js

```javascript
// /backend/modules/labels/routes.js
const express = require('express');
const router = express.Router();
const repository = require('./repository');

router.get('/labels', async (req, res, next) => {
  try {
    const labels = await repository.findAll(req.currentUser.id);
    res.json(labels);
  } catch (error) {
    next(error);
  }
});

router.post('/label', async (req, res, next) => {
  try {
    const label = await repository.create(req.body, req.currentUser.id);
    res.status(201).json(label);
  } catch (error) {
    next(error);
  }
});

router.put('/label/:id', async (req, res, next) => {
  try {
    const label = await repository.update(req.params.id, req.body, req.currentUser.id);
    res.json(label);
  } catch (error) {
    next(error);
  }
});

router.delete('/label/:id', async (req, res, next) => {
  try {
    await repository.destroy(req.params.id, req.currentUser.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### Step 3: Create repository.js

```javascript
// /backend/modules/labels/repository.js
const { Label } = require('../../models');

async function findAll(userId) {
  return await Label.findAll({
    where: { user_id: userId },
    order: [['name', 'ASC']]
  });
}

async function findById(id, userId) {
  return await Label.findOne({
    where: { id, user_id: userId }
  });
}

async function create(data, userId) {
  return await Label.create({
    name: data.name,
    color: data.color || '#gray',
    user_id: userId
  });
}

async function update(id, data, userId) {
  const label = await findById(id, userId);
  if (!label) {
    throw new Error('Label not found');
  }
  return await label.update({
    name: data.name,
    color: data.color
  });
}

async function destroy(id, userId) {
  const label = await findById(id, userId);
  if (!label) {
    throw new Error('Label not found');
  }
  await label.destroy();
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  destroy
};
```

### Step 4: Create Model

See [Database documentation](database.md) for creating models and migrations.

### Step 5: Register Routes in app.js

Edit `/backend/app.js`:

```javascript
// Add with other module registrations (around line 50-70)

// Labels module
app.use('/api/v1', require('./modules/labels/routes'));
app.use('/api', require('./modules/labels/routes')); // Backward compatibility
```

### Step 6: Add Swagger Documentation

Edit `/backend/config/swagger.js` to add Label schema:

```javascript
components: {
  schemas: {
    // ... existing schemas ...
    Label: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        uid: { type: 'string' },
        name: { type: 'string' },
        color: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  }
}
```

### Step 7: Write Tests

Create `/backend/tests/integration/labels/labels.test.js`:

```javascript
const request = require('supertest');
const app = require('../../../app');
const { Label, User } = require('../../../models');

describe('Labels API', () => {
  let user, authCookie;

  beforeEach(async () => {
    user = await User.create({
      email: 'test@example.com',
      password: 'password123'
    });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authCookie = res.headers['set-cookie'];
  });

  afterEach(async () => {
    await Label.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  it('should create label', async () => {
    const response = await request(app)
      .post('/api/v1/label')
      .set('Cookie', authCookie)
      .send({ name: 'Important', color: '#red' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Important');
  });

  it('should list user labels', async () => {
    await Label.create({ name: 'Label 1', user_id: user.id });
    await Label.create({ name: 'Label 2', user_id: user.id });

    const response = await request(app)
      .get('/api/v1/labels')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
  });
});
```

### Step 8: Create Frontend Integration (Optional)

Create `/frontend/utils/labelsService.ts` and components as needed.

---

## Module Checklist

When adding a new module, ensure:

- [ ] Directory created in `/backend/modules/[name]/`
- [ ] `routes.js` with all necessary endpoints
- [ ] `repository.js` with data access methods
- [ ] Model created (if new database table needed)
- [ ] Migration created and run
- [ ] Routes registered in `/backend/app.js`
- [ ] Swagger schema added
- [ ] Integration tests written
- [ ] Documentation updated (if public feature)

---

[← Back to Index](../CLAUDE.md)
