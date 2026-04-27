# Common Tasks Reference

[← Back to Index](../CLAUDE.md)

Quick reference for frequently performed development tasks with complete file lists.

---

## Task 1: Add New Field to Existing Model

**Example: Add `estimated_time` field to Task**

### Files to Modify

1. **Create migration**
   ```bash
   npm run migration:create -- --name add-estimated-time-to-tasks
   ```
   
   Edit `/backend/migrations/YYYYMMDDHHMMSS-add-estimated-time-to-tasks.js`

2. **Update model**
   - `/backend/models/task.js` - Add field definition

3. **Update serializer**
   - `/backend/modules/tasks/core/serializers.js` - Add to `serializeTask()`

4. **Update builder**
   - `/backend/modules/tasks/core/builders.js` - Add to `buildTaskAttributes()`

5. **Add validation (if needed)**
   - `/backend/modules/tasks/routes.js` - Add validation logic

6. **Update API docs**
   - `/backend/config/swagger.js` - Update Task schema

7. **Update frontend types**
   - `/frontend/entities/Task.ts` - Add to interface (if exists)

8. **Update UI**
   - `/frontend/components/Task/TaskForm.tsx` - Add input field
   - `/frontend/components/Task/TaskItem.tsx` - Display field (if needed)

9. **Add tests**
   - `/backend/tests/integration/tasks/tasks.test.js` - Test CRUD with new field

### Commands

```bash
npm run migration:create -- --name add-estimated-time-to-tasks
# Edit migration file
npm run migration:run
npm run backend:test
npm run lint:fix
npm run format:fix
```

---

## Task 2: Create New Backend Module

**Example: Create "labels" module**

### Steps

1. **Create directory structure**
   ```bash
   mkdir -p /Users/chris/c0deLab/ProjectLand/TaskNoteTaker/backend/modules/labels
   ```

2. **Create files**
   - `/backend/modules/labels/routes.js` - Express routes
   - `/backend/modules/labels/repository.js` - Data access

3. **Create model**
   - `/backend/models/label.js` - Sequelize model
   - Update `/backend/models/index.js` - Add associations

4. **Create migration**
   ```bash
   npm run migration:create -- --name create-labels-table
   ```
   - Edit `/backend/migrations/YYYYMMDDHHMMSS-create-labels-table.js`

5. **Register routes**
   - Edit `/backend/app.js`:
   ```javascript
   app.use('/api/v1', require('./modules/labels/routes'));
   app.use('/api', require('./modules/labels/routes'));
   ```

6. **Add Swagger docs**
   - Edit `/backend/config/swagger.js` - Add Label schema

7. **Write tests**
   - Create `/backend/tests/integration/labels/labels.test.js`

8. **Frontend integration (optional)**
   - `/frontend/entities/Label.ts` - TypeScript interface
   - `/frontend/utils/labelsService.ts` - API client
   - `/frontend/components/Label/` - Components

### Commands

```bash
npm run migration:create -- --name create-labels-table
npm run migration:run
npm run backend:test
```

---

## Task 3: Add New React Component

**Example: Create `TaskPriorityBadge` component**

### Files to Create

1. **Component file**
   - `/frontend/components/Task/TaskPriorityBadge.tsx`

2. **Test file (optional)**
   - `/frontend/components/Task/__tests__/TaskPriorityBadge.test.tsx`

3. **Import in parent component**
   - `/frontend/components/Task/TaskItem.tsx` - Import and use

### Example Component

```typescript
// TaskPriorityBadge.tsx
import React from 'react';

interface TaskPriorityBadgeProps {
  priority: number;
}

export const TaskPriorityBadge: React.FC<TaskPriorityBadgeProps> = ({ priority }) => {
  const configs = {
    0: { label: 'Low', className: 'bg-gray-200 text-gray-800' },
    1: { label: 'Medium', className: 'bg-yellow-200 text-yellow-800' },
    2: { label: 'High', className: 'bg-red-200 text-red-800' }
  };

  const config = configs[priority] || configs[0];

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
};
```

### Commands

```bash
npm run frontend:test
npm run lint:fix
```

---

## Task 4: Update Database Schema

**Example: Add index to Tasks table**

### Steps

1. **Create migration**
   ```bash
   npm run migration:create -- --name add-index-to-tasks-due-date
   ```

2. **Edit migration file**
   `/backend/migrations/YYYYMMDDHHMMSS-add-index-to-tasks-due-date.js`
   ```javascript
   async up(queryInterface, Sequelize) {
     await queryInterface.addIndex('Tasks', ['due_date'], {
       name: 'tasks_due_date_index'
     });
   }

   async down(queryInterface, Sequelize) {
     await queryInterface.removeIndex('Tasks', 'tasks_due_date_index');
   }
   ```

3. **Test migration**
   ```bash
   npm run migration:run
   npm run migration:undo  # Test rollback
   npm run migration:run   # Re-apply
   ```

4. **Update model (optional)**
   - Index definition can be in migration only, or also in model

### Commands

```bash
npm run migration:create -- --name add-index-to-tasks-due-date
npm run migration:run
npm run backend:test
```

---

## Task 5: Fix a Bug (TDD Workflow)

**Example: Fix bug where completed tasks show in Today view**

### Steps

1. **Write failing test first**
   
   Edit `/backend/tests/integration/tasks/tasks.test.js`:
   ```javascript
   it('should not return completed tasks in Today view', async () => {
     // Arrange - Create completed task
     await Task.create({
       name: 'Completed Task',
       status: 2,
       due_date: new Date().toISOString().split('T')[0],
       user_id: user.id
     });

     // Act
     const response = await request(app)
       .get('/api/v1/tasks/today')
       .set('Cookie', authCookie);

     // Assert
     expect(response.status).toBe(200);
     const completedTasks = response.body.filter(t => t.status === 2);
     expect(completedTasks.length).toBe(0);
   });
   ```

2. **Run test - verify it fails**
   ```bash
   npm run backend:test
   ```

3. **Fix the bug**
   
   Edit `/backend/modules/tasks/queries/query-builders.js` or `/backend/modules/tasks/operations/list.js`:
   ```javascript
   // Add status filter to Today query
   where.status = { [Op.ne]: 2 }; // Exclude completed
   ```

4. **Run test - verify it passes**
   ```bash
   npm run backend:test
   ```

5. **Run all checks**
   ```bash
   npm run pre-push
   ```

6. **Commit**
   ```bash
   git add .
   git commit -m "Fix completed tasks appearing in Today view (#123)

   - Add status filter to Today query
   - Add test to prevent regression"
   ```

---

## Task 6: Add Translation Key

### Backend Translations

Backend typically doesn't use translations (API responses in English).

### Frontend Translations

1. **Add key to English source**
   
   Edit `/public/locales/en/translation.json`:
   ```json
   {
     "task": {
       "estimatedTime": "Estimated Time",
       "estimatedTimePlaceholder": "Enter time in minutes",
       "estimatedTimeUnit": "minutes"
     }
   }
   ```

2. **Use in component**
   
   ```typescript
   import { useTranslation } from 'react-i18next';

   const TaskForm = () => {
     const { t } = useTranslation();

     return (
       <div>
         <label>{t('task.estimatedTime')}</label>
         <input
           type="number"
           placeholder={t('task.estimatedTimePlaceholder')}
         />
         <span>{t('task.estimatedTimeUnit')}</span>
       </div>
     );
   };
   ```

3. **Sync translations (if tool available)**
   ```bash
   npm run translations:sync
   npm run translations:check
   ```

---

## Task 7: Add API Endpoint Documentation

### Update Swagger Schema

Edit `/backend/config/swagger.js`:

```javascript
// Update existing schema
components: {
  schemas: {
    Task: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        uid: { type: 'string' },
        name: { type: 'string' },
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

### Document New Endpoint with JSDoc

In `/backend/modules/tasks/routes.js`:

```javascript
/**
 * @swagger
 * /api/v1/task/{id}/estimate:
 *   put:
 *     summary: Update task estimated time
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estimated_time:
 *                 type: integer
 *                 description: Time in minutes
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 */
router.put('/task/:id/estimate', async (req, res, next) => {
  // Implementation
});
```

### View Swagger Docs

1. Start server: `npm run backend:dev`
2. Login to app
3. Visit: http://localhost:3002/api-docs

---

## Task 8: Add Subtask to Task

**Example: Add subtasks to a task**

This is already implemented in TaskNoteTaker, but here's the pattern:

### Files Involved

1. **Migration**
   - Already exists: `parent_task_id` field in Tasks table

2. **Model**
   - `/backend/models/task.js` - Self-referential association
   - `/backend/models/index.js` - Define relationship:
   ```javascript
   Task.hasMany(Task, { as: 'Subtasks', foreignKey: 'parent_task_id' });
   Task.belongsTo(Task, { as: 'ParentTask', foreignKey: 'parent_task_id' });
   ```

3. **Backend operations**
   - `/backend/modules/tasks/operations/subtasks.js` - Subtask CRUD

4. **Frontend**
   - `/frontend/components/Task/SubtaskList.tsx` - Display subtasks
   - `/frontend/components/Task/TaskDetails.tsx` - Show subtasks

---

## Task 9: Add Permission/Sharing to Resource

**Example: Add sharing to a new resource type**

### Steps

1. **Ensure Permission model supports resource type**
   
   Check `/backend/models/permission.js`:
   ```javascript
   resource_type: {
     type: DataTypes.STRING,
     allowNull: false,
     // Should support your resource type
   }
   ```

2. **Use `hasAccess` middleware in routes**
   
   ```javascript
   const { hasAccess } = require('../../middleware/authorize');

   router.get('/myresource/:id',
     hasAccess('ro', 'myresource', (req) => req.params.id),
     async (req, res, next) => {
       // Handler
     }
   );
   ```

3. **Implement sharing endpoints**
   
   See `/backend/modules/shares/` for reference

4. **Frontend sharing UI**
   
   See `/frontend/components/Project/ProjectSharing.tsx` for reference

---

## Task 10: Add Recurring Pattern to Task

**Example: Add new recurrence type**

### Files to Check/Modify

1. **Task model**
   - `/backend/models/task.js` - Recurrence fields

2. **Recurring task service**
   - `/backend/modules/tasks/recurringTaskService.js` - Add new pattern logic

3. **Task scheduler**
   - `/backend/modules/tasks/taskScheduler.js` - Ensure cron job handles new pattern

4. **Frontend**
   - `/frontend/components/Task/TaskForm.tsx` - Add UI for new pattern

---

## Task 11: Export Data (Backup)

**Example: Create database backup**

Already implemented in TaskNoteTaker:

```bash
# Via API (after login)
POST /api/v1/backup

# Returns JSON file with all user data
```

See `/backend/modules/backup/` for implementation details.

---

## Quick Command Reference

```bash
# Database
npm run db:init                    # Initialize database
npm run db:reset                   # Reset database
npm run migration:create -- --name # Create migration
npm run migration:run              # Run migrations
npm run migration:undo             # Rollback migration

# Development
npm start                          # Run both frontend + backend
npm run backend:dev                # Backend only
npm run frontend:dev               # Frontend only

# Testing
npm test                           # Backend tests
npm run frontend:test              # Frontend tests
npm run test:ui                    # E2E tests
npm run test:coverage              # Coverage report

# Code Quality
npm run lint                       # Check linting
npm run lint:fix                   # Fix linting
npm run format:fix                 # Format code
npm run pre-push                   # All checks

# Build
npm run build                      # Production build
```

---

[← Back to Index](../CLAUDE.md)
