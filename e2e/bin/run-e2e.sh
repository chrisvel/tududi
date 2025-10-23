#!/usr/bin/env bash
set -euo pipefail

# Config
APP_URL_DEFAULT="http://localhost:8080"
BACKEND_URL="http://localhost:3002"
BACKEND_HEALTH="${BACKEND_URL}/api/health"
FRONTEND_URL="${APP_URL:-$APP_URL_DEFAULT}"

# Colors
red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

# Ensure dependencies in e2e/
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
E2E_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$E2E_DIR/.." && pwd)"

cd "$E2E_DIR"
if [ ! -f package.json ]; then
  red "e2e/package.json not found"
  exit 1
fi

# Install e2e deps and browsers
if [ ! -d node_modules ]; then
  yellow "Installing e2e dependencies..."
  npm ci
fi

if ! npx playwright --version >/dev/null 2>&1; then
  yellow "Installing Playwright browsers..."
  npm run install-browsers
fi

# Start backend and frontend
cd "$ROOT_DIR"

# Remove old test database to start fresh
yellow "Removing old test database..."
rm -f backend/db/test.sqlite3

yellow "Starting backend with test database..."
(cd backend && \
NODE_ENV=test \
PORT=3002 \
DB_FILE=db/test.sqlite3 \
TUDUDI_USER_EMAIL="${E2E_EMAIL:-test@tududi.com}" \
TUDUDI_USER_PASSWORD="${E2E_PASSWORD:-password123}" \
SEQUELIZE_LOGGING=false \
./cmd/start.sh) >/dev/null 2>&1 &
BACKEND_PID=$!

cleanup() {
  yellow "Stopping background processes..."
  # Attempt graceful group termination
  if [ -n "${FRONTEND_PID:-}" ]; then kill -TERM -$FRONTEND_PID >/dev/null 2>&1 || true; fi
  if [ -n "${BACKEND_PID:-}" ]; then kill -TERM -$BACKEND_PID >/dev/null 2>&1 || true; fi

  # Kill by known ports (best-effort)
  if command -v lsof >/dev/null 2>&1; then
    FRONTEND_PIDS_KILL=$(lsof -ti tcp:8080 || true)
    BACKEND_PIDS_KILL=$(lsof -ti tcp:3002 || true)
    if [ -n "${FRONTEND_PIDS_KILL:-}" ]; then kill ${FRONTEND_PIDS_KILL} >/dev/null 2>&1 || true; fi
    if [ -n "${BACKEND_PIDS_KILL:-}" ]; then kill ${BACKEND_PIDS_KILL} >/dev/null 2>&1 || true; fi
  fi

  # Direct child processes as fallback
  if [ -n "${FRONTEND_PID:-}" ] && ps -p $FRONTEND_PID >/dev/null 2>&1; then kill $FRONTEND_PID || true; fi
  if [ -n "${BACKEND_PID:-}" ] && ps -p $BACKEND_PID >/dev/null 2>&1; then kill $BACKEND_PID || true; fi

  # Remove test database
  yellow "Cleaning up test database..."
  rm -f "$ROOT_DIR/backend/db/test.sqlite3"
}
trap cleanup EXIT INT TERM

# Wait for backend health
yellow "Waiting for backend to be ready at ${BACKEND_HEALTH}..."
for i in {1..60}; do
  if curl -sf "$BACKEND_HEALTH" >/dev/null; then
    green "Backend is ready"
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    red "Backend did not become ready in time"
    exit 1
  fi
done

yellow "Starting frontend dev server..."
npm run frontend:dev >/dev/null 2>&1 &
FRONTEND_PID=$!

# Wait for frontend
yellow "Waiting for frontend at ${FRONTEND_URL}..."
for i in {1..60}; do
  if curl -sf "$FRONTEND_URL" >/dev/null; then
    green "Frontend is ready"
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    red "Frontend did not become ready in time"
    exit 1
  fi
done

# Run tests
cd "$E2E_DIR"

yellow "Running Playwright tests..."
APP_URL="$FRONTEND_URL" \
E2E_EMAIL="${E2E_EMAIL:-test@tududi.com}" \
E2E_PASSWORD="${E2E_PASSWORD:-password123}" \
bash -c '
  if [ "${E2E_MODE:-}" = "ui" ]; then
    npm run test:ui
  elif [ "${E2E_MODE:-}" = "headed" ]; then
    # Respect E2E_SLOWMO and run only Firefox sequentially
    npx playwright test --headed --project=Firefox --workers=1
  else
    npx playwright test --workers=5
  fi
'
