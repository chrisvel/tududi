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

# Build the docker image with the version tag
echo "Building docker image: chrisvel/tududi:$docker_tag"
docker build -t chrisvel/tududi:"$docker_tag" .

# Build the docker image with the latest tag
echo "Building docker image: chrisvel/tududi:latest"
docker build -t chrisvel/tududi:latest .

# Push the docker image with the version tag
echo "Pushing docker image: chrisvel/tududi:$docker_tag"
docker push chrisvel/tududi:"$docker_tag"

# Push the docker image with the latest tag
echo "Pushing docker image: chrisvel/tududi:latest"
docker push chrisvel/tududi:latest

echo "Deployment complete!"