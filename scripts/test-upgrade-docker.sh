#!/usr/bin/env bash
# End-to-end upgrade check with the real Docker images.
#
#   1. Starts the previous release image on a temporary volume seeded from a
#      legacy fixture (or, with --seed-api, from an empty database populated
#      through its REST API), creates a marker task and stops it.
#   2. Builds the current checkout into an image (skipped with SKIP_BUILD=1).
#   3. Starts the new image on the same volume and checks: the entrypoint
#      detects the existing database, migrations finish, a pre-migration
#      backup exists and matches the file that was there before, logins work,
#      the data is still there, and a restart is idempotent.
#   4. Starts the new image once more with a stray DATABASE_URL and checks it
#      refuses to run and leaves the SQLite file untouched.
#
# Usage: npm run test:upgrade:docker            (or bash scripts/test-upgrade-docker.sh)
# Env:   OLD_IMAGE   previous release image      (default chrisvel/tududi:1.4.2)
#        NEW_IMAGE   tag for the freshly built image (default tududi:upgrade-test)
#        FIXTURE     SQLite file to seed the volume with
#                    (default backend/tests/fixtures/legacy/v1.4.2.sqlite3)
#        SKIP_BUILD  =1 reuse an already built NEW_IMAGE
#        KEEP_VOLUME =1 keep the temporary volume directory for inspection
#        UPGRADE_VOL_ROOT  where temporary volumes are created
#                    (default ~/.cache/tududi-upgrade-test; must be a path
#                    Docker can bind mount)

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
OLD_IMAGE="${OLD_IMAGE:-chrisvel/tududi:1.4.2}"
NEW_IMAGE="${NEW_IMAGE:-tududi:upgrade-test}"
FIXTURE="${FIXTURE:-$ROOT_DIR/backend/tests/fixtures/legacy/v1.4.2.sqlite3}"
SEED_API=0
for arg in "$@"; do
    case "$arg" in
        --seed-api) SEED_API=1 ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done

ADMIN_EMAIL="alice.legacy@example.com"
ADMIN_EMAIL_MIXED="Alice.Legacy@Example.COM"
BOB_EMAIL="bob@example.com"
PASSWORD="password123"
RUN_ID="$$"
OLD_NAME="tududi-upgrade-old-$RUN_ID"
NEW_NAME="tududi-upgrade-new-$RUN_ID"
STRAY_NAME="tududi-upgrade-stray-$RUN_ID"
# The volume must live somewhere Docker Desktop shares with containers; the
# system temp directory is not always (bind mounts of it come up empty).
VOL_ROOT="${UPGRADE_VOL_ROOT:-$HOME/.cache/tududi-upgrade-test}"
mkdir -p "$VOL_ROOT"
VOL="$(mktemp -d "$VOL_ROOT/vol-XXXXXX")"
WORK="$(mktemp -d "$VOL_ROOT/work-XXXXXX")"
FAILURES=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
check() {
    local ok="$1"; shift
    if [ "$ok" = "0" ]; then green "  ok   $*"; else red "  FAIL $*"; FAILURES=$((FAILURES + 1)); fi
}

cleanup() {
    for name in "$OLD_NAME" "$NEW_NAME" "$STRAY_NAME"; do
        docker rm -f "$name" >/dev/null 2>&1 || true
    done
    if [ "${KEEP_VOLUME:-0}" = "1" ]; then
        yellow "volume kept at $VOL"
    else
        rm -rf "$VOL" "$WORK"
    fi
}
trap cleanup EXIT

sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

wait_healthy() {
    local name="$1" port="$2" tries=0
    until curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; do
        tries=$((tries + 1))
        if [ "$tries" -ge 180 ]; then
            red "container $name never became healthy; log follows"
            docker logs "$name" 2>&1 | tail -60
            return 1
        fi
        if ! docker ps --format '{{.Names}}' | grep -qx "$name"; then
            red "container $name exited early; log follows"
            docker logs "$name" 2>&1 | tail -60
            return 1
        fi
        sleep 1
    done
}

host_port() {
    docker port "$1" 3002/tcp | head -n1 | sed 's/.*://'
}

# start_container <name> <image> <admin email> [extra docker args...]
start_container() {
    local name="$1" image="$2" admin="$3"; shift 3
    docker run -d --name "$name" \
        -v "$VOL:/app/db" \
        -e PUID="$(id -u)" -e PGID="$(id -g)" \
        -e TUDUDI_USER_EMAIL="$admin" -e TUDUDI_USER_PASSWORD="$PASSWORD" \
        -e TUDUDI_SESSION_SECRET=upgrade-test-secret \
        -e DISABLE_SCHEDULER=true -e DISABLE_TELEGRAM=true \
        -p 127.0.0.1::3002 "$@" "$image" >/dev/null
}

# api_login <port> <email> <cookie jar> -> prints HTTP status
api_login() {
    curl -s -o /dev/null -w '%{http_code}' -c "$3" -H 'Content-Type: application/json' \
        -X POST "http://127.0.0.1:$1/api/login" \
        -d "{\"email\":\"$2\",\"password\":\"$PASSWORD\"}"
}

# api_csrf <port> <cookie jar> -> prints the CSRF token for the session
api_csrf() {
    curl -s -b "$2" -c "$2" "http://127.0.0.1:$1/api/csrf-token" \
        | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/'
}

# api_post <port> <path> <cookie jar> <json body> -> prints HTTP status
api_post() {
    local token
    token="$(api_csrf "$1" "$3")"
    curl -s -o /dev/null -w '%{http_code}' -b "$3" -H 'Content-Type: application/json' \
        -H "X-CSRF-Token: $token" -X POST "http://127.0.0.1:$1$2" -d "$4"
}

api_get_status() {
    curl -s -o /dev/null -w '%{http_code}' -b "$3" "http://127.0.0.1:$1$2"
}

api_task_count() {
    curl -s -b "$3" "http://127.0.0.1:$1/api/tasks?type=all" | node -e '
        let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
            const b = JSON.parse(s); const list = Array.isArray(b) ? b : b.tasks || [];
            process.stdout.write(String(list.length));
        });'
}

api_has_task() {
    curl -s -b "$3" "http://127.0.0.1:$1/api/tasks?type=all" | grep -q "$2"
}

yellow "== upgrade test: $OLD_IMAGE -> $NEW_IMAGE"
yellow "volume: $VOL"

# Preflight: make sure containers really see this directory.
printf 'mount-probe' > "$VOL/.probe"
if [ "$(docker run --rm -v "$VOL:/app/db" alpine cat /app/db/.probe 2>/dev/null)" != "mount-probe" ]; then
    red "Docker cannot bind mount $VOL (the directory shows up empty inside containers)."
    red "Set UPGRADE_VOL_ROOT to a directory Docker Desktop shares, for example under \$HOME."
    exit 1
fi
rm -f "$VOL/.probe"

# ---------------------------------------------------------------- step 1
if [ "$SEED_API" = "1" ]; then
    yellow "-- starting $OLD_IMAGE on an empty volume"
    start_container "$OLD_NAME" "$OLD_IMAGE" "$BOB_EMAIL"
else
    yellow "-- seeding volume from $FIXTURE"
    cp "$FIXTURE" "$VOL/production.sqlite3"
    start_container "$OLD_NAME" "$OLD_IMAGE" "$BOB_EMAIL"
fi
wait_healthy "$OLD_NAME" "$(host_port "$OLD_NAME")"
OLD_PORT="$(host_port "$OLD_NAME")"
OLD_JAR="$WORK/old.jar"
check "$([ "$(api_login "$OLD_PORT" "$BOB_EMAIL" "$OLD_JAR")" = "200" ]; echo $?)" "old image: login as $BOB_EMAIL"

MARKER="upgrade-marker-$RUN_ID"
if [ "$SEED_API" = "1" ]; then
    for n in 1 2 3; do
        api_post "$OLD_PORT" /api/task "$OLD_JAR" "{\"name\":\"Seeded task $n\",\"priority\":1}" >/dev/null
    done
    api_post "$OLD_PORT" /api/project "$OLD_JAR" '{"name":"Seeded project"}' >/dev/null
fi
MARKER_STATUS="$(api_post "$OLD_PORT" /api/task "$OLD_JAR" "{\"name\":\"$MARKER\",\"priority\":2}")"
check "$([ "$MARKER_STATUS" = "201" ]; echo $?)" "old image: created marker task ($MARKER_STATUS)"
OLD_COUNT="$(api_task_count "$OLD_PORT" "" "$OLD_JAR")"
yellow "   tasks visible on old image: $OLD_COUNT"

docker stop "$OLD_NAME" >/dev/null
docker rm "$OLD_NAME" >/dev/null

if [ "$SEED_API" = "1" ]; then
    # Plant the legacy quirk the fixtures already carry: a second account whose
    # stored email is mixed-case (cloned from the seeded user so the password
    # is known). The seeded user keeps owning the data the checks look at.
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$VOL/production.sqlite3" "INSERT INTO users (uid, email, password_digest, name, appearance, language, timezone, first_day_of_week, task_summary_enabled, email_verified, created_at, updated_at) SELECT 'legacymixedcase', '$ADMIN_EMAIL_MIXED', password_digest, 'Alice', appearance, language, timezone, first_day_of_week, task_summary_enabled, email_verified, created_at, updated_at FROM users WHERE email='$BOB_EMAIL'" \
            || yellow "   could not plant the mixed-case account (schema differs?), continuing"
    else
        yellow "   sqlite3 CLI not found, skipping mixed-case email planting"
    fi
fi
PRE_SHA="$(sha "$VOL/production.sqlite3")"
yellow "   sqlite sha256 before upgrade: $PRE_SHA"
count_users() {
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 -readonly "$VOL/production.sqlite3" "SELECT COUNT(*) FROM users" 2>/dev/null || echo "?"
    else
        echo "?"
    fi
}
USERS_BEFORE="$(count_users)"

# ---------------------------------------------------------------- step 2
if [ "${SKIP_BUILD:-0}" != "1" ]; then
    yellow "-- building $NEW_IMAGE from $ROOT_DIR"
    docker build -q -t "$NEW_IMAGE" "$ROOT_DIR" >/dev/null
fi

# ---------------------------------------------------------------- step 3
yellow "-- starting $NEW_IMAGE on the same volume"
start_container "$NEW_NAME" "$NEW_IMAGE" "$ADMIN_EMAIL"
wait_healthy "$NEW_NAME" "$(host_port "$NEW_NAME")"
NEW_PORT="$(host_port "$NEW_NAME")"
LOGS="$(docker logs "$NEW_NAME" 2>&1)"
check "$(printf '%s' "$LOGS" | grep -q 'Existing database detected'; echo $?)" "new image: existing database detected"
check "$(printf '%s' "$LOGS" | grep -q 'Migrations completed successfully'; echo $?)" "new image: migrations completed"
if printf '%s' "$LOGS" | grep -q 'Empty database detected'; then
    check 1 "new image: did not bootstrap an empty schema"
else
    check 0 "new image: did not bootstrap an empty schema"
fi
BACKUPS="$(find "$VOL" -maxdepth 1 -name 'db-backup-*.sqlite3' | wc -l | tr -d ' ')"
check "$([ "$BACKUPS" -ge 1 ]; echo $?)" "new image: pre-migration backup written ($BACKUPS)"
if [ "$BACKUPS" -ge 1 ]; then
    LATEST_BACKUP="$(ls -t "$VOL"/db-backup-*.sqlite3 | head -n1)"
    check "$([ "$(sha "$LATEST_BACKUP")" = "$PRE_SHA" ]; echo $?)" "new image: backup matches the pre-upgrade file"
fi

NEW_JAR="$WORK/new.jar"
check "$([ "$(api_login "$NEW_PORT" "$BOB_EMAIL" "$NEW_JAR")" = "200" ]; echo $?)" "new image: login as $BOB_EMAIL"
# TUDUDI_USER_EMAIL names the legacy admin in its lowercase form. The
# lowercase-emails migration must have normalised the stored row so
# user-create.js updates it instead of creating a second, empty admin.
USERS_AFTER="$(count_users)"
ALICE_LOWER="$(api_login "$NEW_PORT" "$ADMIN_EMAIL" "$WORK/a1.jar")"
ALICE_MIXED="$(api_login "$NEW_PORT" "$ADMIN_EMAIL_MIXED" "$WORK/a2.jar")"
check "$([ "$ALICE_LOWER" = "200" ] && [ "$ALICE_MIXED" = "200" ]; echo $?)" "new image: legacy mixed-case admin can log in ($ALICE_LOWER / $ALICE_MIXED)"
if [ "$USERS_BEFORE" = "?" ]; then
    yellow "  note new image: sqlite3 CLI missing, cannot verify the admin account was reused"
else
    check "$([ "$USERS_AFTER" = "$USERS_BEFORE" ]; echo $?)" "new image: no duplicate admin created (users $USERS_BEFORE -> $USERS_AFTER)"
fi

NEW_COUNT="$(api_task_count "$NEW_PORT" "" "$NEW_JAR")"
check "$([ "$NEW_COUNT" = "$OLD_COUNT" ]; echo $?)" "new image: task count unchanged ($OLD_COUNT -> $NEW_COUNT)"
check "$(api_has_task "$NEW_PORT" "$MARKER" "$NEW_JAR"; echo $?)" "new image: marker task still present"
for p in /api/projects /api/tags /api/notes /api/tasks/metrics "/api/tasks?type=today" "/api/tasks?type=upcoming"; do
    check "$([ "$(api_get_status "$NEW_PORT" "$p" "$NEW_JAR")" = "200" ]; echo $?)" "new image: GET $p"
done

yellow "-- restarting the new container"
docker restart "$NEW_NAME" >/dev/null
wait_healthy "$NEW_NAME" "$(host_port "$NEW_NAME")"
NEW_PORT="$(host_port "$NEW_NAME")"
RESTART_LOGS="$(docker logs "$NEW_NAME" 2>&1 | tail -40)"
check "$(printf '%s' "$RESTART_LOGS" | grep -q 'No migrations were executed'; echo $?)" "restart: no migrations pending"
check "$([ "$(api_login "$NEW_PORT" "$BOB_EMAIL" "$WORK/r.jar")" = "200" ]; echo $?)" "restart: login still works"
docker stop "$NEW_NAME" >/dev/null
docker rm "$NEW_NAME" >/dev/null
POST_SHA="$(sha "$VOL/production.sqlite3")"

# ---------------------------------------------------------------- step 4
yellow "-- starting $NEW_IMAGE with a stray DATABASE_URL"
start_container "$STRAY_NAME" "$NEW_IMAGE" "$ADMIN_EMAIL" \
    -e DATABASE_URL=postgres://nobody:nothing@127.0.0.1:1/none
STRAY_EXIT="$(docker wait "$STRAY_NAME" 2>/dev/null || echo timeout)"
STRAY_LOGS="$(docker logs "$STRAY_NAME" 2>&1)"
check "$([ "$STRAY_EXIT" != "0" ]; echo $?)" "stray DATABASE_URL: container refused to start (exit $STRAY_EXIT)"
check "$([ "$(sha "$VOL/production.sqlite3")" = "$POST_SHA" ]; echo $?)" "stray DATABASE_URL: sqlite file untouched"
if printf '%s' "$STRAY_LOGS" | grep -qi 'existing SQLite database'; then
    green "  ok   stray DATABASE_URL: guard banner shown"
else
    yellow "  note stray DATABASE_URL: failed at the connection step, no guard banner yet (added by the dialect-switch guard fix)"
fi

echo
if [ "$FAILURES" = "0" ]; then
    green "UPGRADE TEST PASSED"
else
    red "UPGRADE TEST FAILED: $FAILURES check(s)"
    exit 1
fi
