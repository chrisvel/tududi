# Testing Requirements

[← Back to Index](../CLAUDE.md)

---

## Test Organization

```
/backend/tests/
├── unit/                      # Unit tests for isolated logic
│   ├── models/               # Model tests
│   │   ├── task.test.js
│   │   ├── project.test.js
│   │   ├── user.test.js
│   │   └── ...
│   ├── middleware/           # Middleware tests
│   │   ├── auth.test.js
│   │   └── authorize.test.js
│   ├── services/             # Service tests
│   │   ├── permissionsService.test.js
│   │   ├── applyPerms.test.js
│   │   └── ...
│   └── utils/                # Utility tests
│       ├── timezone-utils.test.js
│       ├── slug-utils.test.js
│       ├── attachment-utils.test.js
│       └── migration-utils.test.js
│
└── integration/              # Integration tests for API endpoints
    ├── tasks/
    │   ├── tasks.test.js
    │   ├── subtasks.test.js
    │   └── recurring.test.js
    ├── projects/
    │   └── projects.test.js
    ├── areas/
    ├── notes/
    ├── tags/
    ├── auth/
    ├── shares/
    └── ... (47+ test directories)

/e2e/tests/                   # E2E tests (Playwright)
├── login.spec.ts
├── tasks.spec.ts
├── projects.spec.ts
├── subtasks.spec.ts
└── ...

/frontend/__tests__/          # Frontend tests
├── setup.ts                 # Test configuration
└── components/
    └── ... (component tests)
```

---

## Running Tests

### Backend Tests

```bash
# Run all backend tests
npm test
# or
npm run backend:test

# Run specific test file
npm test -- backend/tests/unit/models/task.test.js

# Run with coverage
npm run test:coverage

# Watch mode (re-run on file changes)
npm run test:watch
```

### Frontend Tests

```bash
# Run frontend tests
npm run frontend:test

# Watch mode
npm run frontend:test -- --watch
```

### E2E Tests

```bash
# Headless mode (default)
npm run test:ui

# Headed mode (see browser)
npm run test:ui:headed

# Specific test file
npx playwright test e2e/tests/tasks.spec.ts

# Debug mode
npx playwright test --debug
```

### Pre-Push Checks

```bash
# Run all checks before committing/pushing
npm run pre-push

# This runs:
# - ESLint checks
# - Prettier formatting
# - Backend tests
# - Type checking (if applicable)
```

---

## Testing Requirements

### For Bug Fixes

**MUST include a test** that would have caught the bug.

**Process:**
1. Write failing test that demonstrates the bug
2. Fix the bug
3. Verify test now passes
4. Submit PR with both test and fix

**Example:**
```javascript
// Test for bug: completed tasks showing in Today view
it('should not return completed tasks in Today view', async () => {
  // Arrange - Create completed task
  await Task.create({
    name: 'Completed Task',
    status: 2, // completed
    due_date: new Date().toISOString().split('T')[0],
    user_id: user.id
  });

  // Act - Get today's tasks
  const response = await request(app)
    .get('/api/v1/tasks/today')
    .set('Cookie', authCookie);

  // Assert - No completed tasks
  expect(response.status).toBe(200);
  const completedTasks = response.body.filter(t => t.status === 2);
  expect(completedTasks.length).toBe(0);
});
```

### For New Features

**SHOULD include relevant tests** covering:
- Happy path (success case)
- Common edge cases
- Error conditions

**Not required to test:**
- Every possible combination
- Framework internals
- Third-party library behavior

---

## Test Patterns

### Backend Integration Test

**Arrange-Act-Assert Pattern:**

```javascript
// /backend/tests/integration/tasks/tasks.test.js
const request = require('supertest');
const app = require('../../../app');
const { Task, User } = require('../../../models');

describe('Task API', () => {
  let user;
  let authCookie;

  beforeEach(async () => {
    // Setup: Create user and authenticate
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
    // Cleanup
    await Task.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  it('should create task with valid data', async () => {
    // Arrange
    const taskData = {
      name: 'Test Task',
      priority: 1,
      due_date: '2026-03-15'
    };

    // Act
    const response = await request(app)
      .post('/api/v1/task')
      .set('Cookie', authCookie)
      .send(taskData);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Task');
    expect(response.body.priority).toBe(1);

    // Verify in database
    const task = await Task.findOne({ where: { name: 'Test Task' } });
    expect(task).not.toBeNull();
    expect(task.user_id).toBe(user.id);
  });

  it('should return 400 for missing name', async () => {
    // Arrange
    const invalidData = { priority: 1 };

    // Act
    const response = await request(app)
      .post('/api/v1/task')
      .set('Cookie', authCookie)
      .send(invalidData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('should return 404 for non-existent task', async () => {
    // Act
    const response = await request(app)
      .get('/api/v1/task/99999')
      .set('Cookie', authCookie);

    // Assert
    expect(response.status).toBe(404);
  });
});
```

### Backend Unit Test

```javascript
// /backend/tests/unit/utils/timezone-utils.test.js
const { getTodayBoundsInUTC } = require('../../../utils/timezone-utils');

describe('timezone-utils', () => {
  describe('getTodayBoundsInUTC', () => {
    it('should return UTC bounds for today in given timezone', () => {
      // Arrange
      const timezone = 'America/New_York';

      // Act
      const { startOfDay, endOfDay } = getTodayBoundsInUTC(timezone);

      // Assert
      expect(startOfDay).toBeInstanceOf(Date);
      expect(endOfDay).toBeInstanceOf(Date);
      expect(endOfDay.getTime()).toBeGreaterThan(startOfDay.getTime());
    });

    it('should handle invalid timezone gracefully', () => {
      // Arrange
      const invalidTimezone = 'Invalid/Timezone';

      // Act & Assert
      expect(() => getTodayBoundsInUTC(invalidTimezone)).not.toThrow();
    });
  });
});
```

### Frontend Component Test

```typescript
// /frontend/components/Task/__tests__/TaskItem.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from '../TaskItem';
import { Task } from '../../../entities/Task';

describe('TaskItem', () => {
  const mockTask: Task = {
    id: 1,
    uid: 'test-uid-123',
    name: 'Test Task',
    completed: false,
    priority: 1,
    due_date: '2026-03-15'
  };

  it('renders task name', () => {
    // Act
    render(<TaskItem task={mockTask} onUpdate={jest.fn()} />);

    // Assert
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('shows priority badge', () => {
    // Act
    render(<TaskItem task={mockTask} onUpdate={jest.fn()} />);

    // Assert
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('calls onUpdate when checkbox is clicked', () => {
    // Arrange
    const mockOnUpdate = jest.fn();
    render(<TaskItem task={mockTask} onUpdate={mockOnUpdate} />);

    // Act
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Assert
    expect(mockOnUpdate).toHaveBeenCalledWith({
      ...mockTask,
      completed: true
    });
  });

  it('applies completed styling when task is done', () => {
    // Arrange
    const completedTask = { ...mockTask, completed: true };

    // Act
    render(<TaskItem task={completedTask} onUpdate={jest.fn()} />);

    // Assert
    const taskElement = screen.getByText('Test Task').closest('div');
    expect(taskElement).toHaveClass('line-through');
    expect(taskElement).toHaveClass('opacity-50');
  });
});
```

### E2E Test (Playwright)

```typescript
// /e2e/tests/tasks.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:8080/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/tasks');
  });

  test('should create new task', async ({ page }) => {
    // Arrange
    await page.click('button:has-text("New Task")');

    // Act
    await page.fill('input[name="name"]', 'E2E Test Task');
    await page.selectOption('select[name="priority"]', '1');
    await page.fill('input[name="due_date"]', '2026-03-15');
    await page.click('button:has-text("Save")');

    // Assert
    await expect(page.locator('text=E2E Test Task')).toBeVisible();
  });

  test('should complete task', async ({ page }) => {
    // Arrange - Create a task first
    await page.click('button:has-text("New Task")');
    await page.fill('input[name="name"]', 'Task to Complete');
    await page.click('button:has-text("Save")');

    // Act - Complete the task
    const taskItem = page.locator('text=Task to Complete').locator('..');
    await taskItem.locator('input[type="checkbox"]').check();

    // Assert
    await expect(taskItem).toHaveClass(/line-through/);
  });

  test('should filter tasks by priority', async ({ page }) => {
    // Arrange - Create tasks with different priorities
    await createTask(page, 'High Priority Task', 2);
    await createTask(page, 'Low Priority Task', 0);

    // Act - Filter by high priority
    await page.selectOption('select[name="priority_filter"]', '2');

    // Assert
    await expect(page.locator('text=High Priority Task')).toBeVisible();
    await expect(page.locator('text=Low Priority Task')).not.toBeVisible();
  });
});

async function createTask(page, name: string, priority: number) {
  await page.click('button:has-text("New Task")');
  await page.fill('input[name="name"]', name);
  await page.selectOption('select[name="priority"]', priority.toString());
  await page.click('button:has-text("Save")');
  await page.waitForSelector(`text=${name}`);
}
```

---

## Test Database

Backend tests use a separate test database:

- Automatically created in test environment
- Migrations run before tests
- Database cleared between tests (in `afterEach`)
- Configured in `/backend/config/database.js`

**Example cleanup:**
```javascript
afterEach(async () => {
  // Clean up test data
  await Task.destroy({ where: {} });
  await Project.destroy({ where: {} });
  await User.destroy({ where: {} });
});
```

---

## Mocking

### Mock External Services

```javascript
// Mock email service in tests
jest.mock('../../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

it('should send notification email', async () => {
  const emailService = require('../../../services/emailService');
  
  await taskService.create({ name: 'Task', notify: true }, userId);
  
  expect(emailService.sendEmail).toHaveBeenCalled();
});
```

### Mock Frontend API Calls

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/v1/tasks', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, name: 'Mocked Task' }
    ]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Coverage Goals

While not strictly enforced, aim for:
- **Critical paths:** 80%+ coverage
- **Business logic:** 70%+ coverage
- **UI components:** 50%+ coverage

**Run coverage report:**
```bash
npm run test:coverage

# Open HTML report
open coverage/index.html
```

---

## Before Submitting PR

✅ All tests passing:
```bash
npm test
npm run test:ui
```

✅ No linting errors:
```bash
npm run lint
```

✅ Code formatted:
```bash
npm run format:fix
```

✅ Run pre-push checks:
```bash
npm run pre-push
```

---

[← Back to Index](../CLAUDE.md)
