# Code Conventions & Patterns

[← Back to Index](../CLAUDE.md)

---

## Language Usage

- **Frontend:** TypeScript (`.tsx`, `.ts` files)
- **Backend:** JavaScript with optional JSDoc types (`.js` files)
- **tsconfig.json:** Frontend only, `"strict": false`

---

## Backend Patterns

### 1. Async/Await (No Callbacks)

```javascript
// ✅ Good - Use async/await
async function getTasks(userId) {
  const tasks = await Task.findAll({ where: { user_id: userId } });
  return tasks;
}

// ❌ Bad - No callbacks
function getTasks(userId, callback) {
  Task.findAll({ where: { user_id: userId } })
    .then(tasks => callback(null, tasks))
    .catch(err => callback(err));
}
```

### 2. Repository Pattern

```javascript
// ✅ Good - Use repository
// In routes.js
const repository = require('./repository');
const task = await repository.findTaskById(req.params.id, req.currentUser.id);

// ❌ Bad - Don't access Model directly in routes
const { Task } = require('../../models');
const task = await Task.findByPk(req.params.id);
```

**Why:** Repository pattern separates data access from business logic, making testing easier and centralizing query logic.

### 3. Error Handling

```javascript
// In routes.js
router.get('/task/:id', async (req, res, next) => {
  try {
    const task = await repository.findTaskById(req.params.id, req.currentUser.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    next(error); // Pass to global error handler
  }
});
```

**Always:**
- Use try/catch in route handlers
- Pass errors to `next(error)` for global error handler
- Return proper HTTP status codes
- Use custom error classes from `/backend/shared/errors/`

### 4. Service Pattern

```javascript
// Create singleton service or class
class TaskService {
  async create(data, userId) {
    // Validation
    if (!data.name) {
      throw new ValidationError('Task name is required');
    }

    // Business logic
    const task = await Task.create({ ...data, user_id: userId });

    // Additional operations
    await taskEventService.logEvent(task.id, 'created');

    return task;
  }
}

module.exports = new TaskService(); // Export singleton
```

---

## Frontend Patterns

### 1. Functional Components with Hooks

```typescript
// ✅ Good - Functional component
import React, { useState, useEffect } from 'react';

interface TaskItemProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate }) => {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // Side effects here
  }, [task]);

  return <div>{task.name}</div>;
};

// ❌ Bad - Class components (legacy pattern)
class TaskItem extends React.Component { ... }
```

### 2. State Management

```typescript
// Global state - Zustand
import { useStore } from '../store/useStore';

const TaskList = () => {
  const tasks = useStore(state => state.tasks);
  const setTasks = useStore(state => state.setTasks);
  // ...
};

// Server state - SWR
import useSWR from 'swr';
import { getTasks } from '../utils/tasksService';

const TaskList = () => {
  const { data: tasks, error, mutate } = useSWR('/api/v1/tasks', getTasks);
  // ...
};

// Local component state - useState
const [isOpen, setIsOpen] = useState(false);
```

### 3. Styling - Tailwind CSS

```typescript
// ✅ Good - Tailwind utility classes
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
    {task.name}
  </h2>
</div>

// Conditional classes
<div className={`p-4 ${task.completed ? 'opacity-50 line-through' : ''}`}>
  {task.name}
</div>

// Complex conditionals - use clsx or classnames
import clsx from 'clsx';

<div className={clsx(
  'p-4 rounded-lg',
  task.completed && 'opacity-50 line-through',
  task.priority === 2 && 'border-l-4 border-red-500'
)}>
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Files** | kebab-case | `recurring-task-service.js`, `task-item.tsx` |
| **React Components** | PascalCase | `TaskItem.tsx`, `ProjectForm.tsx` |
| **Functions** | camelCase | `findTaskById`, `createTask`, `handleSubmit` |
| **Classes** | PascalCase | `TaskService`, `BaseRepository` |
| **Constants** | UPPER_SNAKE_CASE | `API_VERSION`, `MAX_FILE_SIZE` |
| **Variables** | camelCase | `userId`, `taskList`, `isCompleted` |
| **Database Tables** | PascalCase | `Tasks`, `Projects`, `Users` |
| **Database Columns** | snake_case | `user_id`, `due_date`, `created_at` |
| **Interfaces (TS)** | PascalCase | `TaskProps`, `User`, `ApiResponse` |
| **Type Aliases (TS)** | PascalCase | `TaskStatus`, `Priority` |

---

## API Route Conventions

```javascript
// Singular for single resource operations
POST   /api/v1/task              // Create new task
GET    /api/v1/task/:id          // Get task by ID
PUT    /api/v1/task/:id          // Update task
DELETE /api/v1/task/:id          // Delete task

// Plural for collection operations
GET    /api/v1/tasks             // List all tasks
GET    /api/v1/tasks/today       // Filtered list
GET    /api/v1/tasks/upcoming    // Another filtered list

// UID support (alternative to numeric ID)
GET    /api/v1/task/uid/:uid     // Get by UID

// Nested resources
GET    /api/v1/project/:id/tasks // Tasks for a project
POST   /api/v1/task/:id/tags     // Add tags to task
```

---

## HTTP Status Codes

Use appropriate status codes:

```javascript
// Success
200 OK                    // Successful GET, PUT
201 Created              // Successful POST
204 No Content           // Successful DELETE

// Client errors
400 Bad Request          // Invalid input
401 Unauthorized         // Not authenticated
403 Forbidden            // Not authorized
404 Not Found            // Resource doesn't exist
409 Conflict             // Duplicate resource

// Server errors
500 Internal Server Error // Unexpected error
```

**Example:**
```javascript
// Success cases
res.json(task);                              // 200 (default)
res.status(201).json(task);                  // 201 for create
res.status(204).send();                      // 204 for delete

// Error cases
res.status(400).json({ error: 'Invalid input' });
res.status(404).json({ error: 'Not found' });
```

---

## Commit Message Style

Based on git log history:

```bash
# Use imperative mood
git commit -m "Fix sidebar toggle causing unnecessary reload"
git commit -m "Add priority level field to tasks"
git commit -m "Update database migration for recurring tasks"

# Reference issues (if applicable)
git commit -m "Fix subtask completion not persisting (#920)"

# Prefix releases
git commit -m "release: v0.89.0"

# Multi-line for complex changes
git commit -m "Add estimated time feature

- Add database migration for estimated_time field
- Update Task model and serializers
- Update Swagger documentation
- Add UI field in TaskForm component
- Add validation for positive values
- Add integration tests"
```

**Guidelines:**
- Start with a verb in imperative mood (Add, Fix, Update, Remove)
- Keep first line under 72 characters
- Reference issue numbers with (#123)
- Use body for detailed explanations (if needed)

---

## Code Documentation

### JSDoc for Backend Functions

```javascript
/**
 * Find all tasks for a user with optional filtering
 * 
 * @param {number} userId - The user ID
 * @param {Object} filters - Optional filters
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.priority] - Filter by priority
 * @returns {Promise<Task[]>} Array of tasks
 */
async function findAllTasks(userId, filters = {}) {
  // ...
}
```

### TypeScript Interfaces

```typescript
/**
 * Task entity representing a single task
 */
export interface Task {
  /** Unique numeric ID */
  id: number;
  
  /** Unique string identifier */
  uid: string;
  
  /** Task name/title */
  name: string;
  
  /** Optional due date */
  due_date: string | null;
  
  /** Priority: 0 (low), 1 (medium), 2 (high) */
  priority: 0 | 1 | 2;
  
  /** Current status */
  status: TaskStatus;
}
```

---

## File Organization

### Backend Module Files

```
/backend/modules/[module]/
├── routes.js           # Keep routes simple, delegate to operations
├── repository.js       # Only database queries
├── operations/         # Complex business logic
├── core/
│   ├── serializers.js  # Only formatting
│   ├── builders.js     # Only object construction
│   └── parsers.js      # Only parsing
└── utils/
    └── validation.js   # Only validation
```

**Principle:** Single Responsibility - each file has one clear purpose

### Frontend Component Files

```
/frontend/components/Task/
├── TaskItem.tsx        # Single task display
├── TaskList.tsx        # List of tasks
├── TaskForm.tsx        # Task creation/editing form
├── TaskFilters.tsx     # Filter controls
└── SubtaskList.tsx     # Subtask-specific component
```

**Principle:** Feature-based organization, components stay focused

---

## Testing Conventions

### Test File Naming

```
// Backend
/backend/tests/unit/services/taskService.test.js
/backend/tests/integration/tasks/tasks.test.js

// Frontend
/frontend/components/Task/__tests__/TaskItem.test.tsx
```

### Test Structure

```javascript
describe('Feature or Component', () => {
  // Setup
  beforeEach(() => {
    // Arrange common setup
  });

  // Cleanup
  afterEach(() => {
    // Clean up
  });

  it('should do specific thing', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

---

## Security Best Practices

### Input Validation

```javascript
// ✅ Always validate user input
if (!data.name || typeof data.name !== 'string') {
  throw new ValidationError('Name is required');
}

if (data.priority !== undefined) {
  const priority = parseInt(data.priority, 10);
  if (isNaN(priority) || priority < 0 || priority > 2) {
    throw new ValidationError('Invalid priority');
  }
}
```

### SQL Injection Prevention

```javascript
// ✅ Good - Sequelize handles parameterization
const tasks = await Task.findAll({
  where: { user_id: userId, name: { [Op.like]: `%${searchTerm}%` } }
});

// ❌ Bad - Raw queries (if absolutely necessary, use replacements)
await sequelize.query(
  'SELECT * FROM Tasks WHERE user_id = :userId',
  {
    replacements: { userId },
    type: QueryTypes.SELECT
  }
);
```

### Password Handling

```javascript
// ✅ Always hash passwords with bcrypt
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 10);

// ❌ Never store plain text passwords
user.password = password; // NEVER DO THIS
```

### XSS Prevention

```typescript
// ✅ React automatically escapes content
<div>{task.name}</div>

// ⚠️ Only use dangerouslySetInnerHTML for trusted, sanitized content
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
```

---

## Performance Best Practices

### Database Queries

```javascript
// ✅ Good - Use includes for associations
const tasks = await Task.findAll({
  where: { user_id: userId },
  include: [Project, Tag]  // Eager loading
});

// ❌ Bad - N+1 queries
const tasks = await Task.findAll({ where: { user_id: userId } });
for (const task of tasks) {
  task.project = await Project.findByPk(task.project_id); // N+1!
}
```

### React Rendering

```typescript
// ✅ Good - Memoize expensive computations
const sortedTasks = useMemo(
  () => tasks.sort((a, b) => a.priority - b.priority),
  [tasks]
);

// ✅ Good - Prevent unnecessary re-renders
const TaskItem = React.memo(({ task }) => {
  return <div>{task.name}</div>;
});
```

---

[← Back to Index](../CLAUDE.md)
