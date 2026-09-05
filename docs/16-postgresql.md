# PostgreSQL Deployment

[← Back to Index](../CLAUDE.md)

---

## Overview

Tududi stores its data in a single SQLite file by default, which is the right choice for a personal instance. For a hosted or multi-user deployment you can point the same application at PostgreSQL instead. Nothing changes for SQLite users: PostgreSQL is opt-in through environment variables, and both engines are covered by the test suite and CI.

Requirements: PostgreSQL 14 or newer, an existing database (empty is fine) and a role that can create tables in it.

---

## Configuration

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgres://user:password@host:5432/dbname`. Setting it selects PostgreSQL. `?sslmode=require` enables TLS. |
| `DB_DIALECT` | `postgres` when you prefer the discrete variables below instead of a URL. Default `sqlite`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Connection parts. Each one overrides the matching part of `DATABASE_URL` when both are set. |
| `DB_SSL` | `true` to connect over TLS. |
| `DB_SSL_REJECT_UNAUTHORIZED` | Default `true` (the server certificate is verified). Set `false` only for self-signed certificates on a private network. |
| `DB_POOL_MAX` | Connections kept per app process. Default 10. |
| `DB_FILE` | SQLite only. Ignored when PostgreSQL is selected. |

The engine is resolved once at startup in `backend/config/database-settings.js`, and every consumer (the app, sequelize-cli, the `db:*` scripts, the MCP stdio server) reads the same settings. The MCP server started with `npm run mcp:start` therefore needs the same variables in its environment.

Passwords with special characters must be URL-encoded inside `DATABASE_URL` (`@` becomes `%40`), or passed through `DB_PASSWORD` instead.

---

## First Start

`backend/cmd/start.sh` (the Docker entrypoint's final step) runs `scripts/db-prepare.js` before migrations:

1. Connects and authenticates.
2. If the `users` table is missing, the database is treated as new: `sequelize.sync()` creates every table, index and foreign key from the models, and all existing migration files are recorded in `SequelizeMeta` as already applied (the *baseline*). The default `registration_enabled=false` setting is seeded.
3. `sequelize-cli db:migrate` then runs whatever migrations were added after the baseline. On a brand-new install this prints "No migrations were executed".
4. If `TUDUDI_USER_EMAIL` and `TUDUDI_USER_PASSWORD` are set, that user is created or updated.

The historical migrations contain SQLite-only SQL and are never replayed on PostgreSQL; the models are the source of truth for a fresh PostgreSQL schema. On an existing database, step 2 is skipped and only pending migrations run, so restarts and upgrades behave exactly as with SQLite.

There is no built-in transfer of an existing SQLite database into PostgreSQL. Per-user JSON export and import (Settings, Backups) works across engines and can be used to move a single account.

---

## Docker Compose

A complete stack lives in [examples/docker-compose.postgres.yml](examples/docker-compose.postgres.yml): a `postgres:16-alpine` service with a health check, and tududi wired to it through `DATABASE_URL`.

```bash
mkdir tududi && cd tududi
cp /path/to/tududi/docs/examples/docker-compose.postgres.yml docker-compose.yml
cp /path/to/tududi/.env.example .env      # set TUDUDI_* values and DB_PASSWORD
docker compose up -d
docker compose logs -f tududi             # watch the first boot
```

The first boot log should contain:

```
Preparing postgres database...
Empty database detected, creating schema from models...
✅ Schema created and N migration(s) recorded as baseline
No migrations were executed, database schema was already up to date.
User created successfully
Server running on port 3002
```

Later boots print `Existing database detected, schema left to migrations` instead. No `/app/db` volume is needed; only `/app/uploads` must persist.

For an external database (managed PostgreSQL, another host) drop the `db` service and set `DATABASE_URL` in `.env` directly.

---

## Upgrading

1. Take a backup (`pg_dump`, see below).
2. Pull the new image and recreate the container. `start.sh` runs pending migrations before the server accepts requests; the container refuses to start if a migration fails, and the log shows which one.
3. If a migration fails, restore the dump, report the migration, and stay on the previous image.

New migrations are written to be dialect-safe (see [database.md](database.md#writing-dialect-safe-migrations)) and CI runs them against PostgreSQL on every pull request.

---

## Backups

The SQLite file backups described in [backups.md](backups.md) do not apply. Use the standard PostgreSQL tools:

```bash
# Nightly dump (cron), keep 14 days
0 3 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/tududi/tududi-$(date +\%F).sql.gz && find /var/backups/tududi -mtime +14 -delete

# With the compose example
docker compose exec db pg_dump -U tududi tududi | gzip > tududi-$(date +%F).sql.gz

# Restore into an empty database
gunzip -c tududi-2026-09-05.sql.gz | psql "$DATABASE_URL"
```

Uploads live on disk (`TUDUDI_UPLOAD_PATH`) and need their own backup.

---

## Sizing and Tuning

- **Connections**: each app process holds up to `DB_POOL_MAX` connections (default 10). Keep `max_connections` on the server above `DB_POOL_MAX` times the number of app processes, plus headroom for `psql`, backups and the MCP server.
- **Timezone**: the app sets the session timezone to UTC and stores every timestamp as `timestamptz`, so date bucketing matches SQLite regardless of the server's timezone setting.
- **JSON columns** are stored as `json`. They can be moved to `jsonb` in a future migration if query patterns need it.
- **Case-insensitive search** uses `ILIKE`. A `pg_trgm` index on `tasks.name`, `notes.title` and `projects.name` speeds it up on large datasets; it is not created by default.
- **Locking**: `SELECT ... FOR UPDATE` in the permission and action services is honoured by PostgreSQL (SQLite ignores it), so concurrent writers on the same row wait for each other rather than racing.

---

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| `DATABASE_URL must use the postgres:// scheme` | The URL starts with something else; only `postgres://` and `postgresql://` are accepted. |
| `Unsupported DB_DIALECT` | Only `sqlite` and `postgres` are supported. |
| `password authentication failed` | Wrong credentials, or a special character in the password was not URL-encoded; use `DB_PASSWORD`. |
| `self signed certificate` | Set `DB_SSL_REJECT_UNAUTHORIZED=false` for self-signed servers, or install the CA. |
| `Existing database detected` but the app reports missing tables | The database has a `users` table from another application. Point tududi at its own database. |
| Migration failed on start | The container exits with the failing migration in the log. Restore the last dump, keep the previous image, report the migration. |
| Container starts but `/api/health` never responds | Check `docker compose logs tududi`; a database that is not reachable shows a connection error from `db-prepare.js` before anything else. |

---

## Development and Tests Against PostgreSQL

```bash
docker run -d --name tududi-pg -p 5432:5432 \
  -e POSTGRES_USER=tududi -e POSTGRES_PASSWORD=tududi -e POSTGRES_DB=tududi_dev \
  postgres:16-alpine

# App in development mode
DATABASE_URL=postgres://tududi:tududi@localhost:5432/tududi_dev npm run backend:dev

# Backend test suite (one database per Jest worker is created automatically)
DATABASE_URL=postgres://tududi:tududi@localhost:5432/tududi_test npm run backend:test:pg
```

Never run two PostgreSQL test invocations at the same time against the same server: they share the per-worker databases and recreate each other's tables. See [testing.md](testing.md#test-database).

---

## Related Documentation

- [Database & Migrations](database.md)
- [Backups & Restoration](backups.md)
- [Testing](testing.md)
- [Architecture Overview](architecture.md)
