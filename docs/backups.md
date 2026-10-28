# Backups & Restoration

[← Back to Index](../CLAUDE.md)

---

## Overview

tududi keeps its data in two places: the PostgreSQL database and the uploads folder (`TUDUDI_UPLOAD_PATH`, `/app/uploads` in Docker). Both need a backup. tududi does not copy the database by itself, so pick one of the options below and run it on a schedule.

There are two kinds of backup:

- **Database dumps** (`pg_dump`): the whole instance, every account and table. Use these for disaster recovery and before upgrades.
- **Per-user JSON exports** (the Backup & Restore page, `/backup`): one account's data, or the whole instance when an admin exports it. Use these to move data between instances. They are also how a 1.x SQLite install moves to 2.0 (see [30-moving-to-postgres.md](30-moving-to-postgres.md)).

---

## Database Dumps

### The compose `backup` service

The root `docker-compose.yml` has an optional `backup` service, commented out by default. Uncomment it and it runs `pg_dump` against the `db` service every night, writes gzipped dumps to `./backups/db`, and deletes dumps older than `BACKUP_KEEP_DAYS` (default 7).

```bash
# after uncommenting the service
docker compose up -d backup
ls -lh backups/db
```

The dumps sit on the same host as the database, so copy `./backups/db` somewhere else (restic, rclone, object storage).

### `scripts/pg-backup.sh` from cron

Without the compose service, run the script from cron on the host. It runs `pg_dump --no-owner --no-acl` against `DATABASE_URL`, gzips it to `<dir>/tududi-<timestamp>.sql.gz`, and prunes dumps older than `BACKUP_KEEP_DAYS` (default 14).

```bash
# Nightly at 03:00
0 3 * * * DATABASE_URL=postgres://tududi:secret@localhost:5432/tududi /opt/tududi/scripts/pg-backup.sh /var/backups/tududi
```

### By hand

```bash
# Against any server
pg_dump "$DATABASE_URL" | gzip > tududi-$(date +%F).sql.gz

# With the compose stack
docker compose exec db pg_dump -U tududi tududi | gzip > tududi-$(date +%F).sql.gz
```

Take one before every upgrade. Pending migrations run on start, and a dump is the only way back if one fails.

---

## Restoring a Dump

Restore into an **empty** database. Restoring over a live schema mixes old and new rows.

### Docker Compose

```bash
# 1. Stop tududi, keep the database running
docker compose stop tududi

# 2. Drop and recreate the database
docker compose exec db dropdb -U tududi tududi
docker compose exec db createdb -U tududi tududi

# 3. Load the dump
gunzip -c backups/db/tududi-2026-10-28.sql.gz | docker compose exec -T db psql -U tududi tududi

# 4. Start tududi again
docker compose start tududi
docker compose logs -f tududi
```

### Any server

```bash
dropdb tududi && createdb tududi
gunzip -c tududi-2026-10-28.sql.gz | psql "$DATABASE_URL"
```

Dumps made with `pg_dump -Fc` (custom format) are restored with `pg_restore --no-owner -d "$DATABASE_URL" tududi.dump` instead.

### Development

```bash
# Stop the dev servers first
dropdb -h localhost -U tududi tududi_dev
createdb -h localhost -U tududi tududi_dev
gunzip -c tududi-2026-10-28.sql.gz | psql postgres://tududi:tududi@localhost:5432/tududi_dev
```

A dump from a newer release than the code you start is not supported: restore it with the release that made it.

---

## Per-User Backup Exports

The in-app export (the Backup & Restore page, `/backup`) writes each user's `.json.gz` under `TUDUDI_BACKUP_PATH` (default `backend/backups`, `/app/backups` in the Docker image, declared as a volume). Mount it like `uploads`, or those exports disappear when the container is recreated.

On a self-hosted instance an admin can export the whole instance: every account (with its password hash), roles, groups and shares, on top of the admin's own data. Import it as admin in merge mode.

### Export Format

Exports are JSON (`format: 2`) with every relation expressed by uid (`area_uid`, `project_uid`, `parent_task_uid`, ...), attachment files embedded as base64, and goals and people included alongside areas, projects, tasks, tags, notes, inbox items and views. Because references are by uid, a backup restores cleanly on a different instance and can never point at another user's rows. If a uid is already taken by another account on the same instance, the imported row gets a fresh uid and its references follow. The exporting user's own contact card maps onto the importing user's own card instead of becoming a duplicate. Format 1 backups (numeric ids only) still import; their references resolve only among the importing user's rows.

Not exported: API tokens, two-factor sign-in, SSO links, CalDAV sync state, push subscriptions, sessions, and logs. [30-moving-to-postgres.md](30-moving-to-postgres.md) has the full list of what comes across.

---

## Best Practices

### Before Major Changes

Take a dump before upgrading tududi, running manual migrations or bulk data operations.

### Keep a Copy Off the Host

A dump on the same disk as the database does not survive that disk. Copy dumps and the uploads folder elsewhere on a schedule, and keep more than one generation.

### Back Up Uploads Too

Attachments, avatars and project images are plain files under `TUDUDI_UPLOAD_PATH`. A database restore without them leaves broken links.

```bash
tar czf tududi-uploads-$(date +%F).tar.gz uploads/
```

### Test a Restore

Now and then, restore a dump into a scratch database and look at it:

```bash
createdb tududi_restore_test
gunzip -c tududi-2026-10-28.sql.gz | psql tududi_restore_test
psql tududi_restore_test -c 'SELECT COUNT(*) FROM tasks;'
dropdb tududi_restore_test
```

---

## Troubleshooting

### Restore Fails With "relation already exists"

The target database is not empty. Drop and recreate it, then load the dump again.

### `pg_dump: server version mismatch`

The `pg_dump` client is older than the server. Use the one inside the `db` container (`docker compose exec db pg_dump ...`) or install a matching client.

### Startup Stops After a Restore

A dump from an older 1.x release restored under 2.0 is refused with "This database was last used by an older tududi 1.x release". Start the final 1.x image against it once, then 2.0.

---

## Related Documentation

- [Database (PostgreSQL)](16-postgresql.md) - Connection, tuning and upgrades
- [Moving from SQLite (1.x) to 2.0](30-moving-to-postgres.md) - Export on 1.x, import on 2.0
- [Database & Migrations](database.md) - Schema changes and migrations
- [Development Workflow](development-workflow.md) - Database management commands
