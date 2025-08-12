# Authentication, Permissions, and Sharing Architecture

This document outlines the backend security model for authentication, authorization (RBAC), and resource sharing.

## Authentication
- Session-based auth with `express-session` and Sequelize store (`backend/app.js`).
- Middleware `requireAuth` (`backend/middleware/auth.js`) guards all API routes under `/api` except health, login, and `current_user`.

## Resource Identity
- Core resources: `project`, `task`, `note`.
- Each resource has a stable `uid` used for sharing/access decisions. Some routes accept numeric IDs but resolve to `uid` internally.

## Authorization (RBAC)
- Access levels: `none`, `ro`, `rw`, `admin` (`permissionsService.ACCESS`).
- Ownership implies `rw` access. Admin role implies `admin` access (`backend/services/rolesService.js`).
- Central check: `hasAccess(requiredAccess, resourceType, getResourceUid, options)` (`backend/middleware/authorize.js`).
  - Resolves `uid` via `getResourceUid(req)`.
  - Calls `permissionsService.getAccess(userId, resourceType, uid)`.
  - Compares levels and either `next()` or returns 403/404 based on options.

### Permissions Service
- `getAccess(userId, resourceType, uid)`:
  - If admin → `admin`.
  - If owner (via model lookup) → `rw`.
  - Else checks `permissions` table for shared access level.
- `ownershipOrPermissionWhere(resourceType, userId)`:
  - Returns a Sequelize `where` clause that matches owned resources or resources shared to the user (by `uid`). Useful for list endpoints.

## Sharing Model
- Stored in `permissions` table (`backend/models/permission.js`):
  - Columns: `user_id`, `resource_type`, `resource_uid`, `access_level` (ro/rw/admin), `propagation` (direct/inherited), `granted_by_user_id`.
- Propagation rules computed by calculators (`backend/services/permissionsCalculators.js`):
  - Sharing a `project` propagates to descendant `tasks` and `notes` (inherited).
  - Sharing a `task` can propagate to its descendants.
  - Sharing a `note` applies directly.
  - Revokes remove the corresponding rows (and inherited ones).

## HTTP Status Semantics
- 401 Unauthorized: no session or invalid session.
- 404 Not Found: resource does not exist (or explicitly configured legacy concealment).
- 403 Forbidden: resource exists but caller lacks required access.

## Route Usage Patterns
- Read collection endpoints (e.g., `/api/notes`, `/api/tasks`, `/api/projects`):
  - Use `ownershipOrPermissionWhere` to include owned and shared resources.
- Item endpoints (e.g., `/api/note/:id`, `/api/task/:id`):
  - Wrap handlers with `hasAccess('ro'|'rw', resourceType, getResourceUid, { notFoundMessage })`.
  - Inside the handler, assume access is enforced; still handle true 404s when the item is deleted between checks.

## Testing Guarantees
- Integration tests assert:
  - 401 for unauthenticated requests.
  - 404 for non-existent resources.
  - 403 for existing resources without sufficient permissions.
  - Project UID-slug routes correctly return 403 when the project exists but is not accessible.
