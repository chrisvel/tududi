#!/usr/bin/env bash
# Deploy one production writer. A failed migration/readiness rolls back BOTH
# its image and the consistent pre-deploy SQLite snapshot.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
version=${1:-}
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
    echo "Usage: ./deploy.sh <version-without-v>" >&2; exit 2
fi
[ -f .env ] || { echo "Missing production .env" >&2; exit 2; }
# Explicit base file prevents the local build/port override on production.
compose=(docker compose -f docker-compose.yml --env-file .env --profile production)
if [ -f .env.version ]; then compose+=(--env-file .env.version); fi
container=$("${compose[@]}" ps -q app)
[ -n "$container" ] || { echo "Start the production app before updating" >&2; exit 2; }
previous_image=$(docker inspect --format '{{.Image}}' "$container")
previous_tag=$(docker inspect --format '{{.Config.Image}}' "$container")
case "$previous_tag" in
    ghcr.io/danialmasghati/life-to-day:*) previous=${previous_tag##*:} ;;
    *) echo "Refusing update: the running app is not a production fork image" >&2; exit 2 ;;
esac
marker=$(mktemp)
trap 'rm -f "$marker"' EXIT
# Uses the existing online SQLite backup API, not a copy of a WAL-mode file.
COMPOSE_FILE=docker-compose.yml BACKUP_PATH_FILE="$marker" ./backup.sh
snapshot=$(cat "$marker")
"${compose[@]}" stop app
printf 'LTD_VERSION=%s\n' "$version" > .env.version
export LTD_VERSION="$version"
compose=(docker compose -f docker-compose.yml --env-file .env --env-file .env.version --profile production)

ready() {
    for _ in $(seq 1 60); do
        if "${compose[@]}" exec -T app wget -q -O /dev/null http://127.0.0.1:3002/api/health/ready; then return 0; fi
        sleep 2
    done
    return 1
}
if "${compose[@]}" pull app && "${compose[@]}" up -d --no-build --scale app=1 app && ready; then
    echo "Deploy OK: $version; pre-deploy snapshot: $snapshot"
    exit 0
fi

echo "Deploy failed; restoring image $previous and SQLite snapshot $snapshot" >&2
"${compose[@]}" stop app
failed="data/failed-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$failed"
# Retain failed files for diagnosis, including WAL/SHM; none may be replayed
# onto the restored snapshot. The app is stopped throughout this operation.
for file in data/db/production.sqlite3 data/db/production.sqlite3-wal data/db/production.sqlite3-shm; do
    if [ -f "$file" ]; then mv "$file" "$failed/"; fi
done
cp "$snapshot" data/db/production.sqlite3
printf 'LTD_VERSION=%s\n' "$previous" > .env.version
export LTD_VERSION="$previous"
# Retag the captured local image ID: a mutable :latest must not replace it.
docker tag "$previous_image" "ghcr.io/danialmasghati/life-to-day:$previous"
if "${compose[@]}" up -d --no-build --pull never --scale app=1 app && ready; then
    echo "Rollback OK: previous image AND pre-deploy SQLite restored" >&2
else
    echo "Rollback failed; app needs operator recovery. Snapshot retained: $snapshot" >&2
fi
exit 1
