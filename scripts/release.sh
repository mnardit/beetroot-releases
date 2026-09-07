#!/usr/bin/env bash
# Prepare a release locally. Publication is handled by the tag-triggered workflow.
set -euo pipefail

if [[ $# -ne 1 ]] || ! [[ "$1" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Usage: bash scripts/release.sh X.Y.Z" >&2
  exit 1
fi

VERSION="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain -- package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json packaging/msix/AppxManifest.xml)" ]]; then
  echo "Version-bearing files must be committed before preparing another release." >&2
  exit 1
fi

bash scripts/pre-release-check.sh

# Preserve the Windows compatibility attributes when updating the MSIX identity.
MSIX_VERSION="${VERSION}.0"
ORIGINAL_MIN=$(grep -oE 'MinVersion="[^"]+"' packaging/msix/AppxManifest.xml | head -1)
ORIGINAL_MAX=$(grep -oE 'MaxVersionTested="[^"]+"' packaging/msix/AppxManifest.xml | head -1)
node scripts/prepare-version.mjs "$VERSION"
sed -i "/<Identity/,/ProcessorArchitecture/ s/Version=\"[0-9][0-9.]*\"/Version=\"$MSIX_VERSION\"/" packaging/msix/AppxManifest.xml
NEW_MIN=$(grep -oE 'MinVersion="[^"]+"' packaging/msix/AppxManifest.xml | head -1)
NEW_MAX=$(grep -oE 'MaxVersionTested="[^"]+"' packaging/msix/AppxManifest.xml | head -1)
if [[ "$ORIGINAL_MIN" != "$NEW_MIN" || "$ORIGINAL_MAX" != "$NEW_MAX" ]]; then
  echo "MSIX TargetDeviceFamily changed unexpectedly. Review the local diff." >&2
  exit 1
fi

node scripts/check-versions.mjs
echo "Version $VERSION prepared locally. Update CHANGELOG.md, review the diff and open a PR."
echo "This script does not commit, push, sign installers or publish releases."
