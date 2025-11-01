#!/bin/bash

# Simple Docker build test script with version tagging
set -e

VERSION=${1:-"latest"}
IMAGE_NAME="tududi-test:$VERSION"
CONTAINER_NAME="tududi-test-$VERSION"
TEST_PORT="3003"

# Get git commit hash
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "🐳 Testing Docker build for version: $VERSION"
echo "📝 Git commit: $GIT_COMMIT"

# Cleanup existing
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Create .git-commit-hash file for Docker build
echo "$GIT_COMMIT" > .git-commit-hash

# Build image with version tag
echo "📦 Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

# Test container
echo "🚀 Starting container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$TEST_PORT:3002" \
  -e TUDUDI_USER_EMAIL=test@example.com \
  -e TUDUDI_USER_PASSWORD=testpass123 \
  -e NODE_ENV=production \
  "$IMAGE_NAME"

# Wait and test health
echo "⏳ Waiting for startup..."
sleep 15

if curl -f "http://localhost:$TEST_PORT/api/health" > /dev/null 2>&1; then
  echo "✅ Health check passed for $VERSION!"
  echo "🌐 App running at http://localhost:$TEST_PORT"
  
  read -p "Keep running? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    docker stop "$CONTAINER_NAME"
    docker rm "$CONTAINER_NAME"
    echo "🧹 Cleaned up"
  else
    echo "🏃 Container $CONTAINER_NAME still running"
  fi
else
  echo "❌ Health check failed for $VERSION"
  docker logs "$CONTAINER_NAME"
  docker stop "$CONTAINER_NAME"
  docker rm "$CONTAINER_NAME"
  exit 1
fi