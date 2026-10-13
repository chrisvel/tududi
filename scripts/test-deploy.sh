#!/usr/bin/env bash
# Dry run of deploy.sh with a fake docker on PATH: no server, no images.
#
#   bash scripts/test-deploy.sh [path/to/deploy.sh]
#
# Checks that a failed update restores the image AND the pre-deploy SQLite
# snapshot together, and that no path rolls back without a snapshot.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
deploy=$(cd "$(dirname "${1:-$root/deploy.sh}")" && pwd)/$(basename "${1:-$root/deploy.sh}")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/bin"
# Fake docker: logs every call. FAKE_PULL=ok: the update works; unready: the
# new version never becomes ready; vanish: pull fails after the snapshot
# file was removed.
cat > "$work/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
args=" $* "
case "$args" in
    *" ps -q app "*) echo cid ;;
    *" inspect --format {{.Image}} "*) echo sha256:previous ;;
    *" inspect --format {{.Config.Image}} "*) echo ghcr.io/danialmasghati/life-to-day:1.0.0 ;;
    *" pull app "*)
        if [ "$FAKE_PULL" = vanish ]; then rm -f data/backups/ltd-snap.sqlite3; exit 1; fi
        exit 0 ;;
    *" exec -T app wget "*)
        [ "$FAKE_PULL" = ok ] || ! grep -q "LTD_VERSION=2.0.0" .env.version ;;
    *) exit 0 ;;
esac
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$work/bin/sleep"
chmod +x "$work/bin/docker" "$work/bin/sleep"

failures=0
check() {
    if eval "$2"; then echo "  ok: $1"; else echo "  FAIL: $1"; failures=$((failures + 1)); fi
}

# One isolated deploy folder per scenario. FAKE_BACKUP=none writes no marker.
run() {
    local dir="$work/$1"
    mkdir -p "$dir/data/db" "$dir/data/backups"
    cp "$deploy" "$dir/deploy.sh"
    cat > "$dir/backup.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "$FAKE_BACKUP" = none ] && exit 0
echo snapshot > data/backups/ltd-snap.sqlite3
printf '%s\n' "$(pwd)/data/backups/ltd-snap.sqlite3" > "$BACKUP_PATH_FILE"
EOF
    chmod +x "$dir/deploy.sh" "$dir/backup.sh"
    echo 'TUDUDI_USER_EMAIL=dry-run@example.invalid' > "$dir/.env"
    echo live > "$dir/data/db/production.sqlite3"
    echo wal > "$dir/data/db/production.sqlite3-wal"
    : > "$dir/docker.log"
    set +e
    (cd "$dir" && PATH="$work/bin:$PATH" FAKE_LOG="$dir/docker.log" \
        FAKE_PULL="$2" FAKE_BACKUP="$3" ./deploy.sh 2.0.0 > "$dir/out.log" 2>&1)
    status=$?
    set -e
    cd "$dir"
}

echo "== update succeeds"
run ok ok yes
check "exit 0" '[ $status -eq 0 ]'
check "new version recorded" 'grep -q "LTD_VERSION=2.0.0" .env.version'
check "live database untouched" '[ "$(cat data/db/production.sqlite3)" = live ]'

echo "== new version never becomes ready"
run unready unready yes
check "exit 1" '[ $status -eq 1 ]'
check "snapshot restored as the database" '[ "$(cat data/db/production.sqlite3)" = snapshot ]'
check "no old WAL beside the restored file" '[ ! -e data/db/production.sqlite3-wal ]'
check "failed files kept" 'ls data/failed-*/production.sqlite3-wal >/dev/null'
check "previous version recorded" 'grep -q "LTD_VERSION=1.0.0" .env.version'
check "captured image retagged" 'grep -q "tag sha256:previous ghcr.io/danialmasghati/life-to-day:1.0.0" docker.log'

echo "== backup gives no snapshot"
run nosnap ok none
check "exit 2" '[ $status -eq 2 ]'
check "app never stopped" '! grep -q " stop app" docker.log'
check "live database untouched" '[ "$(cat data/db/production.sqlite3)" = live ]'

echo "== snapshot gone before rollback"
run vanish vanish yes
check "exit 1" '[ $status -eq 1 ]'
check "image not rolled back alone" '! grep -q "^docker tag" docker.log'
check "previous image not started" '! grep -q "pull never" docker.log'
check "live database and WAL left in place" '[ "$(cat data/db/production.sqlite3)" = live ] && [ -e data/db/production.sqlite3-wal ]'

cd "$root"
if [ "$failures" -ne 0 ]; then echo "$failures check(s) failed" >&2; exit 1; fi
echo "deploy dry run: all checks passed"
