# User Management - Behavior Rules

This document explains how user management works in tududi from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/users/`, `/backend/modules/auth/`, and `/backend/modules/admin/`.

---

## **Registration & Onboarding**

### Registration Flow

1. **Registration is controlled by admins**
   - By default, registration is disabled
   - Admins can toggle registration on/off via the Admin panel
   - When disabled, only admins can create new user accounts

2. **Email verification is required**
   - When a user registers, they receive a verification email
   - The email contains a unique link that expires in 24 hours (configurable)
   - Users cannot log in until they verify their email address
   - If email service is disabled, users must be verified manually by an admin

3. **The first user becomes an admin automatically**
   - When no admin users exist in the system, the first user to register becomes an admin
   - This ensures someone can manage the system after initial setup
   - All subsequent users are created as regular users by default

4. **Registration validation rules:**
   - Email must be valid format and unique
   - Password must be at least 6 characters long
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

9. **Two role types exist: Admin and User**
   - **Admin:** Full system access, can manage users, toggle registration, access admin panel
   - **User:** Standard access to their own data and shared resources

10. **Role assignment:**
    - First user is automatically assigned admin role
    - Admins can promote/demote other users to/from admin
    - Every user has exactly one role record
    - Roles are created automatically when a user account is created

11. **Admin capabilities:**
    - Create, update, and delete user accounts
    - Promote/demote users to/from admin role
    - Toggle registration on/off
    - Cannot delete their own account (prevents lockout)

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

15. **Admins bypass permission checks**
    - Users with admin role have admin-level access to all resources
    - This enables admins to help users with issues or perform system maintenance

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
    - New password must be at least 6 characters
    - Prevents unauthorized password changes if session is compromised

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

### User CRUD Operations

30. **Admins can create new users directly**
    - Bypasses registration flow and email verification
    - Created users can log in immediately
    - Requires: email, password
    - Optional: name, surname, role (admin or user)

31. **Admins can list all users**
    - Shows email, name, surname, role, creation date
    - Includes role information (admin or user)

32. **Admins can update any user's details**
    - Can change: email, password, name, surname, role
    - Email must remain unique across all users
    - Password change doesn't require current password (admin privilege)

33. **Admins can delete users**
    - Cannot delete their own account (prevents lockout)
    - Deleting a user also deletes their data:
      - Tasks are deleted (cascades to subtasks, attachments, etc.)
      - Projects are deleted (cascades to tasks within)
      - Notes are deleted
      - Permissions granted by/to the user are removed
      - API tokens are deleted
      - Shared resources are unshared

34. **Admin bootstrapping:**
    - When no admin roles exist, the system is in "bootstrap mode"
    - In bootstrap mode, any authenticated user can set admin roles
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
    - Or: Admin creates user → Active user (no verification needed)

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

Grants access to a specific resource (project, task, note) with a specific access level (ro, rw). Multiple permission records enable sharing resources across users.

### API Token

A personal access token that enables programmatic API access. Tokens are long-lived credentials that should be treated like passwords.

### Bootstrap Mode

Special state when no admin users exist. Allows the first authenticated user to set admin roles, preventing system lockout after initial setup.

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