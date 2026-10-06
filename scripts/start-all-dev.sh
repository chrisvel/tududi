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

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return 0

  echo "Port ${port} in use, stopping PID(s): $(echo $pids | tr '\n' ' ')"
  kill $pids 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.3
    pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
    [ -z "$pids" ] && return 0
  done
  kill -9 $pids 2>/dev/null || true
}

if command -v lsof >/dev/null 2>&1; then
  free_port 8080
  free_port 3002
else
  echo "lsof not found, skipping port cleanup"
fi

echo "Starting backend..."
npm run backend:start &

echo "Starting frontend..."
npm run frontend:dev &

wait
