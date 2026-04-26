# Development Workflow

[← Back to Index](../CLAUDE.md)

---

## Initial Setup

### Prerequisites

- **Node.js** v22+ (recommended - check package.json engines field)
- **npm** (comes with Node.js)
- **Git**

### Clone and Install

```bash
# Clone repository
git clone https://github.com/chrisvel/tasknotetaker.git
cd tasknotetaker

# Install all dependencies
# This installs both frontend and backend dependencies (monorepo setup)
npm install
```

### Initialize Database

```bash
# Create database and run all migrations
npm run db:init

# This command:
# 1. Creates /backend/database.sqlite
# 2. Runs all migrations from /backend/migrations/
# 3. Sets up tables and relationships
```

### Create Test User (Optional)

```bash
npm run user:create

# Interactive prompts:
# - Email address
# - Password
# - Timezone (defaults to system timezone)
```

---

## Daily Development

TaskNoteTaker runs two separate processes during development:

### Two-Server Development

**Terminal 1 - Backend (Express):**
```bash
npm run backend:dev

# Details:
# - Runs: nodemon backend/app.js
# - Server: http://localhost:3002
# - Auto-reloads: Yes (on file changes)
# - API endpoints: /api/v1/*
# - Swagger docs: /api-docs (after login)
```

**Terminal 2 - Frontend (Webpack Dev Server):**
```bash
npm run frontend:dev

# Details:
# - Runs: webpack serve --mode development
# - Server: http://localhost:8080
# - Hot reload: Yes (React Fast Refresh)
# - Proxies /api/* to backend:3002
# - Proxies /locales/* to backend:3002
```

**Or run both simultaneously:**
```bash
npm start

# Runs both backend:dev and frontend:dev in parallel
# Uses 'concurrently' package
# Logs from both processes interleaved
```

### Accessing the Application

Open http://localhost:8080 in your browser.

**Login with:**
- Email: The email you set during db:init or user:create
- Password: The password you set

---

## Environment Variables

Create `/backend/.env` file (not tracked in git):

```bash
# Required
TASKNOTETAKER_SESSION_SECRET=your-random-secret-here-use-openssl-rand-hex-64
TASKNOTETAKER_USER_EMAIL=admin@example.com
TASKNOTETAKER_USER_PASSWORD=your-secure-password

# Optional - Server config
NODE_ENV=development
DB_FILE=database.sqlite
FRONTEND_URL=http://localhost:8080
BACKEND_URL=http://localhost:3002
PORT=3002
HOST=0.0.0.0

# Optional - Email
ENABLE_EMAIL=false
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USERNAME=user
EMAIL_SMTP_PASSWORD=pass
EMAIL_FROM_ADDRESS=noreply@example.com
EMAIL_FROM_NAME=TaskNoteTaker

# Optional - Integrations
DISABLE_TELEGRAM=false
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
GOOGLE_REDIRECT_URI=http://localhost:8080/auth/google/callback

# Optional - Features
DISABLE_SCHEDULER=false
SWAGGER_ENABLED=true
RATE_LIMITING_ENABLED=true

# Optional - Proxy (if behind reverse proxy)
TASKNOTETAKER_TRUST_PROXY=false
TASKNOTETAKER_ALLOWED_ORIGINS=http://localhost:8080

# Optional - Registration
REGISTRATION_TOKEN_EXPIRY_HOURS=24
```

**Generate secure session secret:**
```bash
openssl rand -hex 64
```

---

## Adding a New Feature (Complete Example)

**Example: Add "estimated_time" field to tasks**

This walkthrough shows all files to touch when adding a new field to an existing model.

### Step 1: Create Database Migration

```bash
npm run migration:create -- --name add-estimated-time-to-tasks
```

Edit the created file `/backend/migrations/YYYYMMDDHHMMSS-add-estimated-time-to-tasks.js`:

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tasks', 'estimated_time', {
      type: Sequelize.INTEGER, // minutes
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Tasks', 'estimated_time');
  }
};
```

**Run migration:**
```bash
npm run migration:run
```

### Step 2: Update Sequelize Model

Edit `/backend/models/task.js`:

```javascript
Task.init({
  // ... existing fields ...
  estimated_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Estimated time in minutes'
  },
  // ... rest of fields ...
}, {
  sequelize,
  modelName: 'Task',
  tableName: 'Tasks'
});
```

### Step 3: Update Serializer (API Response)

Edit `/backend/modules/tasks/core/serializers.js`:

```javascript
function serializeTask(task) {
  return {
    // ... existing fields ...
    estimated_time: task.estimated_time,
    // ... rest of fields ...
  };
}
```

### Step 4: Update Builder (API Input)

Edit `/backend/modules/tasks/core/builders.js`:

```javascript
function buildTaskAttributes(data, userId) {
  const attributes = {
    // ... existing fields ...
    estimated_time: data.estimated_time ? parseInt(data.estimated_time, 10) : null,
    // ... rest of fields ...
  };
  
  return attributes;
}
```

### Step 5: Add Validation (Optional)

If validation needed, edit `/backend/modules/tasks/routes.js`:

```javascript
router.put('/task/:id', async (req, res, next) => {
  try {
    // Validate estimated_time
    if (req.body.estimated_time !== undefined) {
      const time = parseInt(req.body.estimated_time, 10);
      if (isNaN(time) || time < 0) {
        return res.status(400).json({
          error: 'Estimated time must be a positive number'
        });
      }
    }
    
    // ... rest of route handler ...
  } catch (error) {
    next(error);
  }
});
```

### Step 6: Update Swagger Documentation

Edit `/backend/config/swagger.js`:

```javascript
// Find Task schema
components: {
  schemas: {
    Task: {
      type: 'object',
      properties: {
        // ... existing properties ...
        estimated_time: {
          type: 'integer',
          description: 'Estimated time in minutes',
          nullable: true,
          example: 30
        }
      }
    }
  }
}
```

### Step 7: Update Frontend TypeScript Interface

If TypeScript interface exists, edit `/frontend/entities/Task.ts`:

```typescript
export interface Task {
  // ... existing fields ...
  estimated_time: number | null;
  // ... rest of fields ...
}
```

### Step 8: Update Frontend Component

Edit `/frontend/components/Task/TaskForm.tsx`:

```typescript
// Add input field
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
    Estimated Time (minutes)
  </label>
  <input
    type="number"
    min="0"
    value={task.estimated_time || ''}
    onChange={(e) => updateTask({
      ...task,
      estimated_time: e.target.value ? parseInt(e.target.value) : null
    })}
    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
  />
</div>
```

### Step 9: Write Tests

Add tests in `/backend/tests/integration/tasks/tasks.test.js`:

```javascript
it('should create task with estimated_time', async () => {
  const response = await request(app)
    .post('/api/v1/task')
    .set('Cookie', authCookie)
    .send({
      name: 'Task with estimate',
      estimated_time: 60
    });

  expect(response.status).toBe(201);
  expect(response.body.estimated_time).toBe(60);
});

it('should reject negative estimated_time', async () => {
  const response = await request(app)
    .post('/api/v1/task')
    .set('Cookie', authCookie)
    .send({
      name: 'Invalid task',
      estimated_time: -10
    });

  expect(response.status).toBe(400);
});
```

### Step 10: Run Tests and Checks

```bash
# Run backend tests
npm run backend:test

# Run linting
npm run lint:fix

# Format code
npm run format:fix

# Run all pre-push checks
npm run pre-push
```

### Step 11: Commit Changes

```bash
git add .
git commit -m "Add estimated_time field to tasks

- Add database migration for estimated_time
- Update Task model and serializers
- Update Swagger documentation
- Add validation for positive values
- Add UI field in TaskForm component
- Add integration tests"
```

---

## Database Management

```bash
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
```

---

## Code Quality

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format:fix

# Run all pre-push checks
# (lint + format + tests)
npm run pre-push
```

---

## Testing

```bash
# Backend tests
npm test
# or
npm run backend:test

# Frontend tests
npm run frontend:test

# E2E tests
npm run test:ui           # Headless
npm run test:ui:headed    # With browser visible

# Coverage report
npm run test:coverage

# Watch mode (during development)
npm run test:watch
```

---

## Branch Strategy

From CONTRIBUTING.md conventions:

```bash
# Feature branches
git checkout -b feature/description

# Bug fix branches
git checkout -b fix/description

# Refactoring branches
git checkout -b refactor/description

# Documentation branches
git checkout -b docs/description

# Test branches
git checkout -b test/description
```

### Example Workflow

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/estimated-time

# Make changes, run tests
npm run pre-push

# Commit changes
git add .
git commit -m "Add estimated time feature"

# Before PR: rebase on main
git checkout main
git pull origin main
git checkout feature/estimated-time
git rebase main

# Push and create PR
git push origin feature/estimated-time
```

---

## Build for Production

```bash
# Build frontend
npm run build

# Builds to: /dist/
# - Minified JavaScript
# - Optimized CSS
# - Hashed filenames for cache busting
```

### Docker Production

```bash
# Build Docker image
docker build -t tasknotetaker:latest .

# Run container
docker run \
  -e TASKNOTETAKER_USER_EMAIL=admin@example.com \
  -e TASKNOTETAKER_USER_PASSWORD=secure-password \
  -e TASKNOTETAKER_SESSION_SECRET=$(openssl rand -hex 64) \
  -v ~/tasknotetaker_db:/app/backend/db \
  -v ~/tasknotetaker_uploads:/app/backend/uploads \
  -p 3002:3002 \
  -d tasknotetaker:latest
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3002
lsof -ti:3002

# Kill process
kill -9 $(lsof -ti:3002)

# Or use different port
PORT=3003 npm run backend:dev
```

### Database Locked

```bash
# Stop all servers
# Delete database file
rm backend/database.sqlite

# Reinitialize
npm run db:init
```

### Module Not Found

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Webpack Build Errors

```bash
# Clear webpack cache
rm -rf node_modules/.cache

# Rebuild
npm run frontend:dev
```

---

[← Back to Index](../CLAUDE.md)
