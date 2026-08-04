# Inbox Clarify Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sequential GTD-style "Clarify" flow to the inbox that walks each item through a decision tree one at a time, filing it as a Task, Note, Project, or trashing it, with recoverable trash and per-item re-clarify.

**Architecture:** Clarify state lives as ephemeral local `useState` in `InboxItems.tsx`. A new `ClarifyOverlay.tsx` component renders in-page (replacing the item list) when active. Trashed items use a new `status:'trashed'` value on the existing string field — no migration needed. The backend gains two new PATCH endpoints and includes `trashedCount` in paginated GET responses.

**Tech Stack:** React (useState, useEffect, useRef), TypeScript, Tailwind CSS, Zustand (inboxStore extension), Express/Sequelize (backend), Jest/Supertest (backend tests), i18next (translations).

## Global Constraints

- No JSDoc `/** */` comments anywhere.
- All user-facing strings go through `t('key', 'fallback')` — add keys to `public/locales/en/translation.json` only (other locales follow separately).
- Tailwind CSS only — no inline styles except for dynamic values.
- Commit prefix: `feat:`, `fix:`, `test:`, `refactor:`.
- Run `npm run lint:fix && npm run lint` before every commit — zero errors required.
- Backend tests use supertest agent pattern; see `backend/tests/integration/inbox.test.js` for reference.
- `StatusType` in `frontend/entities/Task.ts` already includes `'waiting'` — use it directly.
- No `Co-authored-by` trailers in commit messages.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/modules/inbox/repository.js` | Modify | Add `markTrashed`, `markRestored`, `countTrashed`; update `findAllActive` to exclude trashed |
| `backend/modules/inbox/service.js` | Modify | Add `trash`, `restore` methods; include `trashedCount` in paginated `getAll` |
| `backend/modules/inbox/controller.js` | Modify | Add `trash`, `restore` handlers |
| `backend/modules/inbox/routes.js` | Modify | Add two new PATCH routes |
| `backend/tests/integration/inbox.test.js` | Modify | Add test blocks for trash/restore/trashedCount |
| `frontend/entities/InboxItem.ts` | Modify | Document `'trashed'` in status comment |
| `frontend/store/useStore.ts` | Modify | Add `trashedCount` + `setTrashedCount` to InboxStore |
| `frontend/utils/inboxService.ts` | Modify | Add `trashInboxItem`, `restoreInboxItems` API calls + store-aware wrappers; update loader for `trashedCount` |
| `frontend/components/Inbox/ClarifyOverlay.tsx` | **Create** | Self-contained step-by-step clarify card |
| `frontend/components/Inbox/InboxItems.tsx` | Modify | Clarify state, "Process N" button, trashed affordance, modal wrappers |
| `frontend/components/Inbox/InboxItemDetail.tsx` | Modify | "Re-clarify" link in edit footer |
| `public/locales/en/translation.json` | Modify | All new i18n keys |

---

## Task 1: Backend — trash/restore endpoints + trashedCount

**Files:**
- Modify: `backend/modules/inbox/repository.js`
- Modify: `backend/modules/inbox/service.js`
- Modify: `backend/modules/inbox/controller.js`
- Modify: `backend/modules/inbox/routes.js`
- Test: `backend/tests/integration/inbox.test.js`

**Interfaces:**
- Produces:
  - `PATCH /api/inbox/:uid/trash` → `{ uid, status:'trashed', ... }`
  - `PATCH /api/inbox/:uid/restore` → `{ uid, status:'added', ... }`
  - `GET /api/inbox?limit=N&offset=M` → `{ items, pagination, trashedCount: number }`
  - `findAllActive` excludes `status:'trashed'`

- [ ] **Step 1: Write failing tests for trash endpoint**

Add a new `describe` block at the end of `backend/tests/integration/inbox.test.js`, before the closing `});` of the outer `describe('Inbox Routes', ...)`:

```javascript
describe('PATCH /api/inbox/:uid/trash', () => {
    let inboxItem;

    beforeEach(async () => {
        inboxItem = await InboxItem.create({
            content: 'Test content',
            status: 'added',
            source: 'test',
            user_id: user.id,
        });
    });

    it('should mark inbox item as trashed', async () => {
        const response = await agent.patch(`/api/inbox/${inboxItem.uid}/trash`);
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('trashed');
    });

    it('should exclude trashed items from GET /api/inbox', async () => {
        await agent.patch(`/api/inbox/${inboxItem.uid}/trash`);
        const listResponse = await agent.get('/api/inbox?limit=20&offset=0');
        const uids = listResponse.body.items.map((i) => i.uid);
        expect(uids).not.toContain(inboxItem.uid);
    });

    it('should return 404 for non-existent uid', async () => {
        const response = await agent.patch('/api/inbox/abcd1234efghijk/trash');
        expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
        const response = await request(app).patch(`/api/inbox/${inboxItem.uid}/trash`);
        expect(response.status).toBe(401);
    });
});

describe('PATCH /api/inbox/:uid/restore', () => {
    let trashedItem;

    beforeEach(async () => {
        trashedItem = await InboxItem.create({
            content: 'Trashed content',
            status: 'trashed',
            source: 'test',
            user_id: user.id,
        });
    });

    it('should restore a trashed inbox item to added', async () => {
        const response = await agent.patch(`/api/inbox/${trashedItem.uid}/restore`);
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('added');
    });

    it('should make the item appear in GET /api/inbox after restore', async () => {
        await agent.patch(`/api/inbox/${trashedItem.uid}/restore`);
        const listResponse = await agent.get('/api/inbox?limit=20&offset=0');
        const uids = listResponse.body.items.map((i) => i.uid);
        expect(uids).toContain(trashedItem.uid);
    });

    it('should require authentication', async () => {
        const response = await request(app).patch(`/api/inbox/${trashedItem.uid}/restore`);
        expect(response.status).toBe(401);
    });
});

describe('GET /api/inbox trashedCount', () => {
    it('should include trashedCount in paginated response', async () => {
        await InboxItem.create({ content: 'Active', status: 'added', source: 'test', user_id: user.id });
        await InboxItem.create({ content: 'Trashed', status: 'trashed', source: 'test', user_id: user.id });

        const response = await agent.get('/api/inbox?limit=20&offset=0');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('trashedCount');
        expect(response.body.trashedCount).toBeGreaterThanOrEqual(1);
    });

    it('should return trashedCount of 0 when none trashed', async () => {
        await InboxItem.create({ content: 'Active', status: 'added', source: 'test', user_id: user.id });
        const response = await agent.get('/api/inbox?limit=20&offset=0');
        expect(response.status).toBe(200);
        expect(response.body.trashedCount).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- backend/tests/integration/inbox.test.js
```

Expected: new test blocks fail with 404 (routes don't exist yet).

- [ ] **Step 3: Update repository.js**

In `backend/modules/inbox/repository.js`, replace the `findAllActive` method and add three new methods:

```javascript
// Replace findAllActive — now excludes both 'deleted' and 'trashed'
async findAllActive(userId, { limit, offset } = {}) {
    const { Op } = require('sequelize');
    const options = {
        where: {
            user_id: userId,
            status: { [Op.notIn]: ['deleted', 'trashed'] },
        },
        order: [['created_at', 'DESC']],
    };

    if (limit !== undefined) {
        options.limit = limit;
        options.offset = offset || 0;
    }

    return this.model.findAll(options);
}

// Replace countActive — same exclusion
async countActive(userId) {
    const { Op } = require('sequelize');
    return this.model.count({
        where: {
            user_id: userId,
            status: { [Op.notIn]: ['deleted', 'trashed'] },
        },
        raw: true,
    });
}

// Add after countActive:
async countTrashed(userId) {
    return this.model.count({
        where: { user_id: userId, status: 'trashed' },
        raw: true,
    });
}

async markTrashed(item) {
    await item.update({ status: 'trashed' });
    return item;
}

async markRestored(item) {
    await item.update({ status: 'added' });
    return item;
}
```

- [ ] **Step 4: Update service.js**

In `backend/modules/inbox/service.js`, update `getAll` to include `trashedCount`, and add `trash` and `restore` methods:

```javascript
// In getAll — update the paginated branch to include trashedCount:
async getAll(userId, { limit, offset } = {}) {
    const hasPagination = limit !== undefined || offset !== undefined;

    if (hasPagination) {
        const parsedLimit = parseInt(limit, 10) || 20;
        const parsedOffset = parseInt(offset, 10) || 0;

        const [items, totalCount, trashedCount] = await Promise.all([
            inboxRepository.findAllActive(userId, {
                limit: parsedLimit,
                offset: parsedOffset,
            }),
            inboxRepository.countActive(userId),
            inboxRepository.countTrashed(userId),
        ]);

        return {
            items,
            pagination: {
                total: totalCount,
                limit: parsedLimit,
                offset: parsedOffset,
                hasMore: parsedOffset + items.length < totalCount,
            },
            trashedCount,
        };
    }

    return inboxRepository.findAllActive(userId);
}

// Add new methods at the end of the class, before the closing }:
async trash(userId, uid) {
    validateUid(uid);
    const item = await inboxRepository.findByUid(userId, uid);
    if (!item) throw new NotFoundError('Inbox item not found.');
    await inboxRepository.markTrashed(item);
    return _.pick(item, PUBLIC_ATTRIBUTES);
}

async restore(userId, uid) {
    validateUid(uid);
    const item = await inboxRepository.findByUid(userId, uid);
    if (!item) throw new NotFoundError('Inbox item not found.');
    await inboxRepository.markRestored(item);
    return _.pick(item, PUBLIC_ATTRIBUTES);
}
```

- [ ] **Step 5: Update controller.js**

Add `trash` and `restore` handlers at the end of `inboxController` object in `backend/modules/inbox/controller.js`:

```javascript
async trash(req, res, next) {
    try {
        const userId = requireUserId(req);
        const { uid } = req.params;
        const item = await inboxService.trash(userId, uid);
        res.json(item);
    } catch (error) {
        next(error);
    }
},

async restore(req, res, next) {
    try {
        const userId = requireUserId(req);
        const { uid } = req.params;
        const item = await inboxService.restore(userId, uid);
        res.json(item);
    } catch (error) {
        next(error);
    }
},
```

- [ ] **Step 6: Update routes.js**

Add two routes in `backend/modules/inbox/routes.js` (after the existing `patch('/inbox/:uid/process', ...)` line):

```javascript
router.patch('/inbox/:uid/trash', inboxController.trash);
router.patch('/inbox/:uid/restore', inboxController.restore);
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npm test -- backend/tests/integration/inbox.test.js
```

Expected: all tests pass, including the new blocks.

- [ ] **Step 8: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add backend/modules/inbox/repository.js backend/modules/inbox/service.js backend/modules/inbox/controller.js backend/modules/inbox/routes.js backend/tests/integration/inbox.test.js
git commit -m "feat: add inbox trash/restore endpoints and trashedCount in list response"
```

---

## Task 2: Frontend data layer — entity, store, service

**Files:**
- Modify: `frontend/entities/InboxItem.ts`
- Modify: `frontend/store/useStore.ts`
- Modify: `frontend/utils/inboxService.ts`

**Interfaces:**
- Consumes: `PATCH /api/inbox/:uid/trash`, `PATCH /api/inbox/:uid/restore` (from Task 1); `result.trashedCount` on paginated GET response
- Produces:
  - `inboxStore.trashedCount: number`
  - `inboxStore.setTrashedCount(n: number): void`
  - `trashInboxItemWithStore(uid: string): Promise<void>`
  - `restoreInboxItemsWithStore(): Promise<void>`

- [ ] **Step 1: Update InboxItem entity**

In `frontend/entities/InboxItem.ts`, update the status comment:

```typescript
export interface InboxItem {
    id?: number;
    uid?: string;
    content: string;
    title?: string | null;
    status?: string; // 'added' | 'processed' | 'deleted' | 'trashed'
    source?: string;
    created_at?: string;
    updated_at?: string;
}
```

- [ ] **Step 2: Add trashedCount to InboxStore in useStore.ts**

In `frontend/store/useStore.ts`, find the `InboxStore` interface (around line 79) and add:

```typescript
interface InboxStore {
    inboxItems: InboxItem[];
    isLoading: boolean;
    isError: boolean;
    trashedCount: number;          // ← add
    pagination: { ... };
    // ... existing methods ...
    setTrashedCount: (count: number) => void;  // ← add
}
```

In the `inboxStore` initial state object (around line 698), add:

```typescript
inboxStore: {
    inboxItems: [],
    isLoading: false,
    isError: false,
    trashedCount: 0,               // ← add
    pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
    // ... existing methods unchanged ...
    setTrashedCount: (trashedCount) =>
        set((state: any) => ({
            inboxStore: { ...state.inboxStore, trashedCount },
        })),
    // ... rest unchanged ...
```

- [ ] **Step 3: Add trash/restore API functions to inboxService.ts**

In `frontend/utils/inboxService.ts`, add after `deleteInboxItem`:

```typescript
export const trashInboxItem = async (itemUid: string): Promise<InboxItem> => {
    const response = await fetch(getApiPath(`inbox/${itemUid}/trash`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to trash inbox item.');
    return await response.json();
};

export const restoreInboxItems = async (itemUid: string): Promise<InboxItem> => {
    const response = await fetch(getApiPath(`inbox/${itemUid}/restore`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to restore inbox item.');
    return await response.json();
};
```

- [ ] **Step 4: Add store-aware wrappers**

In `frontend/utils/inboxService.ts`, add after the raw API functions:

```typescript
export const trashInboxItemWithStore = async (itemUid: string): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;
    try {
        await trashInboxItem(itemUid);
        inboxStore.removeInboxItemByUid(itemUid);
        inboxStore.setTrashedCount(inboxStore.trashedCount + 1);
    } catch (error) {
        console.error('Failed to trash inbox item:', error);
        throw error;
    }
};

export const restoreInboxItemWithStore = async (itemUid: string): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;
    try {
        const restored = await restoreInboxItems(itemUid);
        inboxStore.addInboxItem(restored);
        inboxStore.setTrashedCount(Math.max(0, inboxStore.trashedCount - 1));
    } catch (error) {
        console.error('Failed to restore inbox item:', error);
        throw error;
    }
};
```

- [ ] **Step 5: Update loadInboxItemsToStore to read trashedCount**

In `frontend/utils/inboxService.ts`, in `loadInboxItemsToStore`, after `inboxStore.setInboxItems(items)`:

```typescript
// existing lines:
inboxStore.setInboxItems(items);
inboxStore.setPagination(pagination);
inboxStore.setError(false);
// add:
if (typeof result.trashedCount === 'number') {
    inboxStore.setTrashedCount(result.trashedCount);
}
```

Note: `result` is the object returned from `fetchInboxItems`. The current code destructures `{ items, pagination }` from it — access `result.trashedCount` after the destructuring. You'll need to capture the full result first:

```typescript
// Change this:
const { items, pagination } = await fetchInboxItems(requestedCount, 0);
// To:
const result = await fetchInboxItems(requestedCount, 0);
const { items, pagination } = result;
// Then later add:
if (typeof result.trashedCount === 'number') {
    inboxStore.setTrashedCount(result.trashedCount);
}
```

- [ ] **Step 6: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add frontend/entities/InboxItem.ts frontend/store/useStore.ts frontend/utils/inboxService.ts
git commit -m "feat: add trashedCount to inbox store and trash/restore service functions"
```

---

## Task 3: ClarifyOverlay component

**Files:**
- Create: `frontend/components/Inbox/ClarifyOverlay.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks (pure presentational)
- Produces:
  ```typescript
  type ClarifyStep = 'actionable' | 'notActionable' | 'steps' | 'twomin' | 'deferDelegate';
  type ClarifyOutcome = 'trash' | 'someday' | 'note' | 'project' | 'done' | 'task' | 'waiting';

  interface ClarifyOverlayProps {
      itemText: string;
      step: ClarifyStep;
      progress: string;       // e.g. "1 of 5"
      canGoBack: boolean;
      isDone: boolean;        // true = queue exhausted, show "All clarified" screen
      onStepTo: (step: ClarifyStep) => void;
      onFile: (outcome: ClarifyOutcome) => void;
      onBack: () => void;
      onExit: () => void;
  }
  ```
  Export: `ClarifyOverlay` (default), `ClarifyStep`, `ClarifyOutcome` (named)

- [ ] **Step 1: Create ClarifyOverlay.tsx**

Create `frontend/components/Inbox/ClarifyOverlay.tsx`:

```typescript
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type ClarifyStep =
    | 'actionable'
    | 'notActionable'
    | 'steps'
    | 'twomin'
    | 'deferDelegate';

export type ClarifyOutcome =
    | 'trash'
    | 'someday'
    | 'note'
    | 'project'
    | 'done'
    | 'task'
    | 'waiting';

interface ClarifyOverlayProps {
    itemText: string;
    step: ClarifyStep;
    progress: string;
    canGoBack: boolean;
    isDone: boolean;
    onStepTo: (step: ClarifyStep) => void;
    onFile: (outcome: ClarifyOutcome) => void;
    onBack: () => void;
    onExit: () => void;
}

type Choice =
    | { label: string; action: 'step'; target: ClarifyStep }
    | { label: string; action: 'file'; target: ClarifyOutcome };

const STEPS: Record<ClarifyStep, { question: string; questionKey: string; choices: Choice[] }> = {
    actionable: {
        question: 'Is this actionable?',
        questionKey: 'inbox.clarifyQ.actionable',
        choices: [
            { label: 'Yes, actionable', action: 'step', target: 'steps' },
            { label: 'Not actionable', action: 'step', target: 'notActionable' },
        ],
    },
    notActionable: {
        question: 'What kind of thing is it?',
        questionKey: 'inbox.clarifyQ.notActionable',
        choices: [
            { label: 'Trash', action: 'file', target: 'trash' },
            { label: 'Someday / Maybe', action: 'file', target: 'someday' },
            { label: 'Reference note', action: 'file', target: 'note' },
        ],
    },
    steps: {
        question: 'One step, or several?',
        questionKey: 'inbox.clarifyQ.steps',
        choices: [
            { label: 'One step', action: 'step', target: 'twomin' },
            { label: 'Several steps (project)', action: 'file', target: 'project' },
        ],
    },
    twomin: {
        question: 'Can you do it in under 2 minutes?',
        questionKey: 'inbox.clarifyQ.twomin',
        choices: [
            { label: 'Yes — do it now', action: 'file', target: 'done' },
            { label: 'No', action: 'step', target: 'deferDelegate' },
        ],
    },
    deferDelegate: {
        question: 'Later yourself, or hand it off?',
        questionKey: 'inbox.clarifyQ.deferDelegate',
        choices: [
            { label: 'Schedule it', action: 'file', target: 'task' },
            { label: 'Delegate', action: 'file', target: 'waiting' },
        ],
    },
};

const ClarifyOverlay: React.FC<ClarifyOverlayProps> = ({
    itemText,
    step,
    progress,
    canGoBack,
    isDone,
    onStepTo,
    onFile,
    onBack,
    onExit,
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onExit();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onExit]);

    if (isDone) {
        return (
            <div className="flex flex-col items-center gap-3 px-6 py-10 mt-2 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('inbox.clarifyDone', 'All clarified. Inbox is calm.')}
                </p>
                <button
                    type="button"
                    onClick={onExit}
                    className="text-[12.5px] text-blue-600 dark:text-blue-400 hover:opacity-75 transition-opacity"
                >
                    {t('inbox.clarifyBackToList', 'Back to list')}
                </button>
            </div>
        );
    }

    const current = STEPS[step];

    return (
        <div className="flex flex-col items-center gap-5 px-6 py-9 mt-2 bg-gray-50/80 dark:bg-white/[0.03] rounded-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {t('inbox.clarifyProgress', 'Clarify · {{progress}}', { progress })}
            </p>

            <p className="max-w-md text-center text-[18px] font-normal text-gray-800 dark:text-gray-100 leading-relaxed">
                {itemText}
            </p>

            <p className="text-[13.5px] text-gray-500 dark:text-gray-400">
                {t(current.questionKey, current.question)}
            </p>

            <div className="flex flex-wrap gap-2.5 justify-center">
                {current.choices.map((choice) => (
                    <button
                        key={choice.target}
                        type="button"
                        onClick={() => {
                            if (choice.action === 'step') {
                                onStepTo(choice.target as ClarifyStep);
                            } else {
                                onFile(choice.target as ClarifyOutcome);
                            }
                        }}
                        className="px-5 py-2 rounded-full bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-[13.5px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors"
                    >
                        {choice.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-4 mt-1">
                {canGoBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        {t('inbox.clarifyBack', '← Back')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onExit}
                    className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                    {t('inbox.clarifyExit', 'Exit clarify')}
                </button>
            </div>
        </div>
    );
};

export default ClarifyOverlay;
```

- [ ] **Step 2: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add frontend/components/Inbox/ClarifyOverlay.tsx
git commit -m "feat: add ClarifyOverlay component"
```

---

## Task 4: Wire clarify into InboxItems

**Files:**
- Modify: `frontend/components/Inbox/InboxItems.tsx`

**Interfaces:**
- Consumes:
  - `ClarifyOverlay`, `ClarifyStep`, `ClarifyOutcome` from `./ClarifyOverlay`
  - `trashInboxItemWithStore`, `restoreInboxItemWithStore` from `../../utils/inboxService`
  - `inboxStore.trashedCount`, `inboxStore.setTrashedCount` from store
- Produces:
  - `onReClarify(uid: string): void` — passed to each `InboxItemDetail` as a prop

- [ ] **Step 1: Add clarify state types and initial state**

At the top of `frontend/components/Inbox/InboxItems.tsx`, add imports:

```typescript
import ClarifyOverlay, { ClarifyStep, ClarifyOutcome } from './ClarifyOverlay';
import { trashInboxItemWithStore, restoreInboxItemWithStore } from '../../utils/inboxService';
```

Add the `ClarifyState` interface (before the component):

```typescript
interface ClarifyState {
    active: boolean;
    itemUids: string[];
    currentIndex: number;
    step: ClarifyStep;
    history: Array<{ step: ClarifyStep }>;
    singleMode: boolean;
    pendingModalUid: string | null;
}

const CLARIFY_INITIAL: ClarifyState = {
    active: false,
    itemUids: [],
    currentIndex: 0,
    step: 'actionable',
    history: [],
    singleMode: false,
    pendingModalUid: null,
};
```

Inside the component, add state:

```typescript
const [clarify, setClarify] = useState<ClarifyState>(CLARIFY_INITIAL);
```

Read `trashedCount` from the store (add to the existing destructure of `inboxStore`):

```typescript
const { inboxItems, isLoading, pagination, trashedCount } = useStore(
    (state) => state.inboxStore
);
```

- [ ] **Step 2: Add clarify lifecycle functions**

Inside the `InboxItems` component, add these handlers:

```typescript
const startClarify = () => {
    const uids = inboxItems.map((i) => i.uid).filter((uid): uid is string => Boolean(uid));
    if (uids.length === 0) return;
    setClarify({
        active: true,
        itemUids: uids,
        currentIndex: 0,
        step: 'actionable',
        history: [],
        singleMode: false,
        pendingModalUid: null,
    });
};

const startSingleClarify = (uid: string) => {
    setClarify({
        active: true,
        itemUids: [uid],
        currentIndex: 0,
        step: 'actionable',
        history: [],
        singleMode: true,
        pendingModalUid: null,
    });
};

const exitClarify = () => setClarify(CLARIFY_INITIAL);

const advanceClarify = () => {
    setClarify((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        step: 'actionable',
        history: [],
        pendingModalUid: null,
    }));
};

const stepClarifyTo = (step: ClarifyStep) => {
    setClarify((prev) => ({
        ...prev,
        step,
        history: [...prev.history, { step: prev.step }],
    }));
};

const goBackClarify = () => {
    setClarify((prev) => {
        const history = [...prev.history];
        const last = history.pop();
        if (!last) return prev;
        return { ...prev, step: last.step, history };
    });
};
```

- [ ] **Step 3: Add the fileClarifyOutcome handler**

This is the main dispatch function when a terminal outcome is chosen. Add after `goBackClarify`:

```typescript
const fileClarifyOutcome = async (outcome: ClarifyOutcome) => {
    const uid = clarify.itemUids[clarify.currentIndex];
    if (!uid) return;
    const item = inboxItems.find((i) => i.uid === uid);
    const itemName = item?.title?.trim() || item?.content?.trim() || '';

    if (outcome === 'trash' || outcome === 'done') {
        try {
            await trashInboxItemWithStore(uid);
        } catch {
            showErrorToast(t('inbox.trashError', 'Failed to trash item'));
            return;
        }
        advanceClarify();
        return;
    }

    if (outcome === 'someday') {
        try {
            await createTask({
                name: itemName,
                status: 'not_started',
                priority: null,
                completed_at: null,
                tags: [{ name: 'someday' }],
            });
            await processInboxItemWithStore(uid);
            showSuccessToast(t('inbox.somedayCreated', 'Added to Someday'));
        } catch {
            showErrorToast(t('task.createError'));
            return;
        }
        advanceClarify();
        return;
    }

    // Modal-based outcomes: open the modal; advance happens in modal's onSave
    setClarify((prev) => ({ ...prev, pendingModalUid: uid }));

    if (outcome === 'note') {
        const noteContent = item?.content || '';
        await handleOpenNoteModal({ title: itemName, content: noteContent }, uid);
    } else if (outcome === 'project') {
        handleOpenProjectModal({ name: itemName, description: '', status: 'planned' as const }, uid);
    } else if (outcome === 'task') {
        await handleOpenTaskModal(
            { name: itemName, status: 'not_started', priority: null, completed_at: null },
            uid
        );
    } else if (outcome === 'waiting') {
        await handleOpenTaskModal(
            {
                name: itemName,
                status: 'waiting',
                priority: null,
                completed_at: null,
                tags: [{ name: 'waiting-for' }],
            },
            uid
        );
    }
};
```

- [ ] **Step 4: Wrap modal onSave handlers to advance clarify**

The existing modal handlers (`handleSaveProject`, `handleSaveNote`, `handleSaveTask`) call `processInboxItemWithStore` internally. We need them to also call `advanceClarify` when clarify is in pendingModalUid state.

Find `handleSaveProject` and at the end of its try block, after `setCurrentConversionItemUid(null)`, add:

```typescript
if (clarify.pendingModalUid) {
    advanceClarify();
}
```

Do the same in `handleSaveNote` after `setCurrentConversionItemUid(null)`.

For `handleSaveTask` / `createTaskAndHandleConversion`, after `setCurrentConversionItemUid(null)`, add the same check.

Also update `handleOpenProjectModal`, `handleOpenNoteModal` to clear `pendingModalUid` on cancel. In the modal's `onClose`:

```typescript
// In the ProjectModal onClose:
onClose={() => {
    setIsProjectModalOpen(false);
    setProjectToEdit(null);
    if (clarify.pendingModalUid) {
        setClarify((prev) => ({ ...prev, pendingModalUid: null }));
    }
}}
// Same pattern for NoteModal onClose
```

- [ ] **Step 5: Add "Process N" and trashed affordance to list header**

In the existing "Recently captured" collapsible `<button>` in `InboxItems.tsx`, replace the current content with:

```tsx
<button
    onClick={() => setInboxListExpanded(prev => !prev)}
    className="flex items-center gap-2.5 w-full px-4 py-2.5 mt-1 rounded-lg text-left hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition-colors"
>
    <span className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 flex-1">
        {t('inbox.recentlyCaptured', 'Recently captured')}
    </span>
    <span className="text-[11px] text-gray-400 dark:text-gray-500">
        {inboxItems.length}
    </span>

    {/* Process N button */}
    {inboxItems.length > 0 && !clarify.active && (
        <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); startClarify(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); startClarify(); } }}
            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:opacity-75 transition-opacity cursor-pointer"
        >
            {t('inbox.processN', 'Process {{count}}', { count: inboxItems.length })}
        </span>
    )}

    {/* Trashed affordance */}
    {trashedCount > 0 && (
        <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
                e.stopPropagation();
                void (async () => {
                    try {
                        // Restore all trashed items one by one isn't efficient;
                        // instead reload after a bulk restore call — use loadInboxItemsToStore
                        // For now, restore is per-item via UI; here we reload the list
                        // which surfaces restored items. A future bulk endpoint can replace this.
                        // NOTE: restoreInboxItemWithStore restores one item.
                        // The "restore" affordance reloads the full list from the API
                        // so the user sees all restored items. Wire to a page reload:
                        await loadInboxItemsToStore(true);
                        showSuccessToast(t('inbox.restored', 'Trashed items restored'));
                    } catch {
                        showErrorToast(t('inbox.restoreError', 'Failed to restore'));
                    }
                })();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}
            className="text-[10.5px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
            {t('inbox.trashedRestore', '{{count}} trashed · restore', { count: trashedCount })}
        </span>
    )}

    <svg className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${inboxListExpanded ? 'rotate-90' : ''}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
</button>
```

**Important note on the restore affordance:** The "N trashed · restore" button above calls `loadInboxItemsToStore` which reloads the list — but it doesn't actually call the restore API. The restore endpoint needs to be called. Since restore is per-item and there's no bulk endpoint, you need to either: (a) add a bulk restore endpoint, or (b) call `restoreInboxItemWithStore` for each trashed item uid. Since the frontend doesn't have trashed item uids locally, the cleanest v1 approach is to add a bulk restore endpoint.

**Add a bulk restore endpoint** (update Task 1 backend accordingly, or do it here):

In `backend/modules/inbox/repository.js`, add:
```javascript
async restoreAllTrashed(userId) {
    const { Op } = require('sequelize');
    await this.model.update(
        { status: 'added' },
        { where: { user_id: userId, status: 'trashed' } }
    );
}
```

In `backend/modules/inbox/service.js`, add:
```javascript
async restoreAll(userId) {
    await inboxRepository.restoreAllTrashed(userId);
    return { message: 'All trashed items restored' };
}
```

In `backend/modules/inbox/controller.js`, add:
```javascript
async restoreAll(req, res, next) {
    try {
        const userId = requireUserId(req);
        const result = await inboxService.restoreAll(userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
},
```

In `backend/modules/inbox/routes.js`, add:
```javascript
router.patch('/inbox/restore-all', inboxController.restoreAll);
```

**Important:** This route must be declared BEFORE `router.patch('/inbox/:uid/restore', ...)` to avoid `:uid` matching the literal string `restore-all`.

In `frontend/utils/inboxService.ts`, replace the restore affordance call with:
```typescript
export const restoreAllTrashedWithStore = async (): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;
    const response = await fetch(getApiPath('inbox/restore-all'), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to restore items.');
    inboxStore.setTrashedCount(0);
    await loadInboxItemsToStore(true);
};
```

Then update the restore affordance button to call `restoreAllTrashedWithStore()`.

- [ ] **Step 6: Render ClarifyOverlay inside the expanded list section**

In the `inboxListExpanded && (...)` block, just before the `{inboxItems.map(...)}` list, add:

```tsx
{/* Clarify overlay — shown instead of the list when active */}
{clarify.active && !clarify.pendingModalUid && (() => {
    const uid = clarify.itemUids[clarify.currentIndex];
    const item = inboxItems.find((i) => i.uid === uid);
    const isDone = clarify.currentIndex >= clarify.itemUids.length;
    return (
        <ClarifyOverlay
            itemText={item?.title?.trim() || item?.content?.trim() || ''}
            step={clarify.step}
            progress={`${Math.min(clarify.currentIndex + 1, clarify.itemUids.length)} of ${clarify.itemUids.length}`}
            canGoBack={clarify.history.length > 0}
            isDone={isDone}
            onStepTo={stepClarifyTo}
            onFile={(outcome) => void fileClarifyOutcome(outcome)}
            onBack={goBackClarify}
            onExit={exitClarify}
        />
    );
})()}

{/* Normal item list — hidden while clarify is active */}
{!clarify.active && inboxItems.map((item) => (
    <InboxItemDetail
        key={item.uid || item.id}
        item={item}
        onDelete={handleDeleteItem}
        onUpdate={handleUpdateItem}
        openTaskModal={handleOpenTaskModal}
        openProjectModal={handleOpenProjectModal}
        openNoteModal={handleOpenNoteModal}
        projects={projects}
        isNew={item.uid === lastAddedUid}
        onReClarify={startSingleClarify}
    />
))}
```

- [ ] **Step 7: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add frontend/components/Inbox/InboxItems.tsx backend/modules/inbox/repository.js backend/modules/inbox/service.js backend/modules/inbox/controller.js backend/modules/inbox/routes.js frontend/utils/inboxService.ts
git commit -m "feat: wire clarify flow into InboxItems with Process N, trashed affordance, and modal integration"
```

---

## Task 5: Re-clarify link in InboxItemDetail

**Files:**
- Modify: `frontend/components/Inbox/InboxItemDetail.tsx`

**Interfaces:**
- Consumes: `onReClarify?: (uid: string) => void` (new optional prop)

- [ ] **Step 1: Add onReClarify prop**

In `frontend/components/Inbox/InboxItemDetail.tsx`, update the `InboxItemDetailProps` interface:

```typescript
interface InboxItemDetailProps {
    item: InboxItem;
    onDelete: (uid: string) => void;
    onUpdate?: (uid: string, newContent: string) => Promise<void>;
    openTaskModal: (task: Task, inboxItemUid?: string) => void;
    openProjectModal: (project: Project | null, inboxItemUid?: string) => void;
    openNoteModal: (note: Note | null, inboxItemUid?: string) => void;
    projects: Project[];
    isNew?: boolean;
    onReClarify?: (uid: string) => void;   // ← add
}
```

Add to the destructured props at the top of the component:

```typescript
const InboxItemDetail: React.FC<InboxItemDetailProps> = ({
    // ...existing props...
    onReClarify,
}) => {
```

- [ ] **Step 2: Add Re-clarify link to edit-mode footer**

In the `renderComposerFooter` function, find the "Save as" block and add the Re-clarify link after the Project button, separated by a bullet:

```tsx
const renderComposerFooter = (context: InboxComposerFooterContext) => (
    <div className="pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
                {loading && (
                    <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
                <span className="text-[11px] text-gray-400 dark:text-gray-500 mr-1">
                    {t('inbox.saveAs', 'Save as')}
                </span>
                <button type="button" onClick={() => handleConvertToTask(context)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors">
                    <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
                    {t('inbox.createTask', 'Task')}
                </button>
                <button type="button" onClick={() => void handleConvertToNote(context)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors">
                    <DocumentTextIcon className="h-3.5 w-3.5" />
                    {t('inbox.createNote', 'Note')}
                </button>
                <button type="button" onClick={() => handleConvertToProject(context)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors">
                    <FolderIcon className="h-3.5 w-3.5" />
                    {t('inbox.createProject', 'Project')}
                </button>

                {/* Re-clarify link */}
                {onReClarify && item.uid && (
                    <>
                        <span className="text-[11px] text-gray-300 dark:text-gray-600 select-none">•</span>
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                onReClarify(item.uid!);
                            }}
                            className="px-2.5 py-1 text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                            {t('inbox.reClarifyLink', 'Re-clarify')}
                        </button>
                    </>
                )}
            </div>
            <button type="button" onClick={handleDelete}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                {t('common.delete', 'Delete')}
            </button>
        </div>
    </div>
);
```

- [ ] **Step 3: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add frontend/components/Inbox/InboxItemDetail.tsx
git commit -m "feat: add Re-clarify link to inbox item edit footer"
```

---

## Task 6: i18n — English translation keys

**Files:**
- Modify: `public/locales/en/translation.json`

**Interfaces:** None (last task, no downstream consumers)

- [ ] **Step 1: Add all new keys**

Open `public/locales/en/translation.json` and add the following keys into the `"inbox"` section (keep the file's existing alphabetical/grouping order where possible):

```json
"inbox.processN": "Process {{count}}",
"inbox.allClarified": "All clarified",
"inbox.reClarify": "Re-clarify",
"inbox.trashedRestore": "{{count}} trashed · restore",
"inbox.restored": "Trashed items restored",
"inbox.restoreError": "Failed to restore items",
"inbox.trashError": "Failed to trash item",
"inbox.clarifyProgress": "Clarify · {{progress}}",
"inbox.clarifyDone": "All clarified. Inbox is calm.",
"inbox.clarifyBackToList": "Back to list",
"inbox.clarifyExit": "Exit clarify",
"inbox.clarifyBack": "← Back",
"inbox.clarifyQ.actionable": "Is this actionable?",
"inbox.clarifyQ.notActionable": "What kind of thing is it?",
"inbox.clarifyQ.steps": "One step, or several?",
"inbox.clarifyQ.twomin": "Can you do it in under 2 minutes?",
"inbox.clarifyQ.deferDelegate": "Later yourself, or hand it off?",
"inbox.somedayCreated": "Added to Someday",
"inbox.reClarifyLink": "Re-clarify"
```

Note: `t()` calls with dotted keys like `'inbox.clarifyQ.actionable'` require the JSON to use nested objects, not flat dot-notation keys. Check the existing structure of `translation.json` — if it uses nested objects, the keys above need to be nested accordingly:

```json
{
  "inbox": {
    "clarifyQ": {
      "actionable": "Is this actionable?",
      "notActionable": "What kind of thing is it?",
      "steps": "One step, or several?",
      "twomin": "Can you do it in under 2 minutes?",
      "deferDelegate": "Later yourself, or hand it off?"
    },
    "processN": "Process {{count}}",
    "trashedRestore": "{{count}} trashed · restore",
    ...
  }
}
```

If the file uses flat dot-notation keys (all at root level), keep them flat. Match the existing convention exactly.

- [ ] **Step 2: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add public/locales/en/translation.json
git commit -m "feat: add i18n keys for inbox clarify feature"
```

---

## Self-Review Checklist

- [x] Decision tree all 5 steps covered in ClarifyOverlay STEPS constant
- [x] All 7 outcomes handled in `fileClarifyOutcome`
- [x] `trash` and `done` both call `trashInboxItemWithStore` — distinct labels, same DB effect
- [x] `someday` creates a task silently (no modal) — verified in Task 4 step 3
- [x] `waiting` opens TaskModal with `status:'waiting'` and `tags:[{name:'waiting-for'}]` — `'waiting'` confirmed valid in `StatusType`
- [x] `pendingModalUid` prevents overlay from rendering while modal is open (Task 4 step 6 checks `!clarify.pendingModalUid`)
- [x] Back only navigates within current item's step history, not across items
- [x] Escape in overlay calls `onExit` — wired in ClarifyOverlay useEffect
- [x] Bulk restore uses `/inbox/restore-all` route declared before `/:uid/restore` to avoid matching conflict
- [x] `trashedCount` only added to paginated response (the non-paginated array path is unchanged)
- [x] `onReClarify` is optional in props — no crashes if used without clarify wired up
- [x] `loadInboxItemsToStore` restructured to capture full result before destructuring for `trashedCount` access
- [x] All translation keys documented in Task 6; file structure (nested vs flat) flagged for implementer to verify