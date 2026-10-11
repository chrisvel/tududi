#!/usr/bin/env bash
# Consistent SQLite snapshot first, then uploads and that snapshot off-site.
# Secrets come only from the process environment, never command arguments.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
marker=$(mktemp)
trap 'rm -f "$marker"' EXIT
BACKUP_PATH_FILE="$marker" ./backup.sh
snapshot=$(cat "$marker")

if [ -z "${RESTIC_REPOSITORY:-}" ] || [ -z "${RESTIC_PASSWORD:-}" ]; then
    echo "BLOCKED: set RESTIC_REPOSITORY and RESTIC_PASSWORD in the host environment; local backup succeeded." >&2
    exit 2
fi
if ! command -v restic >/dev/null 2>&1; then
    echo "BLOCKED: install restic on the production host; local backup succeeded." >&2
    exit 2
fi
restic backup --tag life-to-day "$snapshot" "$(pwd)/data/uploads"
if [ -n "${HEALTHCHECK_URL:-}" ]; then
    curl --fail --silent --show-error --max-time 10 --output /dev/null "$HEALTHCHECK_URL"
else
    echo "Warning: HEALTHCHECK_URL is unset; backup succeeded without a dead-man GET." >&2
fi
