#!/usr/bin/env bash
# Builds the legacy SQLite fixtures used by backend/tests/upgrade.
#
# For every tag given (default: v1.2.4 v1.3.0 v1.3.1 v1.4.0 v1.4.2) this script
#   1. checks the tag out into a temporary git worktree and installs its deps,
#   2. boots that version's own backend/cmd/start.sh against an empty DB_FILE
#      (db-init + its migrations + user-create + app boot), waits for
#      /api/health and stops it,
#   3. runs seed-legacy.js with that version's models,
#   4. checkpoints the WAL, vacuums and copies the file next to this script,
#   5. records row counts, sha256 and the commit in manifest.json.
#
# Usage: bash backend/tests/fixtures/legacy/build.sh [tag ...]
# Env:   LEGACY_SCRATCH   directory for worktrees (default: mktemp -d)
#        LEGACY_PORT      port the old backend listens on (default: 3399)
#        KEEP_WORKTREES=1 do not remove worktrees afterwards

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
SCRATCH="${LEGACY_SCRATCH:-$(mktemp -d -t tududi-legacy)}"
PORT="${LEGACY_PORT:-3399}"
TAGS=("$@")
if [ ${#TAGS[@]} -eq 0 ]; then
    TAGS=(v1.2.4 v1.3.0 v1.3.1 v1.4.0 v1.4.2)
fi
MANIFEST="$SCRIPT_DIR/manifest.json"

command -v sqlite3 >/dev/null || { echo "sqlite3 CLI is required" >&2; exit 1; }
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

log() { printf '\033[33m[legacy] %s\033[0m\n' "$*"; }

WORKTREES=()
BOOT_PID=""
cleanup() {
    if [ -n "$BOOT_PID" ] && kill -0 "$BOOT_PID" 2>/dev/null; then
        kill -TERM "$BOOT_PID" 2>/dev/null || true
        wait "$BOOT_PID" 2>/dev/null || true
    fi
    if [ "${KEEP_WORKTREES:-0}" != "1" ]; then
        for wt in "${WORKTREES[@]:-}"; do
            [ -n "$wt" ] || continue
            git -C "$REPO_DIR" worktree remove --force "$wt" 2>/dev/null || true
        done
        git -C "$REPO_DIR" worktree prune 2>/dev/null || true
    fi
}
trap cleanup EXIT

wait_for_health() {
    local url="$1" tries=0
    until curl -fsS "$url" >/dev/null 2>&1; do
        tries=$((tries + 1))
        if [ "$tries" -ge 120 ]; then
            return 1
        fi
        sleep 0.5
    done
}

stop_boot() {
    if [ -n "$BOOT_PID" ]; then
        kill -TERM "$BOOT_PID" 2>/dev/null || true
        wait "$BOOT_PID" 2>/dev/null || true
        BOOT_PID=""
    fi
    # Anything still bound to the port (the exec'd node process) must go too.
    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            kill -TERM $pids 2>/dev/null || true
            sleep 1
            pids=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
            [ -z "$pids" ] || kill -KILL $pids 2>/dev/null || true
        fi
    fi
}

build_tag() {
    local tag="$1"
    local wt="$SCRATCH/tududi-$tag"
    local work="$SCRATCH/db-$tag"
    local db="$work/production.sqlite3"
    local bootlog="$work/boot.log"
    local out="$SCRIPT_DIR/$tag.sqlite3"

    log "== $tag =="
    rm -rf "$work"
    mkdir -p "$work"

    if [ ! -d "$wt" ]; then
        log "creating worktree at $wt"
        git -C "$REPO_DIR" worktree add --detach "$wt" "$tag" >/dev/null
        WORKTREES+=("$wt")
    fi

    if [ ! -d "$wt/node_modules/sequelize-cli" ]; then
        log "installing dependencies (this takes a few minutes)"
        (cd "$wt" && npm install --omit=dev --no-audit --no-fund --loglevel=error)
    fi

    log "booting $tag start.sh against $db"
    (
        cd "$wt/backend"
        NODE_ENV=production \
        DB_FILE="$db" \
        PORT="$PORT" \
        HOST=127.0.0.1 \
        DISABLE_SCHEDULER=true \
        DISABLE_TELEGRAM=true \
        SEQUELIZE_LOGGING=false \
        TUDUDI_USER_EMAIL=alice.legacy@example.com \
        TUDUDI_USER_PASSWORD=password123 \
        DATABASE_URL= \
        DB_DIALECT= \
        ./cmd/start.sh >"$bootlog" 2>&1 || true
    ) &
    BOOT_PID=$!

    if ! wait_for_health "http://127.0.0.1:$PORT/api/health"; then
        echo "backend for $tag never became healthy; log follows" >&2
        cat "$bootlog" >&2
        exit 1
    fi
    stop_boot

    if grep -q "Migration failed" "$bootlog"; then
        echo "migrations failed while bootstrapping $tag; log follows" >&2
        cat "$bootlog" >&2
        exit 1
    fi

    log "seeding"
    local collision=0
    [ "$tag" = "v1.4.0" ] && collision=1
    local counts
    (
        cd "$wt/backend" &&
        NODE_ENV=production DB_FILE="$db" DATABASE_URL= DB_DIALECT= \
        SEQUELIZE_LOGGING=false LEGACY_COLLISION=$collision \
        node "$SCRIPT_DIR/seed-legacy.js" >"$work/seed.out" 2>"$work/seed.err"
    ) || {
        echo "seeding $tag failed; output follows" >&2
        cat "$work/seed.out" "$work/seed.err" >&2
        exit 1
    }
    counts=$(tail -n 1 "$work/seed.out")

    log "finalising"
    sqlite3 "$db" "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; VACUUM;" >/dev/null
    rm -f "$db-wal" "$db-shm"
    local integrity
    integrity=$(sqlite3 "$db" "PRAGMA integrity_check;")
    if [ "$integrity" != "ok" ]; then
        echo "integrity_check failed for $tag: $integrity" >&2
        exit 1
    fi
    cp "$db" "$out"

    local sha commit migrations
    sha=$(shasum -a 256 "$out" | cut -d' ' -f1)
    commit=$(git -C "$REPO_DIR" rev-parse "$tag^{commit}")
    migrations=$(sqlite3 "$out" "SELECT COUNT(*) FROM SequelizeMeta;")
    node - "$MANIFEST" "$tag" "$commit" "$sha" "$migrations" "$counts" "$collision" <<'EOF'
const fs = require('fs');
const [file, tag, commit, sha256, migrations, counts, collision] = process.argv.slice(2);
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { manifest = {}; }
manifest[tag] = {
    commit,
    sha256,
    generated_at: new Date().toISOString(),
    node: process.version,
    migrations_applied: Number(migrations),
    collision_users: collision === '1',
    row_counts: JSON.parse(counts),
};
const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
EOF
    log "wrote $out ($(du -h "$out" | cut -f1), $migrations migrations)"
}

for tag in "${TAGS[@]}"; do
    build_tag "$tag"
done

log "done: ${TAGS[*]}"
