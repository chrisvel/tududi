# Deploy

One image, configured only through environment variables, with state in two folders. Any host that can build a Dockerfile, mount a disk and terminate HTTPS can run it, and moving between hosts means moving those two folders plus the variables.

## Contract (same on every host)

| Item          | Value                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Image         | `ghcr.io/danialmasghati/life-to-day:${LTD_VERSION:-latest}`, built from the root `Dockerfile`. Local profile builds `life-to-day:local`. |
| Port          | `3002`, plain HTTP. HTTPS and the domain are the host's job (Caddy here, the platform on a PaaS).                                             |
| Config        | Environment variables only; the list is `deploy/.env.example`.                                                                                |
| State         | `/app/db` (SQLite `production.sqlite3`, WAL mode) and `/app/uploads`. Both need a persistent disk; nothing else has to survive a restart.     |
| Health        | `GET /api/health` (process up), `GET /api/health/ready` (database answers, no pending migrations).                                            |
| Replicas      | Exactly one. SQLite has one writer, and migrations run at start with no lock on SQLite.                                                       |
| Proxy         | `TUDUDI_TRUST_PROXY` = number of proxy hops in front of the app.                                                                              |
| Must not lose | `TUDUDI_SESSION_SECRET`: it signs sessions and decrypts stored secrets (calendar feed addresses, AI keys). Keep a copy in a password manager. |

Every start backs up the database first (`/app/db/db-backup-*.sqlite3`, made with `VACUUM INTO`, kept 4 per day and 1 per day for 7 days), then runs migrations.

## Moving to another host

1. Take a consistent database copy (`backup.sh` on the compose host; on a PaaS, restart the service and take the newest `/app/db/db-backup-*.sqlite3`).
2. Copy that file to the new host as `/app/db/production.sqlite3`, with no `-wal`/`-shm` beside it, and copy `/app/uploads`.
3. Set the same variables, with the same `TUDUDI_SESSION_SECRET`.
4. Start, check `/api/health/ready`, sign in, then move DNS.

## Target: VPS with compose + Caddy

| Path on the server                  | What it holds                                                            |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `deploy/.env`                       | Secrets and settings, from `.env.example`. `chmod 600`, never committed. |
| `deploy/data/db/production.sqlite3` | Live database (WAL mode; `-wal`/`-shm` sit beside it)                    |
| `deploy/data/uploads`               | Attachments and avatars                                                  |
| `deploy/data/backups/ltd-*.sqlite3` | Output of `backup.sh`, kept 14 days (`KEEP_DAYS`)                        |

### Local start (no public hostname required)

```bash
cd deploy
cp .env.example .env && chmod 600 .env
# Replace the two secret placeholders only in .env with:
#   openssl rand -base64 24  (TUDUDI_USER_PASSWORD)
#   openssl rand -hex 64     (TUDUDI_SESSION_SECRET)
mkdir -p data/db data/uploads data/backups
docker compose --profile local up -d --build
docker compose --profile local ps        # app must reach (healthy)
curl -fsS http://127.0.0.1:3002/api/health/ready
```

The example `.env` selects `docker-compose.yml:docker-compose.local.yml` through `COMPOSE_FILE`. This adds a build and a loopback-only port to the same `app` service, overrides the HTTPS-only settings for local HTTP and leaves Caddy off. Keep `LTD_DOMAIN=plan.example.com` for local use; no public certificate is requested. There is exactly one app container. Its fixed container name prevents scaling it beyond one replica. Never run a second compose project against these state folders.

The local URL is `http://127.0.0.1:3002`. The bootstrap email and password are in the ignored, mode-0600 `.env`; the password is not printed in documentation. The root compose file remains the upstream example.

### First production start

On the production host, set `COMPOSE_FILE=docker-compose.yml`, supply a real `LTD_DOMAIN`, matching HTTPS origins/`BASE_URL`, and a released `LTD_VERSION`. Ensure its A record points to the host and 80/443 TCP plus 443 UDP are available. Then:

```bash
cd deploy
mkdir -p data/db data/uploads data/backups
docker compose --profile production pull
docker compose --profile production up -d --scale app=1
curl -fsSI "https://${LTD_DOMAIN}/api/health/ready"
```

Require HTTP 200 and `Strict-Transport-Security`. Caddy uses a deferred `header >` to replace the app's HSTS header. The app exposes no production host port. Public HTTPS is **BLOCKED** until a hostname and host are supplied; `plan.example.com` is a placeholder.

### Backup

```bash
deploy/backup.sh                          # online .backup + integrity_check
deploy/restore-drill.sh                   # boots a throwaway copy on the newest backup
# Optional explicit empty target (retained for inspection):
deploy/restore-drill.sh /path/to/ltd-backup.sqlite3 /path/to/empty-folder
deploy/restic-backup.sh                   # local snapshot, then off-site backup
```

Production-host cron only: configure the server's cron daemon timezone to UTC. Install this daily **03:15 UTC** entry as a user that can run Docker. No cron is installed on the development Mac. `/etc/ltd/backup.env` is a host-only mode-0600 shell environment containing the restic/dead-man variables; do not commit it.

```cron
15 3 * * * /bin/bash -c 'set -a; . /etc/ltd/backup.env; set +a; /srv/life-to-day/deploy/restic-backup.sh' >> /var/log/ltd-backup.log 2>&1
```

`backup.sh` makes an online `.backup`, includes committed WAL writes and requires `integrity_check=ok`. The snapshot is a standalone file in DELETE journal mode. `restic-backup.sh` first runs that script, then backs up **that exact snapshot** and `data/uploads`. Supply `RESTIC_REPOSITORY` and `RESTIC_PASSWORD` only through the process environment; initialize the remote restic repository on the production host first. Missing variables or restic executable produce an explicit BLOCKED message and exit 2 after the local backup. Off-site execution is **BLOCKED**, not tested, until these are supplied.

After successful off-site backup, a configured `HEALTHCHECK_URL` receives a GET with a 10-second timeout. If unset, the script warns and exits 0 after backup; dead-man monitoring remains **BLOCKED**. Do not put that URL in Git.

`restore-drill.sh` opens a copy in a fresh empty folder, checks integrity, starts a separate container without published ports and with scheduler/Telegram disabled, waits for readiness and compares user/area/project/task/note counts. It never mounts the live database. An explicit target is retained; an automatically allocated target is removed after the drill. Set `LTD_IMAGE` to test a specific image; by default it uses the current compose app's image ID. Weekly Sunday 03:45 UTC CI and PR checks use a small synthetic database only (`backup-drill.yml`), with no repository secrets or real data. Only text proof logs are uploaded.

### Update

```bash
cd deploy
./deploy.sh 1.2.3                                # version without v
```

The script captures the previous image ID, makes and verifies the pre-deploy SQLite snapshot, stops the app, records `.env.version`, pulls the new fork image, starts one app and waits for `/api/health/ready`. Pull, startup or health failure triggers rollback. Production rollout execution remains **BLOCKED** until the production host is supplied.

### Automatic rollback

Migrations run on start and may not be reversible, so roll back the image and the database together, to the backup taken just before the update.

On failure, `deploy.sh` stops the app, retains the failed SQLite/WAL/SHM files in `data/failed-*`, restores the exact pre-deploy snapshot as `data/db/production.sqlite3`, restores the previous version and retags the captured image ID. It starts with `--pull never`, then checks readiness again. It returns exit 1 even when rollback succeeds, so the failed deployment is visible. Never roll back only the image.

Never copy a backup over `production.sqlite3` while an old `-wal` file is still beside it: SQLite would replay that WAL onto the restored file.

## Target: Runflare (PaaS)

Runflare builds the root `Dockerfile` from files sent by its CLI (`runflare deploy`, which skips what `.gitignore` ignores) and provides the domain, certificate and proxy. Caddy, `docker-compose.yml`, `backup.sh` and `restore-drill.sh` are not used there.

| Panel setting | Value                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Service type  | Docker (Dockerfile at the repository root)                                                                    |
| Replicas      | 1                                                                                                             |
| Disks         | One disk at `/app/db`, one at `/app/uploads`                                                                  |
| Network       | Public (NodePort / HTTP) on container port `3002`                                                             |
| Variables     | From `deploy/.env.example` without `LTD_DOMAIN`; `TUDUDI_USER_PASSWORD` and `TUDUDI_SESSION_SECRET` as Secret |
| Domain        | Own domain or the platform subdomain, free certificate on                                                     |

After the first deploy, `runflare logs -f` should show `Using database file '/app/db/production.sqlite3'`, `Migrations completed successfully` and `TUDUDI_TRUST_PROXY=1 parsed as number 1`. Then check `/api/health/ready`, sign in, and restart the service once to confirm the data survives.

Backups there: restart the service (each start writes a fresh `db-backup-*.sqlite3` into `/app/db`), then use Runflare's disk backup and download. A scheduled off-host backup is still open (T-202).

Not verified against Runflare yet (their docs were unreachable from the build machine): whether the build has BuildKit (the `Dockerfile` uses `--platform=$BUILDPLATFORM`), whether npm and Docker Hub are reachable from the builder, whether containers start as root (the entrypoint needs root to `chown` and then drops privileges), whether disks are block storage (SQLite WAL is unsafe on NFS-like storage), and how many proxy hops sit in front of the app.
