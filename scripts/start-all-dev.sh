#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo
  echo "Stopping frontend and backend..."
  local pids
  pids="$(jobs -p || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    wait $pids 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

echo "Starting backend..."
pnpm --filter tududi-backend run start &

echo "Starting frontend..."
pnpm --filter tududi-frontend run dev &

wait
