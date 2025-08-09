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
npm run backend:start &

echo "Starting frontend..."
npm run frontend:dev &

wait
