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

# Upgrade suite: real migrations against legacy SQLite databases + schema parity
npm run backend:test:upgrade

# Upgrade with the real Docker images (slow; needs Docker, curl, sqlite3)
npm run test:upgrade:docker
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

Backend tests never touch the development database. `backend/tests/helpers/setup.js` runs once per test file and:

- **SQLite (default):** points `DB_FILE` at a fresh `/tmp/test-<id>.sqlite3` for that file
- **PostgreSQL** (`DATABASE_URL` set): uses one database per Jest worker, named `<db>_w<workerId>`, created by `tests/helpers/globalSetup.js`
- Creates the schema with `sequelize.sync({ force: true })` in `beforeAll` (migrations are not run in tests)
- Empties all tables between tests in `beforeEach` (`truncateTables` from `utils/db-dialect.js`)

Run the suite against PostgreSQL locally with:

```bash
docker run -d -p 5432:5432 -e POSTGRES_USER=tududi -e POSTGRES_PASSWORD=tududi -e POSTGRES_DB=tududi_test postgres:16-alpine
DATABASE_URL=postgres://tududi:tududi@localhost:5432/tududi_test npm run backend:test:pg
```

CI runs both: `test-sqlite` and `test-postgres` in `.github/workflows/ci.yml`. When a test encodes engine-specific behaviour, branch on `isPostgres()` from `utils/db-dialect.js` rather than skipping the file.

### Upgrade suite

`npm run backend:test:upgrade` runs `backend/tests/upgrade` with its own Jest config (`backend/jest.upgrade.config.js`), because these tests must not use the sync-based setup above:

- `legacy-sqlite-upgrade.test.js` copies every database in `backend/tests/fixtures/legacy` (real files produced by older releases, see the README there), runs `scripts/db-prepare.js` and `sequelize-cli db:migrate` against the copy exactly as `cmd/start.sh` does, and checks: only the pending migrations ran, `SequelizeMeta` lists every migration file, `PRAGMA integrity_check` is ok, no rows were lost, a second run is a no-op, and a fresh process booting the app on the file can log in, read every list endpoint and write through the model hooks (`helpers/smoke-runner.js`).
- `schema-parity.test.js` snapshots the schema `sequelize.sync()` produces from the models and compares it with a fresh SQLite install, each upgraded legacy fixture and, when `DATABASE_URL` is set, a freshly bootstrapped PostgreSQL database. A model table, column or unique index that a migration never created fails the run. Accepted differences are listed in `known-schema-drift.json` with a reason; `SCHEMA_PARITY_REPORT=1` prints every difference without failing.

Point `LEGACY_FIXTURE_DIR` at a directory with extra `.sqlite3` files (a copy of a real database, for example) to include them in a run without committing them.

`npm run test:upgrade:docker` (`scripts/test-upgrade-docker.sh`) goes one level further: it starts the previous release image on a temporary volume, upgrades that volume with an image built from the current checkout and checks logins, data, the pre-migration backup and a restart. It runs from `.github/workflows/upgrade-docker.yml` on release tags, weekly and on demand.

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
