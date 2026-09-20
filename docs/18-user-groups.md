# User Groups

[← Back to Index](../CLAUDE.md)

---

## Overview

A group is a named set of users that an admin maintains. Anyone who owns a project, area, goal, note or task can share it with a whole group instead of inviting people one by one. Members are invited like any other collaborator and see the item after they accept.

Groups are managed by admins and belong to the instance, not to a user. Any signed-in user can pick a group when sharing.

---

## Behavior

### Managing groups (admin only)

Admin > Users and Groups has a **Users** tab and a **Groups** tab on one page, served at `/admin/users`. The Groups tab (`/admin/users?tab=groups`) lists every group with its member and shared-item counts. An admin can create, rename and delete groups and add or remove members. The old `/admin/groups` URL redirects to the Groups tab.

### Sharing with a group

The share dialog shows a **User | Group** toggle once the instance has at least one group. Choosing a group and a permission (read only or read and write) creates a grant. The dialog lists the groups an item is shared with, with how many members have accepted or still have to answer, and lets the owner revoke a group.

Sharing works for every shareable type. Sharing a project or area also covers the tasks, notes and projects inside it, the same as sharing with one person.

### Invitations

Every member gets a `share_invitation` notification and a pending invitation, exactly like a direct share. Nothing is visible until they accept. Declining removes only that member's access.

A member who already holds accepted access at that level or higher (from a direct share or another group) is accepted silently. A grant that would raise their level asks again.

### Membership changes are live

- **Adding a member** invites them to everything already shared with the group.
- **Removing a member** removes only the access that came through the group. A direct share or another group's grant keeps working.
- **Deleting a group** removes every grant it made. The shared items themselves are untouched.
- **Projects added to a shared area or goal** are mirrored to members with the container grant's status, so a member who has not accepted the area yet does not see the new project early.

### Overlap rules

- Access is the highest level across a direct share and every group grant.
- Revoking one source never removes another.
- Share counts count distinct people, not rows.
- The owner of an item is never given rows for it, even if they belong to the group.
- Sharing the same item with the same group again only raises the level.

---

## Data Model

| Table | Purpose |
|-------|---------|
| `user_groups` | The group: `uid`, unique `name`, optional `description`, `created_by_user_id` (set null when that admin is erased) |
| `user_group_members` | Membership, unique on `(group_id, user_id)` |
| `group_shares` | One grant of a resource to a group, unique on `(group_id, resource_type, resource_uid)` |
| `group_permissions` | The per-member rows a grant produces, with the same meaning as `permissions` plus a non-null `group_share_id` |

Group access is materialized per member into its own table rather than into `permissions`. On SQLite `permissions` is unique on `(user_id, resource_type, resource_uid)`, so a direct share and a group grant on the same item could not both exist there, and `applyPerms` deliberately merges sources into one row. Keeping them apart means revoking one source cannot remove the other.

A group grant on a project writes one `direct` row for the project and `inherited` rows for its tasks and notes. Area and goal grants also write `inherited` rows for the projects underneath.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/groups` | Any user. `{ groups: [{ uid, name, member_count }] }`. Exposes no member data. |
| GET, POST | `/api/admin/groups` | Admin. List with counts, create. Duplicate names (any case) return 409. |
| GET, PATCH, DELETE | `/api/admin/groups/:uid` | Admin. Detail includes members and what the group is shared with. |
| POST | `/api/admin/groups/:uid/members` | Admin. `{ user_ids: [] }` returns `{ added, already_members }`. |
| DELETE | `/api/admin/groups/:uid/members/:userId` | Admin. 404 if not a member. |
| POST | `/api/shares` | Send `target_group_uid` instead of `target_user_email`. Exactly one of the two. |
| DELETE | `/api/shares` | Send `target_group_uid` instead of `target_user_id`. |
| GET | `/api/shares?resource_type=&resource_uid=` | Adds `group_shares` with counts and no member identities. |

Group invitations use string ids such as `g12` in `GET /api/shares/invitations` and in the notification's `invitationId`, because group and direct rows live in different tables and their ids overlap. The existing accept and decline routes take either form. Group invitations also carry `via_group: { uid, name }`.

---

## Reading access in code

Two sources now grant access, so code that asks "who can see this" must not query `Permission` alone. Use `backend/services/permissionSources.js`:

- `findAccepted(where, attributes)` and `countAccepted(where)` union both tables
- `findAcceptedAccessLevel(userId, type, uid)` returns the highest level across sources
- `countDistinctUsersByResource(type, uids)` counts people, not rows

Anything that goes through `permissionsService.getAccess`, `getSharedUidsForUser` or `ownershipOrPermissionWhere` already handles groups.

---

## **Related Documentation**

- [User Management](08-user-management.md) - Roles, admin, and resource permissions
- [Projects](06-projects.md) - Project sharing and permissions
- [Database & Migrations](database.md) - Data model details

**Technical Implementation Files:**

- Groups module: `/backend/modules/groups/`
- Group grants and membership: `/backend/services/groupSharing.js`
- Reading shared access: `/backend/services/permissionSources.js`
- Container mirroring: `/backend/services/containerShareSync.js`
- Admin page: `/frontend/components/Admin/AdminUsersPage.tsx` (tab shell), `/frontend/components/Admin/AdminGroupsPanel.tsx` (Groups tab)
- Share dialog: `/frontend/components/Shared/ShareModal.tsx`
