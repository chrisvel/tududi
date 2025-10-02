#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi

VERSION=$1

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: This script must be run inside a git repository." >&2
  exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

if [[ ! -f package.json ]]; then
  echo "Error: package.json not found in repository root ($REPO_ROOT)." >&2
  exit 1
fi

if git show-ref --tags --verify --quiet "refs/tags/$VERSION"; then
  echo "Error: Tag $VERSION already exists." >&2
  exit 1
fi

if [[ -n $(git status --porcelain) ]]; then
  echo "Error: Working tree has uncommitted changes. Please commit or stash them before continuing." >&2
  exit 1
fi

CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
if [[ "$CURRENT_VERSION" == "$VERSION" ]]; then
  echo "Error: package.json is already set to version $VERSION." >&2
  exit 1
fi

node - "$VERSION" <<'NODE'
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('No version provided to the Node helper.');
  process.exit(1);
}

const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
NODE

git add package.json

if git diff --cached --quiet; then
  echo "Error: No changes to commit after updating package.json." >&2
  exit 1
fi

COMMIT_MESSAGE="release: $VERSION"
git commit -m "$COMMIT_MESSAGE"

git tag -a "$VERSION" -m "Release $VERSION"

echo "Version updated to $VERSION."
echo "Created commit: $COMMIT_MESSAGE"
echo "Created annotated tag: $VERSION"
