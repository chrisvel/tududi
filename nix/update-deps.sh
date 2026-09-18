#!/usr/bin/env bash
set -eu

cd "$(dirname "$0")/.."

HASH=$(nix run nixpkgs#prefetch-npm-deps -- package-lock.json 2>/dev/null)

if [ -z "$HASH" ]; then
  echo "Failed to compute npm deps hash" >&2
  exit 1
fi

echo "Computed hash: $HASH"

sed -i "s|hash = \"sha256-.*\"|hash = \"$HASH\"|" nix/tududi.nix

echo "Updated hash in nix/tududi.nix"
