### Goal
Introduce sharing and permissions as an additive layer, starting with project sharing (cascade to its items), without changing existing item schemas. Fast reads via a precomputed permissions table; full audit via actions.

### Data model (new tables)
- **Permissions (`permissions`)**
  - id, user_id, resource_type ('area'|'project'|'task'|'note'|'tag'), resource_uid, access_level ('ro'|'rw'), propagation ('direct'|'inherited'), granted_by_user_id, source_action_id (nullable), created_at
  - Unique index: (user_id, resource_type, resource_uid)
  - Indexes: (resource_type, resource_uid), (user_id), (access_level)
- **Actions (`actions`)**
  - id, actor_user_id, verb ('share_grant'|'share_revoke'|...), resource_type, resource_uid, target_user_id, access_level, metadata JSON, created_at
  - Indexes: (resource_type, resource_uid), (target_user_id)
- **Users**
  - Add `is_admin` boolean (default false), indexed

Notes
- Use `resource_uid` for item identity (all core models have `uid`).
- Ownership is derived from the model's `user_id` (no owner row stored in `permissions`).
- Admin bypasses `permissions` checks (rule-level, not stored).

### Services
- **PermissionsService**
  - `grantShare(actorUserId, resourceType, resourceUid, targetUserId, accessLevel)`
  - `revokeShare(actorUserId, resourceType, resourceUid, targetUserId)`
  - `getAccess(userId, resourceType, resourceUid)` → 'none'|'ro'|'rw'|'admin' (ownership checked via `user_id` on the resource)
  - `rebuildForResource(resourceType, resourceUid)` → recompute cascade rows
  - `rebuildForUser(userId)` and full rebuild (maintenance)
- **ResourceTraversal**
  - `descendants(resourceType, resourceUid)` → list of {resource_type, resource_uid}
  - Initial support:
    - project → tasks (and all their subtasks via parent chain), notes
    - area → projects → tasks, notes
  - Extensible map for future nested projects or new item types
- **ActionsLog**
  - `append(action)` for share grant/revoke and seeds
  - Audit queries by resource or user

### Enforcement
- Rule evaluation
  - Admin: full rw everywhere
  - Otherwise: max(access from `permissions`) for (user, resource)
- Query helpers
  - `ownershipOrPermissionWhere(resourceType, userId)` returns:
    - (table.user_id = :userId) OR EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.resource_type = :type AND p.resource_uid = table.uid AND p.user_id = :userId
    )
  - Access checks for mutating routes must require 'rw' or ownership/admin

### Endpoints (new)
- POST `/api/shares` { resource_type, resource_uid, target_user_email, access_level }
- DELETE `/api/shares` { resource_type, resource_uid, target_user_id }
- GET `/api/shares` { resource_type, resource_uid } → current shares
- GET `/api/permissions/preview` { resource_type, resource_uid } → debug-only (dev)

Constraints
- Only owners and admins can share (owners limited to their items).
- Share mode: 'ro' or 'rw'.
- Cascade on share/revoke: apply to descendants; maintain propagation='inherited'.

### Rollout plan (incremental)
1) Schema
- Add `is_admin` to `users`
- Create `actions`, `permissions` (+ indexes)

2) Seed
- No owner seeding; permissions contain only explicit shares

3) Sharing API
- Implement shares endpoints + audit logging + cascade calc for projects

4) Permission-aware reads (phase 1)
- Projects read endpoints include shared:
  - use `ownershipOrPermissionWhere('project', userId)`
- Tasks/Notes by project include shared via project cascade
- Mutations enforce 'rw' via `PermissionsService.getAccess`

5) Permission-aware reads (phase 2)
- Global lists (All Tasks/Notes/Tags/Areas): include shared via EXISTS on `permissions`

6) Frontend (minimal)
- On project detail: “Share” dialog (email + RO/RW), list current shares, revoke/change
- Badge/indicator when viewing shared resources
- Error toasts on insufficient permission

7) Maintenance/ops
- Admin tools: rebuild user/resource permissions
- Feature flag `PERMISSIONS_ENABLED` to gate new behavior during rollout

### Audit trail
- All share grants/revokes are appended to `actions`
- `source_action_id` stored in derived `permissions` rows for traceability

### Performance and indexing
- Use `uid` joins for permission EXISTS checks
- Ensure (resource_type, resource_uid) index; and (user_id, resource_type, resource_uid) unique
- Keep cascade recomputation scoped to affected subtree

### Edge cases
- Demotion RW→RO: update direct permission; recompute inherited leaves
- Revoke: remove direct and inherited rows for target user under subtree
- Multiple grants: keep highest effective access
- Ownership transfer (future): update the resource `user_id`; permissions unaffected except potential cascade recalculation for descendants

### Permissions calculation architecture (functions)
- Well-defined, reusable calculators that compute diffs only (no DB I/O):
  - `calculateProjectPerms`, `calculateTaskPerms`, `calculateNotePerms`, `calculateAreaPerms`, `calculateTagPerms`
  - Project/Area calculators must reuse `calculateTaskPerms` / `calculateNotePerms` to cover descendants; subtasks are handled by `calculateTaskPerms` (no separate function).
- Application layer:
  - `applyPerms(tx, changes)` applies diffs (bulk upsert/delete) inside a DB transaction.
  - `execAction(db, action)` validates, opens a transaction, calls the appropriate calculators, calls `applyPerms`, persists the `actions` row, and commits.

Suggested types (pseudo-TS):

```ts
type ResourceType = 'area'|'project'|'task'|'note'|'tag';
type AccessLevel = 'ro'|'rw';
type Propagation = 'direct'|'inherited';

type PermUpsert = {
  userId: number;
  resourceType: ResourceType;
  resourceUid: string;
  accessLevel: AccessLevel;
  propagation: Propagation;
  grantedByUserId: number;
  sourceActionId?: number; // set by execAction
};

type PermDelete = {
  userId: number;
  resourceType: ResourceType;
  resourceUid: string;
};

type PermChanges = { upserts: PermUpsert[]; deletes: PermDelete[] };

type ShareAction =
  | { verb: 'share_grant'; actorUserId: number; targetUserId: number; resourceType: ResourceType; resourceUid: string; accessLevel: AccessLevel }
  | { verb: 'share_revoke'; actorUserId: number; targetUserId: number; resourceType: ResourceType; resourceUid: string };

async function calculateProjectPerms(ctx, input): Promise<PermChanges> {}
async function calculateTaskPerms(ctx, input): Promise<PermChanges> {}
async function calculateNotePerms(ctx, input): Promise<PermChanges> {}
async function calculateAreaPerms(ctx, input): Promise<PermChanges> {}
async function calculateTagPerms(ctx, input): Promise<PermChanges> {}

async function applyPerms(tx, changes: PermChanges): Promise<void> {}
async function execAction(db, action: ShareAction): Promise<void> {}
```

Key behaviors
- Ownership/admin: ownership derived from `user_id`; admins bypass checks. `execAction` enforces "only owner or admin can share".
- Subtree reuse: higher-level calculators compose results by calling lower-level ones (e.g., project → tasks/notes; tasks include subtasks).
- Diff rules: return only necessary changes; dedupe per (user,type,uid); collapse to max access (rw > ro); demotion RW→RO produces an upsert; revoke produces deletes (direct + inherited under subtree).
- Idempotency: `applyPerms` uses upsert (ON CONFLICT DO UPDATE) and keeps higher access; `execAction` may accept an idempotency key to avoid double application.
- Transactions: `execAction` inserts action, computes, sets `sourceActionId` on upserts, then `applyPerms`, all within a single transaction.
- Performance: batch-fetch subtree UIDs; bulk upsert/delete.
- Testing: unit-test calculators (pure); integration-test `execAction` with DB.
- Observability: `actions` row is the audit source of truth.
