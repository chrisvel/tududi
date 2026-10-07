#!/usr/bin/env bash
set -euo pipefail

# Cuts a release: bumps package.json, rolls the changelog for a stable
# release, commits and tags. Pushing the tag is what publishes the image and
# creates the GitHub Release (.github/workflows/docker-publish.yml).
#
#   ./scripts/create-version.sh              ask which kind (stable, rc or dev),
#                                            then which version (fix, minor,
#                                            major or the line in flight)
#   ./scripts/create-version.sh v1.5.0       take that version, no questions
#   ./scripts/create-version.sh --no-push    stop at the local commit and tag
#
# Pushing is the publish: the tag is what builds the image and cuts the
# GitHub Release, so this pushes the branch and the tag when it is done. The
# push is confirmed separately from the version, because it is the step that
# cannot be taken back.
#
# The version decides everything downstream: anything with a hyphen
# (v1.5.0-rc.1, v1.5.0-dev.3) is a pre-release, which never moves the :latest
# image tag and is flagged as a pre-release on GitHub. A plain v1.5.0 does
# both.

PUSH=true
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-push) PUSH=false; shift ;;
    -h|--help) echo "Usage: $0 [--no-push] [version]"; exit 0 ;;
    -*) echo "Error: unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -n "$VERSION" ]]; then
        echo "Error: unexpected argument: $1" >&2
        exit 1
      fi
      VERSION="$1"
      shift
      ;;
  esac
done

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


if [[ -z "$VERSION" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Error: no version given and no terminal to ask on." >&2
    exit 1
  fi

  # Shell assignments: LATEST_STABLE/RC/DEV, PROMOTE_STABLE, NEXT_RC/DEV (the
  # line in flight) and {STABLE,RC,DEV}_{FIX,MINOR,MAJOR}.
  eval "$(node scripts/version-plan.js)"

  printf '\nLatest release on each channel\n\n'
  printf '  stable  %s\n' "${LATEST_STABLE:-(none yet)}"
  printf '  rc      %s\n' "${LATEST_RC:-(none yet)}"
  printf '  dev     %s\n\n' "${LATEST_DEV:-(none yet)}"

  LABELS=()
  VERSIONS=()
  NOTES=()
  SEEN=' '
  add_choice() {
    # A bump that lands on a version already listed is not offered twice.
    [[ -n "$2" && "$SEEN" == *" $2 "* ]] && return 0
    LABELS+=("$1")
    VERSIONS+=("$2")
    NOTES+=("$3")
    SEEN="$SEEN$2 "
  }

  # Prints LABELS/VERSIONS/NOTES as a numbered menu and leaves the picked
  # position in PICKED.
  choose() {
    local count=${#LABELS[@]} i answer
    for ((i = 0; i < count; i++)); do
      printf '  %d) %-22s %-18s %s\n' "$((i + 1))" "${LABELS[$i]}" "${VERSIONS[$i]}" "${NOTES[$i]}"
    done
    printf '\n'
    # A bare `read` failing on Ctrl-D would exit silently under `set -e`.
    read -r -p "Choice [1-${count}]: " answer || { printf '\nCancelled.\n'; exit 1; }
    if [[ ! "$answer" =~ ^[0-9]+$ ]] || ((answer < 1 || answer > count)); then
      echo "Error: pick a number from 1 to ${count}." >&2
      exit 1
    fi
    PICKED=$((answer - 1))
  }

  printf 'What kind of release is this?\n\n'
  add_choice "stable" "" "moves :latest"
  add_choice "release candidate" "" "pre-release"
  add_choice "development" "" "pre-release"
  choose
  case "$PICKED" in
    0) KIND=STABLE ;;
    1) KIND=RC ;;
    *) KIND=DEV ;;
  esac

  LABELS=()
  VERSIONS=()
  NOTES=()
  SEEN=' '
  if [[ "$KIND" == STABLE ]]; then NOTE="moves :latest"; else NOTE="pre-release"; fi

  # Continuing the line already in flight comes first, so choice 1 is the
  # obvious "ship what is being tested" or "cut the next one of these". Fix,
  # minor and major are bumps of the last stable release, on any channel.
  if [[ -n "$PROMOTE_STABLE" ]]; then
    case "$KIND" in
      STABLE) add_choice "promote" "$PROMOTE_STABLE" "$NOTE" ;;
      RC) add_choice "current line" "$NEXT_RC" "$NOTE" ;;
      DEV) add_choice "current line" "$NEXT_DEV" "$NOTE" ;;
    esac
  fi
  for BUMP in FIX MINOR MAJOR; do
    BUMPED="${KIND}_${BUMP}"
    case "$BUMP" in
      FIX) add_choice "fix" "${!BUMPED}" "$NOTE" ;;
      MINOR) add_choice "minor" "${!BUMPED}" "$NOTE" ;;
      MAJOR) add_choice "major" "${!BUMPED}" "$NOTE" ;;
    esac
  done

  printf '\nWhich version?\n\n'
  choose
  SUGGESTED="${VERSIONS[$PICKED]}"

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

BRANCH=$(git rev-parse --abbrev-ref HEAD)

publish_hint() {
  echo "Publish it with:  git push origin $BRANCH && git push origin $VERSION"
}

if [[ "$PUSH" != "true" ]]; then
  echo
  publish_hint
  exit 0
fi

if [[ -t 0 ]]; then
  printf '\n'
  echo "Pushing publishes it: the tag builds the image and cuts the GitHub Release."
  read -r -p "Push $BRANCH and $VERSION to origin now? [Y/n]: " DO_PUSH || {
    printf '\nNot pushed.\n'
    publish_hint
    exit 1
  }
  case "$DO_PUSH" in
    ''|y|Y|yes|YES) ;;
    *) echo; echo "Not pushed."; publish_hint; exit 0 ;;
  esac
fi

WORKFLOW='Publish Docker image'

# Recorded before the push so we can tell a fresh run from one already in
# flight when we go looking for it below.
BASELINE_RUN_ID=""
if command -v gh >/dev/null 2>&1; then
  BASELINE_RUN_ID=$(gh run list --workflow "$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
fi

# Two pushes, deliberately. Sending the branch and the tag in one push (what
# --follow-tags does) has left the tag on the remote without GitHub raising a
# tag event, so nothing built: v1.5.0-rc.8 landed that way. Pushing the tag on
# its own is the ref update the publish workflow listens for.
git push origin "$BRANCH"
git push origin "$VERSION"

watch_hint() {
  echo "Watch it with:  gh run watch \$(gh run list --workflow '$WORKFLOW' --limit 1 --json databaseId --jq '.[0].databaseId')"
}

ORIGIN_URL=$(git remote get-url origin)
echo
case "$ORIGIN_URL" in
  *github.com*)
    SLUG=$(printf '%s' "$ORIGIN_URL" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
    echo "Pushed. Building the image and cutting the release:"
    echo "  https://github.com/$SLUG/actions"
    echo
    if command -v gh >/dev/null 2>&1; then
      # The tag push above is what triggers the workflow, but GitHub takes a
      # few seconds to register it as a run. Poll for one newer than whatever
      # was already there before we pushed, rather than watching a stale run.
      NEW_RUN_ID=""
      for _ in $(seq 1 20); do
        CANDIDATE=$(gh run list --workflow "$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
        if [[ -n "$CANDIDATE" && "$CANDIDATE" != "$BASELINE_RUN_ID" ]]; then
          NEW_RUN_ID="$CANDIDATE"
          break
        fi
        sleep 3
      done

      if [[ -n "$NEW_RUN_ID" ]]; then
        gh run watch "$NEW_RUN_ID"
      else
        echo "No new run showed up yet."
        watch_hint
      fi
    else
      watch_hint
    fi
    ;;
  *)
    echo "Pushed $BRANCH and $VERSION to $ORIGIN_URL."
    ;;
esac
