#!/bin/bash

# Simple Docker build test script with version tagging
set -e

VERSION=${1:-"latest"}
IMAGE_NAME="TaskNoteTaker-test:$VERSION"
CONTAINER_NAME="TaskNoteTaker-test-$VERSION"
TEST_PORT="3003"

echo "🐳 Testing Docker build for version: $VERSION"

# Cleanup existing
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Build image with version tag
echo "📦 Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

# Test container
echo "🚀 Starting container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$TEST_PORT:3002" \
  -e TASKNOTETAKER_USER_EMAIL=test@example.com \
  -e TASKNOTETAKER_USER_PASSWORD=testpass123 \
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