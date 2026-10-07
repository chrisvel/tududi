#!/bin/bash

# Prints the GitHub Release body for a version: its CHANGELOG.md section when
# that has any text, then GitHub's generated notes (merged PRs, new
# contributors, compare link), then the docker pull line.
#
# Used by docker-publish.yml when it cuts a release, and with --apply to
# rewrite the body of a release that already exists.
#
#   scripts/release-notes.sh 1.7.11            # print the notes
#   scripts/release-notes.sh --apply 1.7.11    # write them into the release
#
# Needs gh (authenticated) and the repository's tags fetched.

set -euo pipefail

APPLY=false
if [ "${1:-}" = "--apply" ]; then
  APPLY=true
  shift
fi

VERSION="${1:-}"
VERSION="${VERSION#v}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 [--apply] <version>" >&2
  exit 1
fi
TAG="v$VERSION"

if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "No tag $TAG" >&2
  exit 1
fi

# A stable release covers everything since the previous stable one, so the
# rc and dev tags in between don't cut its notes short. A pre-release covers
# everything since the tag before it. versionsort.suffix sorts 1.6.0-rc.6
# below 1.6.0 instead of above it.
case "$VERSION" in
  *-*) PATTERN='^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$' ;;
  *) PATTERN='^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
esac
PREVIOUS=$(git -c versionsort.suffix=- tag --list 'v*' --sort=-v:refname \
  | grep -E "$PATTERN" \
  | awk -v t="$TAG" 'found { print; exit } $0 == t { found = 1 }')

REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
set -- -f "tag_name=$TAG"
if [ -n "$PREVIOUS" ]; then
  set -- "$@" -f "previous_tag_name=$PREVIOUS"
fi
GENERATED=$(gh api "repos/$REPO/releases/generate-notes" "$@" --jq .body)

SECTION=""
if [ -f CHANGELOG.md ]; then
  SECTION=$(awk -v v="$VERSION" '
    $0 == "## " v { found = 1; next }
    found && /^## / { exit }
    found { print }
  ' CHANGELOG.md)
fi

NOTES=$(
  # Only a section with text counts; an empty heading is just blank lines
  if printf '%s' "$SECTION" | grep -q '[^[:space:]]'; then
    printf '%s\n\n' "$(printf '%s\n' "$SECTION" | sed -e '/./,$!d')"
  fi
  printf '%s\n\n' "$GENERATED"
  printf 'Docker image: `docker pull chrisvel/tududi:%s`\n' "$VERSION"
)

if [ "$APPLY" = "true" ]; then
  printf '%s\n' "$NOTES" | gh release edit "$TAG" --notes-file -
  echo "Updated $TAG (since ${PREVIOUS:-the first tag})" >&2
else
  printf '%s\n' "$NOTES"
fi
