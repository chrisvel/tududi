# User Management - Behavior Rules

This document explains how user management works in tududi from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/users/`, `/backend/modules/auth/`, and `/backend/modules/admin/`.

---

## **Registration & Onboarding**

### Registration Flow

1. **Registration is controlled by admins**
    - By default, registration is disabled
    - Admins toggle registration on/off through `POST /api/admin/toggle-registration` (the Access page no longer has a switch for it)
    - When disabled, only admins can create new user accounts

2. **Email verification is required**
    - When a user registers, they receive a verification email
    - The email contains a unique link that expires in 24 hours (configurable)
    - Users cannot log in until they verify their email address
    - If the verification email cannot be sent (email service disabled or
      failing), registration answers `503` and no account is kept, so the
      user can simply try again later; admins can still create accounts
      directly
    - An unverified user can ask for a new link from the login page
      (`POST /api/resend-verification`); the response is the same whether or
      not the address belongs to an unverified account

3. **The first user becomes an admin automatically**
    - When no admin users exist in the system, the first user to register becomes an admin
    - This ensures someone can manage the system after initial setup
    - All subsequent users are created as regular users by default

4. **Registration validation rules:**
    - Email must be valid format and unique
    - Password must be at least 8 characters long
    - Email is automatically normalized (trimmed and lowercased)

---

## **Authentication**

### Login

5. **Users log in with email and password**
    - Email verification must be completed before login
    - Attempting to log in with an unverified email returns a specific error
    - Invalid credentials return a generic "Invalid credentials" error (security best practice)

6. **Session-based authentication**
    - After successful login, a session is created and stored in a cookie
    - Sessions persist until logout or session expiry
    - Users can be logged in across multiple devices/browsers simultaneously

7. **API token authentication**
    - Users can create personal API tokens for programmatic access
    - Tokens are prefixed with `tt_` and are 64 characters long
    - Tokens can have optional expiration dates
    - Multiple tokens can be active simultaneously
    - Tokens can be revoked or deleted at any time

### Logout

8. **Logout destroys the session**
    - The session is removed from the server
    - The user must log in again to access the system

---

## **User Roles & Permissions**

### Role System

9. **Three roles exist: Admin, User and Guest**
    - **Admin:** Full system access, manages accounts, roles and groups, and can do everything below
    - **User:** A regular member with their own data and everything shared with them
    - **Guest:** Works inside what is shared with them or assigned to them, and creates nothing of their own

    Each role has a set of **capabilities** that decide what an account may create:

    | Capability        | Meaning                                              | Admin | User | Guest |
    | ----------------- | ---------------------------------------------------- | ----- | ---- | ----- |
    | `create_people`   | Add people to the People list                        | yes   | yes  | no    |
    | `invite_members`  | Create accounts, send invitations or sign people up  | yes   | no   | no    |
    | `create_projects` | Create projects, areas and goals                     | yes   | yes  | no    |

    The role decides an account's capabilities. The add and edit user forms
    list what the chosen role allows, and have no way to change it for one
    account: changing what a role allows is meant for the Roles tab. The API
    still accepts a `capabilities` object on the admin user calls, stored as the
    difference from the role's defaults (an admin has none), but no page sets it.
    Reading what is shared with an account is never restricted by role.

10. **Role assignment:**
    - First user is automatically assigned admin role
    - Admins choose an account's role in the Users tab when adding or editing it
    - Every user has exactly one role record
    - Roles are created automatically when a user account is created (as `user`)
    - The role names and their defaults are fixed in code for now
    - The last remaining admin cannot be demoted (or deleted), even when two admins try to remove each other at the same moment
    - Editing an account in the admin page is all or nothing: if the role change is refused, the name, email or password in the same request are not saved
    - Setting a new password for an account signs it out everywhere (the admin changing their own password stays signed in)
    - Names and surnames must be text of at most 100 characters without control characters

11. **Admin capabilities:**
    - Create, update, and delete user accounts
    - Change roles and capabilities
    - Toggle registration on/off
    - Cannot delete their own account (prevents lockout)

11b. **How restrictions are enforced**
    - The server refuses the request with `403` when the account's capabilities
      do not allow it: `POST /api/people`, `POST /api/project`, `POST /api/areas`,
      `POST /api/goals` and the MCP `create_person` and `create_project` tools
    - The UI hides the sidebar "add" buttons for what an account cannot create.
      This only decides what to show, the server is the real gate
    - The current user (`GET /api/current_user` and the login response) carries
      `role` and the effective `capabilities` next to `is_admin`
    - `is_admin` stays the source of truth for admin, so anything that only
      reads or writes that flag keeps working

---

## **Resource Permissions**

### Sharing & Access Control

12. **Resources can be owned or shared**
    - Users own resources they create (projects, tasks, notes)
    - Owners have full read-write access to their resources
    - Resources can be shared with other users with specific access levels

13. **Access levels:**
    - **none:** No access
    - **ro (read-only):** Can view but not modify
    - **rw (read-write):** Can view and modify
    - **admin:** Full control (owners and admins have this level)

14. **Hierarchical permission inheritance:**
    - Tasks inherit permissions from their parent project
    - Notes inherit permissions from their parent project
    - If a user has access to a project, they have the same access to its tasks and notes

15. **Admins do not bypass permission checks**
    - Admins see only their own and shared resources, like any other user
    - System maintenance goes through the dedicated `/api/admin/*` endpoints
    - Only admins can list the user directory (`GET /api/users`)

15a. **Sharing requires the recipient's consent** - Sharing creates a pending invitation; the resource stays invisible to the
recipient until they accept (in-app notification or `GET /api/shares/invitations`) - `POST /api/shares` responds the same way whether or not the email belongs
to an account, so it cannot be used to discover who has signed up - Declining removes the invitation; the owner can re-invite later

---

## **User Profile Management**

### Profile Information

16. **Users can update their profile details:**
    - Name and surname (optional)
    - Email (must remain unique)
    - Password (requires current password confirmation)
    - Avatar image (upload/delete)

17. **User preferences stored in profile:**
    - **Appearance:** Light or dark theme
    - **Language:** One of 24 supported languages
    - **Timezone:** User's timezone for date/time display
    - **First day of week:** 0 (Sunday) to 6 (Saturday)

18. **Feature toggles:**
    - Task intelligence enabled/disabled
    - Auto-suggest next actions enabled/disabled
    - Pomodoro timer enabled/disabled
    - Productivity assistant enabled/disabled
    - Next task suggestion enabled/disabled

19. **Telegram integration settings:**
    - Bot token for personal Telegram bot
    - Chat ID for receiving messages
    - Allowed users list (comma-separated usernames/IDs)
    - Task summary enabled/disabled
    - Task summary frequency (daily, weekdays, weekly, hourly intervals)

20. **Notification preferences:**
    - Configure per notification type (due tasks, overdue tasks, due projects, etc.)
    - Configure per channel (in-app, email, push, Telegram)
    - Stored as JSON with defaults for new users

21. **UI settings:**
    - Today page settings (show/hide sections, metrics, suggestions)
    - Sidebar settings (pinned views order)
    - Project detail settings (show/hide metrics)
    - Keyboard shortcuts (custom mappings)

---

## **Password Management**

### Changing Password

22. **Password change requires current password**
    - User must provide their current password
    - New password must be at least 8 characters
    - Prevents unauthorized password changes if session is compromised

22a. **Forgotten passwords are reset by email**
    - `POST /api/forgot-password` always answers the same way, so it cannot
      be used to find out whether an address has an account
    - The link (`/reset-password?token=...`) is emailed; only a SHA-256 hash
      of the token is stored, and it expires after
      `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES` (default 60)
    - `POST /api/reset-password` sets the new password, clears the token,
      marks the email verified, and signs the user out of every other session
    - Accounts created through SSO with no password can use the same flow to
      set one
    - Login and reset requests are rate limited per email address as well as
      per IP (`RATE_LIMIT_AUTH_EMAIL_MAX`, default 10 per 15 minutes), and
      password logins (success and failure) are written to `auth_audit_log`
    - Only failed logins count towards the login limits, and login has its own
      counters separate from registration and password reset
    - Changing the password or deleting the account is limited per user
      (`RATE_LIMIT_PASSWORD_CONFIRM_MAX`, default 10 per 15 minutes), and
      repeated invalid API tokens from one IP are throttled
      (`RATE_LIMIT_BEARER_FAILURE_MAX`, default 50 per 15 minutes)
    - Looking at and using a sign-in link for a member without an email has
      its own limit per IP (`RATE_LIMIT_SIGN_IN_LINK_MAX`, default 30 per 15
      minutes), separate from login, registration and password reset, so a
      household can sign in several devices from one network

23. **Password storage is secure**
    - Passwords are hashed using bcrypt (10 rounds)
    - Original passwords are never stored
    - Password field is virtual in the model (not persisted)
    - Only `password_digest` is stored in the database

---

## **Avatar Management**

### Upload & Delete

24. **Users can upload a profile avatar image**
    - Uploaded files are stored in `/uploads/avatars/`
    - Avatar URL is stored in user profile
    - Uploading a new avatar replaces the old one (old file is deleted)

25. **Deleting avatar:**
    - Removes the avatar file from the server
    - Sets avatar URL to null in the profile
    - User displays with default avatar after deletion

---

## **API Tokens (Personal Access Tokens)**

### Token Management

26. **Users can create multiple API tokens**
    - Each token has a name/label for identification
    - Tokens are displayed with a prefix (first 12 characters) for identification
    - Full token value is only shown once upon creation
    - Tokens are hashed before storage (bcrypt, 12 rounds)

27. **Token properties:**
    - **Name:** User-defined label for the token
    - **Token prefix:** First 12 characters for identification (e.g., `tt_ab12cd34`)
    - **Created at:** When the token was created
    - **Last used at:** When the token was last used for authentication
    - **Expires at:** Optional expiration date (null = never expires)
    - **Revoked at:** When the token was revoked (null = active)

28. **Token operations:**
    - **Create:** Generates new token, returns full value once
    - **List:** Shows all tokens with metadata (not the full value)
    - **Revoke:** Marks token as revoked (soft delete, keeps history)
    - **Delete:** Permanently removes token from database

29. **Token authentication:**
    - Tokens are used with `Authorization: Bearer tt_...` header
    - System finds tokens by prefix, then validates hash
    - Expired or revoked tokens are rejected
    - Last used timestamp is updated on successful authentication

30. **OAuth2 JWT authentication (resource server):**
    - When `OIDC_ENABLED=true`, Bearer tokens without the `tt_` prefix are treated as JWTs
    - Validated against the OIDC provider's JWKS endpoint (`OIDC_ISSUER_URL`)
    - The token's `sub` claim must match a linked OIDC identity in the database
    - Discovery metadata available at `/.well-known/oauth-protected-resource` (RFC 9728)

---

## **Admin User Management**

### Who becomes admin

29a. **Self-hosted (default):** the first user created on the instance is
    the owner and gets the admin role automatically.

29b. **Hosted (`TUDUDI_HOSTED_MODE=true`):** no user is made admin
    implicitly, and the bootstrap fallback of `POST /api/admin/set-admin-role`
    is disabled. The admin account comes from `TUDUDI_USER_EMAIL` and
    `TUDUDI_USER_PASSWORD`, which the entrypoint creates if missing and
    grants the admin role. An existing account's password is left unchanged;
    run `node scripts/user-create.js <email> <password> true --update-password`
    to reset it.

### User CRUD Operations

30. **Admins can create new users directly**
    - Bypasses the registration flow
    - Requires: an email, or a name when there is no email. Optional: surname, role (admin, user or guest), capabilities
    - **With a password:** the account is verified and can log in immediately,
      unless the admin turns on **Request email verification** in the form
      (`require_verification: true`). The account is then created unverified, a
      verification email is sent (same link and expiry as self-registration),
      and login is blocked until it is used. The response carries
      `verification_requested: true` and `email_sent`; if email is disabled the
      account is still kept and must be verified manually.
    - **Without a password (invite):** the account is created unverified with no
      password, and an email is sent with a set-password link (reuses the
      password-reset token; expiry `INVITE_TOKEN_EXPIRY_HOURS`, default 168).
      Using the link sets the password and verifies the email. The response
      carries `invited: true` and `email_sent`; if email is disabled the account
      is still kept and the admin sets a password via update.
    - **Without an email:** a member such as a child or another household
      member can be added with just a name. The email is optional and a blank
      one counts as none. The account has no password, and no
      invitation or verification email is sent, and a password without an email
      is refused (`400`), since there would be nothing to sign in with. It gets
      its own person, named after the account (`Member` if it has no name), so
      it can join groups, receive shares and be assigned tasks like anyone
      else. Any number of accounts can have no email, while emails that are set
      stay unique. Such a member signs in with a sign-in link that the account's
      creator or an admin makes (`POST /api/members/:id/sign-in-link`): valid
      24 hours, single use, session of 30 days, revoked with
      `DELETE /api/members/:id/sign-in-link`. See [People, Members and
      Roles](19-people-and-roles.md).
    - **From one of the admin's own contacts:** `person_uid` (the older name
      `linked_person_uid` still works) makes that contact the new account's own
      person. It keeps its uid, so tasks assigned to it stay assigned and there is
      no duplicate, its private notes are cleared, and nothing is created if any
      step fails. See [People, Members and Roles](19-people-and-roles.md)

30b. **Anyone with the `invite_members` capability can add members too**
    - `POST /api/members` takes the same fields as the admin call and is used by
      the People page. It is limited by the per-user resource limiter, since it can
      send email
    - Only an admin can create an admin (`403` otherwise) or set `capabilities`
      (`403` otherwise), so the capability cannot be used to hand out more than the
      caller has
    - An account records who created it (`users.created_by_user_id`). It is part of
      that account's workspace and of the ones it created. Erasing the creator
      leaves the accounts in place and forgets the link

31. **Admins can list all users**
    - Shows email (empty for a member added without one), name, surname, role, creation date
    - `account_status` says whether the account can sign in: `active` (has a password or signs in through SSO), `invited` (an invitation is waiting to be used) or `no_sign_in` (no password and no SSO, for example no email: they can sign in with a sign-in link)
    - Includes role and the effective capabilities of each account
    - `GET /api/admin/roles` lists the three roles with their default
      capabilities and how many accounts hold each

32. **Admins can update any user's details**
    - Can change: email, password, name, surname, role, capabilities
    - Email must remain unique across all users
    - An email can be added to a member that has none, or changed, but not taken away (a blank email leaves the current one alone)
    - Password change doesn't require current password (admin privilege)

33. **Admins can delete users**
    - Cannot delete their own account (prevents lockout)
    - Deletion is a full erasure (`services/accountErasureService.js`):
      tasks, subtasks, attachments and their files, notes, projects, areas,
      goals, tags, inbox items, views, notifications, API tokens, backups
      and their files, OIDC identities, CalDAV calendars and sync state,
      calendar tokens, contacts, the avatar file, permissions granted to
      or by the user, the auth audit log, sessions, and the role row
    - Other users' contact cards that were linked to the account keep
      their data but lose the link

33a. **Users can delete their own account** (`DELETE /api/profile`, Profile > Security)
    - Requires the current password, or the typed email address for accounts
      that have no password (SSO)
    - Runs the same erasure as admin deletion and ends the session
    - The last remaining administrator cannot delete their own account

34. **Admin bootstrapping:**
    - Every user gets a role row on creation, and the first user created on
      an instance becomes admin, so "no roles exist" is not a normal state
    - `POST /api/admin/set-admin-role` only falls back to bootstrap mode
      (any authenticated user may set roles) when the roles table is empty
    - After at least one admin exists, only admins can manage roles

---

## **Settings & Preferences**

### Today Page Settings

35. **Today page is highly customizable:**
    - Show/hide metrics panel
    - Show/hide productivity assistant
    - Show/hide next task suggestion
    - Show/hide AI suggestions section
    - Show/hide tasks due today
    - Show/hide completed tasks
    - Show/hide progress bar
    - Show/hide daily quote

36. **Settings are stored per user:**
    - Defaults are applied for new users
    - Changes are saved immediately
    - Settings sync across devices/sessions

### Sidebar Settings

37. **Sidebar view pinning:**
    - Users can pin saved views to the sidebar
    - Pinned views can be reordered
    - Order is stored in `sidebar_settings.pinnedViewsOrder` array

    **Sidebar sections and the "All entities" launcher:**
    - Profile > Sidebar shows a preview of the sidebar with a switch on every item: the top links (Inbox, Today, Upcoming, Calendar, All Tasks, Assigned to me, Everyone), the sections (Favorites, Projects, Areas, Goals, Notes, Tags, People, Habits, Views, Boards, Insights) and the Templates link, plus the Access link for admins
    - The links and the sections can each be reordered by dragging their handle (or with the keyboard: focus the handle, press Space, use the arrow keys, press Space again). Templates and Access stay at the bottom and cannot be moved
    - Switches and the order are applied when **Save Changes** is clicked, and take effect in the real sidebar straight away
    - The order is stored in `sidebar_settings.linkOrder` and `sidebar_settings.sectionOrder` (arrays of item ids). Ids the saved order does not know about are shown after the ones it does, so a newly added item never disappears
    - Visibility is stored in `sidebar_settings.visibleSections`; a missing key means the section is shown
    - The grid button in the sidebar footer (right of **+**) opens a launcher with every page as an icon tile, including sections hidden from the sidebar
    - The launcher splits the tiles into the same three parts as the sidebar (the top links, the sections, then Templates and Access), separated by space only, and each part follows your saved sidebar order
    - The sidebar can be dragged wider or narrower by its right edge, from 90% to 110% of the default width (double-click the edge to reset; the arrow keys, Home and End also work when it is focused)
    - The width is saved to the profile when the drag ends, as `sidebar_settings.widthPercent` (a number from 90 to 110, default 100)
    - The launcher leaves out pages whose feature is turned off (Calendar, Habits, Eisenhower, Kanban, Templates), shows Everyone only when the account has collaborators, and shows Access only to admins

### Task Summary Settings

38. **Telegram task summaries can be scheduled:**
    - Enable/disable toggle
    - Frequency options: daily, weekdays, weekly, 1h, 2h, 4h, 8h, 12h
    - Last run and next run timestamps are tracked
    - "Send now" option for immediate summary

---

## **User Lifecycle**

### Account Creation to Deletion

39. **User creation flow:**

    ```
    Registration → Email Verification → First Login → Profile Setup → Active User
    ```

    - Or: Admin creates user with a password → Active user (no verification needed), or, with Request email verification on → Verification email → Active user
    - Or: Admin creates user without a password → Invite email → user sets password → Active user

40. **User deletion flow:**
    ```
    Admin deletes user → Cascade delete resources → Remove permissions → Remove sessions
    ```

    - User cannot log in after deletion
    - All owned data is removed
    - Shared access is revoked

---

## **Security Considerations**

### Password Security

41. **Passwords are protected:**
    - Hashed with bcrypt (10 rounds for user passwords, 12 for tokens)
    - Never transmitted in API responses
    - Virtual field prevents accidental persistence

42. **Email normalization:**
    - Emails are trimmed and lowercased before storage
    - Prevents duplicate accounts with different casing

### Session Security

43. **Session management:**
    - Sessions are stored server-side
    - Session cookies are HTTP-only (prevents XSS)
    - Sessions expire after inactivity
    - Logout properly destroys sessions

### API Token Security

44. **Token security:**
    - Tokens are cryptographically random (32 bytes = 256 bits)
    - Tokens are prefixed (`tt_`) for easy identification
    - Tokens are hashed before storage (bcrypt, 12 rounds)
    - Expired and revoked tokens are rejected

---

## **Key Concepts**

### User Identity

A user account is identified by:

- **ID:** Internal database ID (integer)
- **UID:** External unique identifier (string, used in URLs)
- **Email:** Unique, normalized email address

### Role Record

Every user has exactly one role record that determines admin status. Created automatically when the user account is created.

### Permission Record

Grants access to a specific resource (project, task, note) with a specific access level (ro, rw). Multiple permission records enable sharing resources across users. Access that comes through a user group is stored separately, see [User Groups](18-user-groups.md).

### API Token

A personal access token that enables programmatic API access. Tokens are long-lived credentials that should be treated like passwords.

### Bootstrap Mode

Fallback for an instance whose `roles` table is empty (for example after a
manual data repair). While it is empty, any authenticated user may set admin
roles so the instance cannot lock itself out. Under normal operation the first
created user is already admin and this mode is never reachable.

---

## **Related Documentation**

- [Architecture Overview](architecture.md) - System architecture
- [Backend Patterns](backend-patterns.md) - Module structure
- [Database & Migrations](database.md) - Data model details
- [Projects](06-projects.md) - Project sharing and permissions

**Technical Implementation Files:**

- User model: `/backend/models/user.js`
- Role model: `/backend/models/role.js`
- Permission model: `/backend/models/permission.js`
- User service: `/backend/modules/users/service.js`
- Auth service: `/backend/modules/auth/service.js`
- Admin service: `/backend/modules/admin/service.js`
- Permissions service: `/backend/services/permissionsService.js`
- Registration service: `/backend/modules/auth/registrationService.js`
- API token service: `/backend/modules/users/apiTokenService.js`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-15
**Audience:** Developers, AI assistants, and end users
