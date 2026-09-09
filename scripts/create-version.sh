#!/usr/bin/env bash
set -euo pipefail

# Cuts a release: bumps package.json, rolls the changelog for a stable
# release, commits and tags. Pushing the tag is what publishes the image and
# creates the GitHub Release (.github/workflows/docker-publish.yml).
#
#   ./scripts/create-version.sh              ask which kind, propose the number
#   ./scripts/create-version.sh v1.5.0       take that version, no questions
#
# The version decides everything downstream: anything with a hyphen
# (v1.5.0-rc.1, v1.5.0-dev.3) is a pre-release, which never moves the :latest
# image tag and is flagged as a pre-release on GitHub. A plain v1.5.0 does
# both.

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [version]" >&2
  exit 1
fi

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

if [[ -n $(git status --porcelain) ]]; then
  echo "Error: Working tree has uncommitted changes. Please commit or stash them before continuing." >&2
  exit 1
fi

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Error: no version given and no terminal to ask on." >&2
    exit 1
  fi

  # Shell assignments: LATEST_STABLE/RC/DEV and NEXT_STABLE/RC/DEV.
  eval "$(node scripts/version-plan.js)"

  printf '\nLatest release on each channel\n\n'
  printf '  stable  %s\n' "${LATEST_STABLE:-(none yet)}"
  printf '  rc      %s\n' "${LATEST_RC:-(none yet)}"
  printf '  dev     %s\n\n' "${LATEST_DEV:-(none yet)}"

  printf 'What kind of release is this?\n\n'
  printf '  1) stable             %-18s moves :latest\n' "$NEXT_STABLE"
  printf '  2) release candidate  %-18s pre-release\n' "$NEXT_RC"
  printf '  3) development        %-18s pre-release\n\n' "$NEXT_DEV"

  # A bare `read` failing on Ctrl-D would exit silently under `set -e`.
  read -r -p 'Choice [1-3]: ' CHOICE || { printf '\nCancelled.\n'; exit 1; }
  case "$CHOICE" in
    1) SUGGESTED="$NEXT_STABLE" ;;
    2) SUGGESTED="$NEXT_RC" ;;
    3) SUGGESTED="$NEXT_DEV" ;;
    *) echo "Error: pick 1, 2 or 3." >&2; exit 1 ;;
  esac

  printf '\n'
  read -r -p "Create ${SUGGESTED}? [Y/n, or type another version]: " ANSWER || { printf '\nCancelled.\n'; exit 1; }
  case "$ANSWER" in
    ''|y|Y|yes|YES) VERSION="$SUGGESTED" ;;
    n|N|no|NO) echo "Nothing done."; exit 0 ;;
    *) VERSION="$ANSWER" ;;
  esac
fi

if [[ "$VERSION" != v* ]]; then
  echo "Error: Version must start with 'v'" >&2
  exit 1
fi

# Matches what the publish workflow will accept once the leading v is dropped.
if ! printf '%s' "${VERSION#v}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'; then
  echo "Error: '$VERSION' is not a version like v1.5.0 or v1.5.0-rc.1" >&2
  exit 1
fi

if git show-ref --tags --verify --quiet "refs/tags/$VERSION"; then
  echo "Error: Tag $VERSION already exists." >&2
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

# Only a stable release closes the changelog. Pre-releases are cut too often
# to justify a section each, and the release workflow gives them generated
# notes instead; whatever is under Unreleased keeps accumulating until the
# stable release that ships it.
case "${VERSION#v}" in
  *-*) : ;;
  *)
    node - "${VERSION#v}" <<'NODE'
const fs = require('fs');

const version = process.argv[2];
const file = 'CHANGELOG.md';
if (!fs.existsSync(file)) process.exit(0);

const text = fs.readFileSync(file, 'utf8');
const heading = '## Unreleased';
const at = text.indexOf(heading);
if (at === -1) {
  console.error(`No "${heading}" section in ${file}; leaving it alone.`);
  process.exit(0);
}

const body = text.slice(at + heading.length).replace(/^\s*/, '');
const nextHeading = body.indexOf('\n## ');
const unreleased = (nextHeading === -1 ? body : body.slice(0, nextHeading)).trim();
if (!unreleased) {
  console.error(`"${heading}" is empty; leaving ${file} alone.`);
  process.exit(0);
}

fs.writeFileSync(
  file,
  text.slice(0, at) + `${heading}\n\n## ${version}` + text.slice(at + heading.length)
);
console.error(`Rolled ${heading} into ## ${version} in ${file}.`);
NODE
    git add CHANGELOG.md
    ;;
esac

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
echo
echo "Publish it with:  git push origin main --follow-tags"
