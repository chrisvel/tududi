# Inbox Clarify Feature — Design Spec

**Date:** 2026-08-03  
**Status:** Approved  
**Scope:** Sequential Clarify flow, per-item re-clarify, recoverable trash, Escape scoping

---

## Overview

The Clarify feature adds a structured GTD-style processing flow to the inbox. A "Process N" button in the list header opens a one-item-at-a-time in-page overlay that walks the user through a decision tree for each unprocessed item. Items can be filed as tasks, projects, or notes (opening existing modals), trashed (recoverable), or silently converted to someday/waiting tasks. A per-item "Re-clarify" link in the edit footer lets users re-run the flow on a single already-filed item.

---

## Decision Tree

```
Is this actionable?
├── Not actionable → What kind of thing is it?
│   ├── Trash           → mark status:'trashed' (recoverable)
│   ├── Someday / Maybe → create Task silently (name=item content, tags:['someday']), process item
│   └── Reference note  → open NoteModal pre-filled → process item on modal save
└── Actionable → One step, or several?
    ├── Several steps → open ProjectModal pre-filled → process item on modal save
    └── One step → Can you do it in under 2 minutes?
        ├── Yes — do it now → mark status:'trashed' (done, no artifact needed)
        └── No → Later yourself, or hand it off?
            ├── Schedule it → open TaskModal pre-filled → process item on modal save
            └── Delegate    → open TaskModal pre-filled
                             (status:'waiting', tags:['waiting-for']) → process on save
```

Steps enum: `actionable | notActionable | steps | twomin | deferDelegate`

Outcomes enum: `trash | someday | note | project | done | task | waiting`

- `trash` and `done` both set `status:'trashed'` on the inbox item (no new artifact created).
- `someday` silently calls `createTask` with the item's content as the name and `{ name: 'someday' }` tag, then calls `processInboxItem`. Shows a success toast. No modal.
- `note | project | task | waiting` open the respective modal pre-filled with the item's content. The inbox item is processed only after the modal's `onSave` fires. If the modal is cancelled, the clarify overlay stays on the same item.

---

## Backend Changes

### No migration needed
`status` is a plain `DataTypes.STRING` with no enum constraint. Adding `'trashed'` requires no schema change.

### Repository (`backend/modules/inbox/repository.js`)
- `findAllActive`: add `status: { [Op.notIn]: ['deleted', 'trashed'] }` (currently only excludes `'deleted'` via `status: 'added'`).
- `countTrashed(userId)`: counts items where `status = 'trashed'` for the user.
- `markTrashed(item)`: `item.update({ status: 'trashed' })`.
- `markRestored(item)`: `item.update({ status: 'added' })`.

### Service (`backend/modules/inbox/service.js`)
- `getAll`: include `trashedCount` in the response object alongside `pagination`. Always include it (returns 0 when none).
- `trash(userId, uid)`: find item, call `markTrashed`.
- `restore(userId, uid)`: find item, call `markRestored`.

### Controller (`backend/modules/inbox/controller.js`)
- `trash(req, res, next)`: delegates to `inboxService.trash`.
- `restore(req, res, next)`: delegates to `inboxService.restore`.

### Routes (`backend/modules/inbox/routes.js`)
```
PATCH /inbox/:uid/trash    → controller.trash
PATCH /inbox/:uid/restore  → controller.restore
```

### Response shape for `GET /inbox`
```json
{
  "items": [...],
  "pagination": { "total": 12, "limit": 20, "offset": 0, "hasMore": false },
  "trashedCount": 3
}
```

---

## Frontend Changes

### `frontend/entities/InboxItem.ts`
Add `'trashed'` to the status comment: `'added' | 'processed' | 'deleted' | 'trashed'`.

### `frontend/utils/inboxService.ts`
New API functions:
```ts
trashInboxItem(itemUid: string): Promise<InboxItem>
restoreInboxItems(): Promise<void>   // restores all trashed for the user
```
New store-aware wrappers:
```ts
trashInboxItemWithStore(itemUid: string): Promise<void>
  // optimistic: removeInboxItemByUid + decrement trashedCount after confirming
restoreInboxItemsWithStore(): Promise<void>
  // calls restore endpoint, then reloads inbox items
```
Update `loadInboxItemsToStore` to read `result.trashedCount` and call `inboxStore.setTrashedCount`.

### `frontend/store/useStore.ts`
Add to `InboxStore` interface and initial state:
```ts
trashedCount: number;
setTrashedCount: (count: number) => void;
```

### `frontend/components/Inbox/InboxItems.tsx`

**Clarify state** (local `useState`):
```ts
interface ClarifyState {
  active: boolean;
  itemUids: string[];           // ordered queue of uids to process
  currentIndex: number;
  step: ClarifyStep;
  history: Array<{ uid: string; step: ClarifyStep }>;
  singleMode: boolean;          // true = single-item re-clarify
  pendingModalUid: string | null; // set while Task/Note/Project modal is open from clarify
}
```

**Starting clarify:**
```ts
function startClarify() {
  const uids = inboxItems.map(i => i.uid).filter(Boolean);
  setClarify({ active: true, itemUids: uids, currentIndex: 0,
               step: 'actionable', history: [], singleMode: false, pendingModalUid: null });
}

function startSingleClarify(uid: string) {
  setClarify({ active: true, itemUids: [uid], currentIndex: 0,
               step: 'actionable', history: [], singleMode: true, pendingModalUid: null });
}
```

**Advancing / going back:**
- `advanceClarify(uid)`: clear history (start fresh for next item), move `currentIndex` forward. When `currentIndex >= itemUids.length`, show "done" state.
- `goBackClarify()`: pop last entry from history to return to the previous *step* for the **current item only**. Back does not undo a filed outcome (e.g. a created task cannot be un-created via Back). History only tracks step navigation within a single item's pass through the tree.
- `exitClarify()`: set `active: false`.

**Filing an outcome from the overlay:**
- `trash` / `done`: call `trashInboxItemWithStore(uid)`, then `advanceClarify(uid)`.
- `someday`: call `createTask({ name, status:'not_started', tags:[{name:'someday'}] })` silently, call `processInboxItemWithStore(uid)`, show toast, then `advanceClarify(uid)`.
- `note | project | task | waiting`: set `pendingModalUid = uid`, open corresponding modal (existing handlers). The modal's `onSave` already calls `processInboxItemWithStore`. Wrap it to also call `advanceClarify(pendingModalUid)` and clear `pendingModalUid`.

**List header** (inside the "Recently captured" collapsible button row):
```
[Recently captured]  [N]  Process 5   2 trashed · restore   [chevron]
```
- "Process N" — blue, visible when `inboxItems.length > 0` and clarify not active.
- "All clarified" (muted) + "Re-clarify" (blue) — shown when `inboxItems.length === 0` or all have been through the flow (simplified: show when user has previously run clarify; for v1 just omit "All clarified" state and always show "Process N" when items exist).
- "N trashed · restore" — shown when `trashedCount > 0`. Clicking calls `restoreInboxItemsWithStore`.

**ClarifyOverlay** renders inline (replacing the item list) when `clarify.active && !clarify.pendingModalUid`.

### `frontend/components/Inbox/InboxItemDetail.tsx`

Edit-mode footer gains a "Re-clarify" link after the save-as buttons, separated by "•":

```
Save as: [Task] [Note] [Project] • Re-clarify     [Delete]
```

Clicking "Re-clarify" calls `onReClarify(item.uid)` (a new optional prop passed from `InboxItems`). It closes the item's edit mode and opens single-item clarify.

### NEW: `frontend/components/Inbox/ClarifyOverlay.tsx`

Self-contained presentational component. Props:

```ts
interface ClarifyOverlayProps {
  itemText: string;
  step: ClarifyStep;
  progress: string;        // e.g. "2 of 5"
  canGoBack: boolean;
  isDone: boolean;         // true when queue is exhausted
  onChoice: (outcome: ClarifyOutcome | ClarifyStep) => void;
  onBack: () => void;
  onExit: () => void;
}
```

Choices per step:

| Step | Question | Choices |
|------|----------|---------|
| `actionable` | Is this actionable? | Yes, actionable → `steps` · Not actionable → `notActionable` |
| `notActionable` | What kind of thing is it? | Trash → `trash` · Someday / Maybe → `someday` · Reference note → `note` |
| `steps` | One step, or several? | One step → `twomin` · Several steps → `project` |
| `twomin` | Can you do it in under 2 minutes? | Yes — do it now → `done` · No → `deferDelegate` |
| `deferDelegate` | Later yourself, or hand it off? | Schedule it → `task` · Delegate → `waiting` |

Layout (in-page, centered card replacing the item list):
```
  Clarify · 2 of 5
  ─────────────────────────────────────
  "Buy milk and also call dentist"

  One step, or several?

  [One step]   [Several steps (project)]

  ← Back    Exit clarify
```

Done state (queue exhausted):
```
  All clarified. Inbox is calm.
  Back to list
```

Escape handling: `ClarifyOverlay` attaches a `keydown` listener on mount; `Escape` calls `onExit`.

---

## Escape Key Scoping

| Context | Escape behavior |
|---------|----------------|
| Item edit mode (InboxItemDetail) | Cancels edit on that item only — already implemented |
| ClarifyOverlay | Calls `onExit` — closes the whole clarify flow |
| Task/Note/Project modal opened from clarify | Modal handles its own Escape (existing behavior); clarify stays on current item |

---

## i18n

All new user-facing strings added to `public/locales/en/translation.json` first. Keys:

```json
"inbox.processN": "Process {{count}}",
"inbox.allClarified": "All clarified",
"inbox.reClarify": "Re-clarify",
"inbox.trashedRestore": "{{count}} trashed · restore",
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
"inbox.clarifyChoice.yesActionable": "Yes, actionable",
"inbox.clarifyChoice.notActionable": "Not actionable",
"inbox.clarifyChoice.trash": "Trash",
"inbox.clarifyChoice.someday": "Someday / Maybe",
"inbox.clarifyChoice.referenceNote": "Reference note",
"inbox.clarifyChoice.oneStep": "One step",
"inbox.clarifyChoice.severalSteps": "Several steps (project)",
"inbox.clarifyChoice.doItNow": "Yes — do it now",
"inbox.clarifyChoice.no": "No",
"inbox.clarifyChoice.scheduleIt": "Schedule it",
"inbox.clarifyChoice.delegate": "Delegate",
"inbox.somedayCreated": "Added to Someday",
"inbox.reClarifyLink": "Re-clarify"
```

Other locales can follow in a separate pass.

---

## Files Touched

| File | Change |
|------|--------|
| `backend/modules/inbox/repository.js` | `findAllActive` excludes trashed; add `countTrashed`, `markTrashed`, `markRestored` |
| `backend/modules/inbox/service.js` | Add `trash`, `restore`; include `trashedCount` in `getAll` |
| `backend/modules/inbox/controller.js` | Add `trash`, `restore` handlers |
| `backend/modules/inbox/routes.js` | Add two PATCH routes |
| `frontend/entities/InboxItem.ts` | Document `'trashed'` status |
| `frontend/utils/inboxService.ts` | Add trash/restore API + store-aware functions; update loader |
| `frontend/store/useStore.ts` | Add `trashedCount` + setter to InboxStore |
| `frontend/components/Inbox/InboxItems.tsx` | Clarify state, "Process N", trashed affordance, modal wrappers |
| `frontend/components/Inbox/InboxItemDetail.tsx` | "Re-clarify" link in edit footer |
| `frontend/components/Inbox/ClarifyOverlay.tsx` | **NEW** — step-by-step card |
| `public/locales/en/translation.json` | New i18n keys |
