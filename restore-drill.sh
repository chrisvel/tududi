#!/usr/bin/env bash
# Restore drill: boots a throwaway copy of the app on a backup and checks it
# serves. Never touches the live database or the running containers.
#
#   ./restore-drill.sh                       # newest data/backups/ltd-*.sqlite3
#   ./restore-drill.sh path/to/backup.sqlite3
#   ./restore-drill.sh path/to/backup.sqlite3 /path/to/empty-folder
#   LTD_IMAGE=ghcr.io/danialmasghati/life-to-day:VERSION ./restore-drill.sh
set -euo pipefail
cd "$(dirname "$0")"

IMAGE=${LTD_IMAGE:-$(docker compose images -q app)}
[ -n "$IMAGE" ] || { echo "Set LTD_IMAGE or start the compose app first" >&2; exit 2; }
# Names carry a UTC timestamp, so the last one in glob order is the newest.
backup=${1:-$(printf '%s\n' data/backups/ltd-*.sqlite3 | tail -n 1)}
[ -f "$backup" ] || { echo "No backup file found (looked for: ${1:-data/backups/ltd-*.sqlite3})" >&2; exit 1; }

started=$(date +%s)
work=${2:-$(mktemp -d)}
[ -d "$work" ] && [ -z "$(find "$work" -mindepth 1 -maxdepth 1 -print -quit)" ] || {
    echo "Restore target must be an existing empty folder: $work" >&2; exit 2;
}
work=$(cd "$work" && pwd)
name="ltd-restore-drill-$$"
# Capture this before the trap function's own positional arguments are used.
keep_work=${2:-}
cleanup() {
    docker rm -f "$name" >/dev/null 2>&1 || true
    if [ -z "$keep_work" ]; then rm -rf "$work"; fi
}
trap cleanup EXIT

echo "== restoring $backup into empty folder $work"
mkdir -p "$work/db" "$work/uploads" "$work/backups"
cp "$backup" "$work/db/production.sqlite3"

COUNTS="SELECT 'users=' || (SELECT count(*) FROM users) || ' areas=' || (SELECT count(*) FROM areas) || ' projects=' || (SELECT count(*) FROM projects) || ' tasks=' || (SELECT count(*) FROM tasks) || ' notes=' || (SELECT count(*) FROM notes);"
offline() { docker run --rm -u "$(id -u):$(id -g)" -v "$work/db:/db" --entrypoint sqlite3 "$IMAGE" /db/production.sqlite3 "$@"; }

out=$(offline 'PRAGMA integrity_check;')
check=${out%%$'\n'*}
echo "integrity: $check"
[ "$check" = "ok" ] || exit 1
before=$(offline "$COUNTS")

# Scheduler and Telegram off: the copy must not send digests, reminders or
# bot replies on behalf of the real instance. No ports are published.
docker run -d --name "$name" \
    -e PUID="$(id -u)" -e PGID="$(id -g)" \
    -e DISABLE_SCHEDULER=true -e DISABLE_TELEGRAM=true \
    -v "$work/db:/app/db" -v "$work/uploads:/app/uploads" -v "$work/backups:/app/backups" \
    "$IMAGE" >/dev/null

echo "== waiting for /api/health/ready on $IMAGE"
for _ in $(seq 1 60); do
    if ready=$(docker exec "$name" wget -q -O - http://127.0.0.1:3002/api/health/ready 2>/dev/null); then
        break
    fi
    ready=""
    sleep 2
done
if [ -z "$ready" ]; then
    echo "Restored instance never became ready. Last log lines:" >&2
    docker logs --tail 30 "$name" >&2
    exit 1
fi
echo "ready: $ready"

after=$(docker exec -u "$(id -u):$(id -g)" "$name" sqlite3 /app/db/production.sqlite3 "$COUNTS")
echo "rows in backup:   $before"
echo "rows after start: $after"
[ "$before" = "$after" ] || { echo "Row counts differ" >&2; exit 1; }
echo "== drill passed in $(($(date +%s) - started))s"
