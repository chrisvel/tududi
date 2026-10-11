#!/usr/bin/env bash
# Online backup of the live SQLite database, safe while the app is writing.
#
#   deploy/backup.sh            # from anywhere; needs the app container up
#   KEEP_DAYS=30 deploy/backup.sh
#
# Writes deploy/data/backups/ltd-<UTC time>.sqlite3, verified with
# PRAGMA integrity_check. Covers the database only: deploy/data/uploads is
# plain files and needs its own off-server copy.
set -euo pipefail
cd "$(dirname "$0")"

DB=/app/db/production.sqlite3
KEEP_DAYS=${KEEP_DAYS:-14}
name="ltd-$(date -u +%Y%m%dT%H%M%SZ).sqlite3"
target="/app/backups/$name"

# Run as the app's own user (PUID:PGID, same defaults as the entrypoint),
# not as root, so no root-owned file lands next to the live database.
owner=$(docker compose exec -T app sh -c 'echo "${PUID:-${APP_UID:-1001}}:${PGID:-${APP_GID:-1001}}"' | tr -d '\r')
sql() { docker compose exec -T -u "$owner" app sqlite3 -cmd '.timeout 10000' "$@"; }

# .backup uses SQLite's backup API: one consistent snapshot that includes
# writes still in the -wal file. A plain cp of the main file would miss them.
sql "$DB" ".backup '$target'"

# journal_mode=DELETE makes the copy one self-contained file with no
# -wal/-shm sidecars; the app switches it back to WAL when it opens it.
out=$(sql "$target" 'PRAGMA integrity_check;' 'PRAGMA journal_mode=DELETE;' | tr -d '\r')
check=${out%%$'\n'*}
if [ "$check" != "ok" ]; then
    echo "Integrity check failed for $name: $check" >&2
    docker compose exec -T app rm -f "$target"
    exit 1
fi

find data/backups -maxdepth 1 -name 'ltd-*.sqlite3' -mtime +"$KEEP_DAYS" -delete
echo "Backup OK: $(pwd)/data/backups/$name ($(du -h "data/backups/$name" | cut -f1))"
# Optional machine-readable handoff for restic and pre-deploy rollback.
if [ -n "${BACKUP_PATH_FILE:-}" ]; then
    printf '%s\n' "$(pwd)/data/backups/$name" > "$BACKUP_PATH_FILE"
fi
