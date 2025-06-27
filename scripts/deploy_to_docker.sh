#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

# Check if version argument is provided
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 version (e.g., v0.38)"
  exit 1
fi

version="$1"

# Ensure that the version string starts with 'v'
if [[ "$version" != v* ]]; then
  echo "Error: Version must start with 'v'"
  exit 1
fi

# Remove the leading 'v' for the docker tag if needed (e.g., v0.38 becomes 0.38)
docker_tag="${version:1}"

# Create git tag
echo "Creating git tag: $version"
# git tag "$version"

# Ensure buildx is available and setup a new builder if needed
echo "Setting up Docker buildx for multi-architecture builds"
docker buildx ls | grep -q mybuilder || docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap

# Build and push multi-architecture images (AMD64, ARM64) with the version tag
echo "Building and pushing multi-architecture docker image: chrisvel/tududi:$docker_tag"
docker buildx build --platform linux/amd64,linux/arm64 \
  -t chrisvel/tududi:"$docker_tag" \
  --push .

# Build and push multi-architecture images (AMD64, ARM64) with the latest tag
echo "Building and pushing multi-architecture docker image: chrisvel/tududi:latest"
docker buildx build --platform linux/amd64,linux/arm64 \
  -t chrisvel/tududi:latest \
  --push .

echo "Deployment complete!"
