#!/usr/bin/env bash
#
# Start tududi dev servers on separate ports from production.
#
#   Production (Docker):  backend=3002, frontend via Traefik
#   Development (local):  backend=3003, frontend=8081
#
# The dev instance uses the same development.sqlite3 database.
# Press Ctrl+C to stop both servers.
#
set -euo pipefail

export NODE_ENV=development
export PORT=3003
export FRONTEND_PORT=8081
export BACKEND_URL=http://localhost:3003
export FRONTEND_ORIGIN=http://localhost:8081

echo ""
echo "================================================"
echo "  tududi DEV instance"
echo "  Backend:  http://localhost:$PORT"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "================================================"
echo ""

cleanup() {
  echo ""
  echo "Stopping dev servers..."
  local pids
  pids="$(jobs -p || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    wait $pids 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

echo "Starting dev backend on port $PORT..."
(cd backend && PORT=$PORT nodemon app.js) &

echo "Starting dev frontend on port $FRONTEND_PORT..."
FRONTEND_PORT=$FRONTEND_PORT BACKEND_URL=$BACKEND_URL FRONTEND_ORIGIN=$FRONTEND_ORIGIN \
  npx webpack serve --config webpack.config.js --hot &

wait
