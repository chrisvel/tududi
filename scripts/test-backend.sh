#!/bin/bash
# Backend test script
set -e

echo "🧪 Running backend tests..."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies first..."
  pnpm install
fi

# Run unit tests
echo "🔬 Running unit tests..."
pnpm run backend:test:unit

# Run integration tests
echo "🔗 Running integration tests..."
pnpm run backend:test:integration

echo "✅ All backend tests passed!"
