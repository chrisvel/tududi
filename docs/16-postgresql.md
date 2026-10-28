# Database (PostgreSQL)

[← Back to Index](../CLAUDE.md)

---

## Overview

tududi stores its data in PostgreSQL. It is the only supported engine from 2.0; SQLite support was removed. Coming from a 1.x install on SQLite, read [30-moving-to-postgres.md](30-moving-to-postgres.md) first.

Requirements: PostgreSQL 14 or newer, an existing database (empty is fine) and a role that can create tables in it.

---

## Configuration

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgres://user:password@host:5432/dbname`. Required, unless the discrete `DB_*` variables below are set instead. `?sslmode=require` enables TLS. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Connection parts. Each one overrides the matching part of `DATABASE_URL` when both are set. |
| `DB_SSL` | `true` to connect over TLS. |
| `DB_SSL_REJECT_UNAUTHORIZED` | Default `true` (the server certificate is verified). Set `false` only for self-signed certificates on a private network. |
| `sslrootcert`, `sslcert`, `sslkey` | `DATABASE_URL` parameters with file paths to the CA, client certificate and key, for client certificate (mTLS) auth: `?sslmode=verify-full&sslrootcert=/certs/ca.crt&sslcert=/certs/tls.crt&sslkey=/certs/tls.key`. |
| `DB_POOL_MAX` | Connections kept per app process. Default 10. |

tududi refuses to start when neither `DATABASE_URL` nor `DB_HOST` is set. The settings are resolved once at startup in `backend/config/database-settings.js`, and every consumer (the app, sequelize-cli, the `db:*` scripts, the MCP stdio server) reads the same settings. The MCP server started with `npm run mcp:start` therefore needs the same variables in its environment.

Passwords with special characters must be URL-encoded inside `DATABASE_URL` (`@` becomes `%40`), or passed through `DB_PASSWORD` instead.

---

## First Start

`backend/cmd/start.sh` (the Docker entrypoint's final step) runs `scripts/db-prepare.js` before migrations:

1. Connects and authenticates.
2. If the `users` table is missing, the database is treated as new: `sequelize.sync()` creates every table, index and foreign key from the models, and all existing migration files are recorded in `SequelizeMeta` as already applied (the *baseline*). The default `registration_enabled=false` setting is seeded.
3. `sequelize-cli db:migrate` then runs whatever migrations were added after the baseline. On a brand-new install this prints "No migrations were executed".
4. If `TUDUDI_USER_EMAIL` and `TUDUDI_USER_PASSWORD` are set, that user is created (if missing) and made admin. An existing user's password is left unchanged.

The models are the source of truth for a fresh schema. The 1.x migrations live in `backend/migrations/archive/` and never run. On an existing database step 2 is skipped and only pending migrations run.

Before step 2, `db-prepare` runs two checks:

- **Leftover SQLite data.** If the old SQLite file (`/app/db/production.sqlite3`, or the path in a leftover `DB_FILE`) is still there and holds data, startup stops and points to [30-moving-to-postgres.md](30-moving-to-postgres.md). Set `TUDUDI_ALLOW_DIALECT_SWITCH=true` once the data has been imported, or remove the file.
- **Final 1.x release.** An existing database that has not run every 1.x migration is refused with "This database was last used by an older tududi 1.x release". Start the final 1.x image once against it, then 2.0.

---

## Docker Compose

The repo's `docker-compose.yml` is the complete stack: a `postgres:16-alpine` service (`db`) with a health check and a `tududi_pgdata` volume, and tududi wired to it through `DATABASE_URL`. An optional `backup` service, commented out by default, dumps the database every night (see [backups.md](backups.md)).

```bash
mkdir tududi && cd tududi
cp /path/to/tududi/docker-compose.yml .
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

Later boots print `Existing database detected, schema left to migrations` instead. No `/app/db` volume is needed; only `/app/uploads` must persist (and `/app/backups`, to keep backups made from Backup & Restore (`/backup`)).

For an external database (managed PostgreSQL, another host) drop the `db` service and set `DATABASE_URL` in `.env` directly.

---

For a public multi-user instance see `docs/examples/docker-compose.hosted.yml`
and [docs/17-hosted-mode.md](17-hosted-mode.md).

## Upgrading

1. Take a backup (`pg_dump`, see below). Upgrading from 1.x to 2.0: be on the final 1.x release first.
2. Pull the new image and recreate the container. `start.sh` runs pending migrations before the server accepts requests; the container refuses to start if a migration fails, and the log shows which one.
3. If a migration fails, restore the dump, report the migration, and stay on the previous image.

New migrations are written for PostgreSQL (see [database.md](database.md#writing-migrations)) and CI runs them on every pull request.

---

## Backups

tududi does not copy the database by itself. Use the `backup` service in `docker-compose.yml`, `scripts/pg-backup.sh` from cron, or the standard PostgreSQL tools (details in [backups.md](backups.md)):

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
- **Timezone**: the app sets the session timezone to UTC and stores every timestamp as `timestamptz`, so date bucketing does not depend on the server's timezone setting.
- **JSON columns** are stored as `json`. They can be moved to `jsonb` in a future migration if query patterns need it.
- **Case-insensitive search** uses `ILIKE`. A `pg_trgm` index on `tasks.name`, `notes.title` and `projects.name` speeds it up on large datasets; it is not created by default.
- **Locking**: `SELECT ... FOR UPDATE` in the permission and action services is honoured, so concurrent writers on the same row wait for each other rather than racing.

---

## Running More Than One Process

PostgreSQL is what makes a second app process possible. tududi coordinates
through the database so that several containers can share it safely:

- **Schema and migrations.** The entrypoint runs `db-prepare` and
  `sequelize-cli db:migrate` under a PostgreSQL advisory lock
  (`scripts/with-db-lock.js`), so containers booting together wait for each
  other instead of both creating the schema.
- **Scheduled jobs.** Every tick of the task scheduler (summaries, due and
  deferred task notifications) and of the CalDAV sync takes a per-job
  advisory lock; whichever process gets it runs that tick, the others skip
  it. Duplicate notifications cannot happen.
- **Telegram polling.** Bot update offsets live in memory, so one process
  holds a long-lived leader lock and polls; the others retry every minute
  and take over if it goes away. Bots are polled in parallel batches
  (`TELEGRAM_POLL_CONCURRENCY`, default 10).
- **Rate limits.** Hit counters are kept in the `rate_limits` table instead
  of per-process memory, so limits are the same however many processes
  serve requests and survive restarts. Expired rows are swept nightly.

Nothing needs configuring for this. You can still pin the background work to one container with
`DISABLE_SCHEDULER=true` and `DISABLE_TELEGRAM=true` on the others, which
keeps a scheduler crash from ever affecting HTTP traffic.

With `TUDUDI_HOSTED_MODE=true` the server refuses to start unless
`TUDUDI_SESSION_SECRET`, `TUDUDI_TRUST_PROXY`, `TUDUDI_ALLOWED_ORIGINS`,
public `FRONTEND_URL`/`BACKEND_URL`, `ENABLE_EMAIL` with an SMTP host, and
`DATABASE_URL` are all set, and prints exactly what is missing.

## Search Indexes

Search runs `LOWER(column) LIKE '%term%'`. tududi creates
trigram GIN indexes (`pg_trgm`) over those expressions on tasks, notes and
projects, plus an index on session expiry, both for fresh databases
(`db-prepare`) and existing ones (migration `20260907000007`). Nothing to
configure; `pg_trgm` ships with PostgreSQL.

## Health Checks and Logs

- `GET /api/health` answers 200 as soon as the process is up. The Docker
  `HEALTHCHECK` uses it.
- `GET /api/health/ready` also runs a query and lists migration files that
  are not recorded in `SequelizeMeta`. It answers 200 with `status: ok`,
  200 with `status: degraded` when migrations are pending, and 503 when
  the database does not answer. Point load balancers and uptime monitors
  at this one. Both are exempt from rate limiting and are not logged.
- Logs are JSON lines on stdout (one object per request with method, URL,
  status and duration; errors carry the stack). `LOG_LEVEL` and
  `LOG_FORMAT=pretty` adjust them; see `backend/.env.example`.

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| `DATABASE_URL must use the postgres:// scheme` | The URL starts with something else; only `postgres://` and `postgresql://` are accepted. |
| tududi refuses to start: no database configured | Set `DATABASE_URL` (or `DB_HOST` and the other `DB_*` variables). SQLite is no longer supported. |
| `password authentication failed` | Wrong credentials, or a special character in the password was not URL-encoded; use `DB_PASSWORD`. |
| `self signed certificate` | Set `DB_SSL_REJECT_UNAUTHORIZED=false` for self-signed servers, or install the CA. |
| `Existing database detected` but the app reports missing tables | The database has a `users` table from another application. Point tududi at its own database. |
| Migration failed on start | The container exits with the failing migration in the log. Restore the last dump, keep the previous image, report the migration. |
| Container starts but `/api/health` never responds | Check `docker compose logs tududi`; a database that is not reachable shows a connection error from `db-prepare.js` before anything else. |
| Startup stops: a tududi 1.x SQLite database was found | The 1.x SQLite file (in Docker `/app/db/production.sqlite3`, or a leftover `DB_FILE`) still holds data. Move it with [30-moving-to-postgres.md](30-moving-to-postgres.md), then set `TUDUDI_ALLOW_DIALECT_SWITCH=true` or remove the file. 2.0 does not read it. |
| Startup stops: last used by an older tududi 1.x release | The database was last used by an older 1.x release. Run the final 1.x image once against it, then start 2.0. |

---

## Development and Tests

```bash
docker compose -f docker-compose.dev.yml up -d db
# or: docker run -d --name tududi-pg -p 5432:5432 \
#   -e POSTGRES_USER=tududi -e POSTGRES_PASSWORD=tududi -e POSTGRES_DB=tududi_dev \
#   postgres:16-alpine

# App in development mode
DATABASE_URL=postgres://tududi:tududi@localhost:5432/tududi_dev npm run backend:dev

# Backend test suite (one database per Jest worker is created automatically)
DATABASE_URL=postgres://tududi:tududi@localhost:5432/tududi_test npm run backend:test
```

Never run two PostgreSQL test invocations at the same time against the same server: they share the per-worker databases and recreate each other's tables. See [testing.md](testing.md#test-database).

---

## Related Documentation

- [Database & Migrations](database.md)
- [Backups & Restoration](backups.md)
- [Testing](testing.md)
- [Architecture Overview](architecture.md)
