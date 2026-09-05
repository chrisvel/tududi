# Changelog

Notable changes to tududi. Versions match the git tags and the
`chrisvel/tududi` image tags (without the `v`).

## Unreleased

### Security

- Sharing a project, task, or note now creates an invitation that the
  recipient accepts from a notification; nothing appears in their workspace
  before that. The share endpoint answers the same way for known and unknown
  emails (#1472).
- `GET /api/users` is admin only; the share dialog takes an exact email
  (#1472).
- Avatars are visible to their owner and collaborators only; Telegram
  polling status is per user (#1472).
- Passwords must be at least 8 characters. Password logins are recorded in
  the auth audit log, and login is rate limited per email address as well as
  per IP (#1474).
- CalDAV Basic auth is rate limited and no longer fails with 500 for accounts
  without a password. CalDAV endpoints are off unless `FF_ENABLE_CALDAV=true`
  (#1475).

### Added

- Self-service password reset by email (`/forgot-password`) (#1474).
- Self-service account deletion (Profile > Security), with a complete
  erasure shared with admin deletion: attachments, backups, contacts,
  calendars, identities, audit log, sessions (#1475).
- `POST /api/resend-verification` for unverified accounts (#1475).
- `TUDUDI_HOSTED_MODE` for public multi-user instances: no implicit first
  admin, no bootstrap role assignment, SSO auto-provisioning respects the
  registration toggle, and the server refuses to start half-configured
  (#1473, #1476).
- Several app processes can share one PostgreSQL database: schema and
  migrations run under an advisory lock, scheduled jobs and Telegram polling
  elect one runner, and rate limits are stored in the database (#1476).
- `GET /api/health/ready` reports database reachability and pending
  migrations; `GET /api/health` stays a liveness probe.
- Structured JSON logging (pino) with `LOG_LEVEL` and `LOG_FORMAT`;
  health probes are not logged.
- Docker images are published by CI on release tags
  (`.github/workflows/docker-publish.yml`).

### Fixed

- The entrypoint no longer resets the bootstrap admin's password on every
  start; pass `--update-password` to `scripts/user-create.js` to do that
  (#1473).
- The nightly token cleanup job had been failing on a wrong require path
  (#1476).
- Owners can share tasks and notes directly, not only projects (#1472).

## 1.4.2

See the GitHub release notes for this and earlier versions.
