#!/usr/bin/env bash
# Dumps the tududi PostgreSQL database to a compressed file and prunes old
# dumps. Meant for cron on the host (or a sidecar) of a PostgreSQL install;
# the SQLite file backup in backend/cmd/start.sh does not apply there.
#
#   DATABASE_URL=postgres://... ./scripts/pg-backup.sh /var/backups/tududi
#
# Keeps BACKUP_KEEP_DAYS days of dumps (default 14). Copy the directory
# somewhere off the machine (restic, rclone, object storage) to have a real
# backup; this script only produces the files.
set -euo pipefail

DEST=${1:-${BACKUP_DIR:-./backups}}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found; install the PostgreSQL client tools" >&2
  exit 1
fi

mkdir -p "$DEST"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$DEST/tududi-$STAMP.sql.gz"
TMP="$FILE.part"

# --no-owner/--no-acl: restorable into a database owned by any role.
pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "$TMP"
mv "$TMP" "$FILE"
echo "Wrote $FILE ($(du -h "$FILE" | cut -f1))"

find "$DEST" -name 'tududi-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete | sed 's/^/Pruned /'

# Restore with:
#   gunzip -c tududi-<stamp>.sql.gz | psql "$DATABASE_URL"
