#!/bin/bash
# E2E UI test script with app bootstrapping
set -e

# Cleanup function to kill background processes and clean database
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  if [ ! -z "$BACKEND_PID" ]; then
    echo "Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
  fi
  if [ ! -z "$FRONTEND_PID" ]; then
    echo "Stopping frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
  fi

  # Clean up test database
  echo "🗑️  Cleaning test database..."
  cd backend
  sqlite3 db/development.sqlite3 "DELETE FROM users; DELETE FROM tasks; DELETE FROM projects; DELETE FROM areas; DELETE FROM notes; DELETE FROM tags; DELETE FROM inbox_items; DELETE FROM task_events; DELETE FROM api_tokens; DELETE FROM views; DELETE FROM roles; DELETE FROM permissions; DELETE FROM actions;" 2>/dev/null || true
  echo "✅ Database cleaned"
  cd ..
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

echo "🎭 Running E2E UI tests..."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies first..."
  pnpm install
fi

# Check if Playwright browsers are installed
if ! pnpm --filter tududi-e2e exec playwright --version >/dev/null 2>&1; then
  echo "🌐 Installing Playwright browsers..."
  pnpm --filter tududi-e2e run install-browsers
fi

# Set up test database and user
echo "📊 Setting up test database..."
cd backend

# Run migrations
echo "Running database migrations..."
NODE_ENV=development pnpm run db:migrate

# Create test user for E2E tests
echo "Creating test user (test@tududi.com)..."
E2E_EMAIL="${E2E_EMAIL:-test@tududi.com}"
E2E_PASSWORD="${E2E_PASSWORD:-password123}"

# Check if user already exists
USER_EXISTS=$(sqlite3 db/development.sqlite3 "SELECT COUNT(*) FROM users WHERE email='${E2E_EMAIL}';" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" = "0" ]; then
  echo "Creating user: ${E2E_EMAIL}"
  NODE_ENV=development node scripts/user-create.js "${E2E_EMAIL}" "${E2E_PASSWORD}"
  echo "✅ Test user created"
else
  echo "✅ Test user already exists"
fi

cd ..

# Start backend server
echo "🚀 Starting backend server..."
pnpm --filter tududi-backend run start > /tmp/backend-test.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Start frontend dev server
echo "🚀 Starting frontend dev server..."
pnpm --filter tududi-frontend run dev > /tmp/frontend-test.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:3002/api/health >/dev/null 2>&1; then
    echo "✅ Backend is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Backend failed to start. Check /tmp/backend-test.log"
    cat /tmp/backend-test.log
    exit 1
  fi
  sleep 1
done

# Wait for frontend to be ready
echo "⏳ Waiting for frontend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8080 >/dev/null 2>&1; then
    echo "✅ Frontend is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Frontend failed to start. Check /tmp/frontend-test.log"
    cat /tmp/frontend-test.log
    exit 1
  fi
  sleep 1
done

# Give servers a bit more time to fully initialize
sleep 2

# Determine test mode
TEST_MODE="${E2E_MODE:-headless}"

echo ""
case "$TEST_MODE" in
  ui)
    echo "🎭 Running tests in UI mode..."
    pnpm --filter tududi-e2e run test:ui
    ;;
  headed)
    echo "🎭 Running tests in headed mode..."
    pnpm --filter tududi-e2e exec playwright test --headed
    ;;
  *)
    echo "🎭 Running tests in headless mode..."
    pnpm --filter tududi-e2e run test
    ;;
esac

echo ""
echo "✅ All E2E tests passed!"
