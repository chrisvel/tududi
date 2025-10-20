#!/bin/bash
# Build Docker image with git commit hash

# Get the short git commit hash
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Get the image tag (default to latest if not specified)
IMAGE_TAG="${1:-latest}"

echo "Building Docker image with:"
echo "  Git commit: $GIT_COMMIT"
echo "  Image tag:  $IMAGE_TAG"
echo ""

# Create .git-commit-hash file for Docker build
echo "$GIT_COMMIT" > .git-commit-hash

# Build the Docker image
docker build \
    -t "chrisvel/tududi:$IMAGE_TAG" \
    .

echo ""
echo "Build complete! Image: chrisvel/tududi:$IMAGE_TAG"
echo "To run: docker run -p 3002:3002 chrisvel/tududi:$IMAGE_TAG"
