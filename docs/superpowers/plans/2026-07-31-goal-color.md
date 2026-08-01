# Goal Color Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `color` field to Goals so users can pick a color in GoalModal, and that color surfaces on goal cards and area-detail rows.

**Architecture:** Follow the existing Areas/Projects color pattern exactly — nullable STRING column in the DB, `color?: string` on the entity, `ColorPicker` component in the modal, and color-driven conditional styling in the list/detail views.

**Tech Stack:** Express + Sequelize + SQLite (backend); React 18 + TypeScript + Tailwind CSS (frontend); Jest + Supertest (tests).

## Global Constraints

- Migration must use `safeAddColumns` from `backend/utils/migration-utils.js` (idempotent)
- Migration filename format: `YYYYMMDDNNNNNN-<description>.js`
- No JSDoc comments in any file
- Do not add Co-authored-by trailers to commits
- Run `npm run lint:fix` before any `git push`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/migrations/20260731000001-add-color-to-goals.js` | Create | Add `color` column to `goals` table |
| `backend/models/goal.js` | Modify | Add `color` field definition |
| `backend/modules/goals/service.js` | Modify | Thread `color` through `create` and `update` |
| `frontend/entities/Goal.ts` | Modify | Add `color?: string` to interface |
| `frontend/components/Goal/GoalModal.tsx` | Modify | Add `ColorPicker` field |
| `frontend/components/Goals.tsx` | Modify | Prefer goal color over area color |
| `frontend/components/Area/AreaDetails.tsx` | Modify | Colored left border on goal rows |
| `backend/tests/integration/goals.test.js` | Create | Integration tests for color CRUD |

---

## Task 1: Migration + Model

**Files:**
- Create: `backend/migrations/20260731000001-add-color-to-goals.js`
- Modify: `backend/models/goal.js`

**Interfaces:**
- Produces: `Goal.color` column in DB; Sequelize model field `color: DataTypes.STRING, allowNull: true`

- [ ] **Step 1: Write the migration**

Create `backend/migrations/20260731000001-add-color-to-goals.js`:

```js
'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'goals', [
            {
                name: 'color',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('goals', 'color');
    },
};
```

- [ ] **Step 2: Add `color` field to the Sequelize model**

In `backend/models/goal.js`, add after the `status` field definition (before the closing `}`  of the fields object):

```js
color: {
    type: DataTypes.STRING,
    allowNull: true,
},
```

- [ ] **Step 3: Run the migration**

```bash
npm run db:migrate
```

Expected: migration runs without error; `goals` table now has a `color` column.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/20260731000001-add-color-to-goals.js backend/models/goal.js
git commit -m "feat(goals): add color column to goals table"
```

---

## Task 2: Service layer

**Files:**
- Modify: `backend/modules/goals/service.js`

**Interfaces:**
- Consumes: `color` string (nullable) from request body
- Produces: `GoalsService.create` and `GoalsService.update` pass `color` to repository

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/goals.test.js`:

```js
const request = require('supertest');
const app = require('../../app');
const { Goal, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Goals Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'goaltest@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'goaltest@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/goals', () => {
        it('should create a goal with a color', async () => {
            const response = await agent.post('/api/goals').send({
                title: 'Run a marathon',
                horizon: 'year',
                status: 'active',
                color: '#1d4ed8',
            });

            expect(response.status).toBe(201);
            expect(response.body.color).toBe('#1d4ed8');
        });

        it('should create a goal without a color', async () => {
            const response = await agent.post('/api/goals').send({
                title: 'Read more books',
                horizon: 'season',
                status: 'active',
            });

            expect(response.status).toBe(201);
            expect(response.body.color).toBeNull();
        });
    });

    describe('PUT /api/goals/:uid', () => {
        it('should update a goal color', async () => {
            const created = await agent.post('/api/goals').send({
                title: 'Learn guitar',
                horizon: 'year',
                status: 'active',
            });
            const uid = created.body.uid;

            const response = await agent.put(`/api/goals/${uid}`).send({
                color: '#15803d',
            });

            expect(response.status).toBe(200);
            expect(response.body.color).toBe('#15803d');
        });

        it('should clear a goal color when set to null', async () => {
            const created = await agent.post('/api/goals').send({
                title: 'Learn piano',
                horizon: 'year',
                status: 'active',
                color: '#b91c1c',
            });
            const uid = created.body.uid;

            const response = await agent.put(`/api/goals/${uid}`).send({
                color: null,
            });

            expect(response.status).toBe(200);
            expect(response.body.color).toBeNull();
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest backend/tests/integration/goals.test.js --testTimeout=30000
```

Expected: Tests fail because `color` is not returned or persisted.

- [ ] **Step 3: Update `GoalsService.create` to include `color`**

In `backend/modules/goals/service.js`, replace:

```js
async create(userId, data) {
    const { title, area_id, why, horizon, target_date, status } = data;
    if (!title || !title.trim()) {
        throw new ValidationError('Goal title is required');
    }
    return goalsRepository.create({
        user_id: userId,
        area_id: area_id || null,
        title: title.trim(),
        why: why || null,
        horizon: horizon || 'season',
        target_date: target_date || null,
        status: status || 'active',
    });
}
```

With:

```js
async create(userId, data) {
    const { title, area_id, why, horizon, target_date, status, color } = data;
    if (!title || !title.trim()) {
        throw new ValidationError('Goal title is required');
    }
    return goalsRepository.create({
        user_id: userId,
        area_id: area_id || null,
        title: title.trim(),
        why: why || null,
        horizon: horizon || 'season',
        target_date: target_date || null,
        status: status || 'active',
        color: color || null,
    });
}
```

- [ ] **Step 4: Update `GoalsService.update` to include `color`**

In the same file, in the `update` method, add after `if (status !== undefined) updates.status = status;`:

```js
if (color !== undefined) updates.color = color || null;
```

Also destructure `color` from `data` at the top of `update`:

```js
const { title, area_id, why, horizon, target_date, status, color } = data;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest backend/tests/integration/goals.test.js --testTimeout=30000
```

Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/modules/goals/service.js backend/tests/integration/goals.test.js
git commit -m "feat(goals): thread color through goals service"
```

---

## Task 3: Frontend entity + GoalModal

**Files:**
- Modify: `frontend/entities/Goal.ts`
- Modify: `frontend/components/Goal/GoalModal.tsx`

**Interfaces:**
- Consumes: `ColorPicker` from `frontend/components/Shared/ColorPicker.tsx` — `<ColorPicker value={string} onChange={(color: string) => void} />`
- Produces: `Goal.color?: string`; `GoalModal` sends `color` (or `''`) in `formData`

- [ ] **Step 1: Add `color` to the Goal interface**

In `frontend/entities/Goal.ts`, add `color?: string;` after `status: GoalStatus;`:

```ts
export interface Goal {
    id?: number;
    uid?: string;
    area_id?: number | null;
    user_id?: number;
    title: string;
    why?: string | null;
    horizon: GoalHorizon;
    target_date?: string | null;
    status: GoalStatus;
    color?: string;
    created_at?: string;
    updated_at?: string;
    Area?: Area | null;
    Tasks?: Task[];
    Projects?: Project[];
}
```

- [ ] **Step 2: Update `GoalModal` — imports and default form**

In `frontend/components/Goal/GoalModal.tsx`:

Add import at the top (after existing imports):
```ts
import ColorPicker from '../Shared/ColorPicker';
```

Update `getDefaultForm` to include `color`:
```ts
const getDefaultForm = (): Partial<Goal> => ({
    title: '',
    why: '',
    horizon: 'season' as GoalHorizon,
    status: 'active' as GoalStatus,
    target_date: '',
    area_id: defaultAreaId ?? null,
    color: '',
});
```

- [ ] **Step 3: Populate `color` when loading an existing goal**

In the `useEffect` that runs when `isOpen` changes, update the object to include:
```ts
color: goal.color ?? '',
```

So the full object inside that effect becomes:
```ts
{
    title: goal.title,
    why: goal.why ?? '',
    horizon: goal.horizon,
    status: goal.status,
    target_date: goal.target_date ?? '',
    area_id: goal.area_id ?? null,
    color: goal.color ?? '',
}
```

- [ ] **Step 4: Add `color` to `hasUnsavedChanges`**

In the `hasUnsavedChanges` function, add to the return expression:
```ts
formData.color !== (goal.color ?? '')
```

The full return becomes:
```ts
return (
    formData.title !== goal.title ||
    formData.why !== (goal.why ?? '') ||
    formData.horizon !== goal.horizon ||
    formData.status !== goal.status ||
    formData.target_date !== (goal.target_date ?? '') ||
    formData.area_id !== (goal.area_id ?? null) ||
    formData.color !== (goal.color ?? '')
);
```

- [ ] **Step 5: Add the `ColorPicker` field to the form**

In the form body, after the Target Date `<div>` block and before the Area `<div>` block (around line 271), add:

```tsx
{/* Color */}
<div>
    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
        {t('forms.color', 'Color')}
    </label>
    <ColorPicker
        value={formData.color || ''}
        onChange={(color) =>
            setFormData((prev) => ({ ...prev, color: color || '' }))
        }
    />
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run type-check 2>/dev/null || npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/entities/Goal.ts frontend/components/Goal/GoalModal.tsx
git commit -m "feat(goals): add color picker to GoalModal"
```

---

## Task 4: Goals list card color

**Files:**
- Modify: `frontend/components/Goals.tsx`

**Interfaces:**
- Consumes: `goal.color?: string` (from Task 3 entity), `goal.Area?.color` (existing)
- Produces: goal cards use the goal's own color first, falling back to area color

- [ ] **Step 1: Update color resolution in Goals.tsx**

In `frontend/components/Goals.tsx`, find the line inside the `filteredGoals.map` callback:

```ts
const areaColor = goal.Area?.color;
const hasColor = !!areaColor;
```

Replace with:

```ts
const effectiveColor = goal.color || goal.Area?.color;
const hasColor = !!effectiveColor;
```

- [ ] **Step 2: Replace `areaColor` references with `effectiveColor`**

In the same file, find:
```tsx
style={hasColor ? { backgroundColor: areaColor } : {}}
```

Replace with:
```tsx
style={hasColor ? { backgroundColor: effectiveColor } : {}}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check 2>/dev/null || npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Goals.tsx
git commit -m "feat(goals): prefer goal color over area color on goal cards"
```

---

## Task 5: Area detail goal row color indicator

**Files:**
- Modify: `frontend/components/Area/AreaDetails.tsx`

**Interfaces:**
- Consumes: `goal.color?: string` (from Task 3 entity)
- Produces: goal rows in area detail show a colored left border when `goal.color` is set

- [ ] **Step 1: Add colored left border to goal rows**

In `frontend/components/Area/AreaDetails.tsx`, find the `<Link>` element inside `areaGoals.map`:

```tsx
<Link
    to={goalUrl}
    className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 transition-colors"
>
```

Replace with:

```tsx
<Link
    to={goalUrl}
    className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 transition-colors ${goal.color ? 'border-l-4' : ''}`}
    style={goal.color ? { borderLeftColor: goal.color } : {}}
>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check 2>/dev/null || npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Area/AreaDetails.tsx
git commit -m "feat(goals): show colored left border on goal rows in area detail"
```

---

## Task 6: Lint, full test run, final verification

- [ ] **Step 1: Run lint fix**

```bash
npm run lint:fix
```

Fix any remaining lint issues.

- [ ] **Step 2: Run the full backend test suite**

```bash
npx jest --testTimeout=30000 2>&1 | tail -20
```

Expected: All tests pass including the new `goals.test.js`.

- [ ] **Step 3: Start the app and verify manually**

```bash
npm start
```

Open `http://localhost:8080`. Open a goal's edit modal — the Color row should appear below Target Date with 11 color swatches. Pick a color, save. On the Goals page the card should use that color. Open an Area detail page — the goal row should show a colored left border.

- [ ] **Step 4: Commit lint fixes if any**

```bash
git add -p
git commit -m "chore: lint fixes after goal color feature"
```
