#!/bin/bash
# Build MSIX package for Microsoft Store submission
# Prerequisites: npm run build:desktop (verified release build must exist)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RELEASE_DIR="$PROJECT_ROOT/src-tauri/target/release"
MSIX_STAGING="$PROJECT_ROOT/src-tauri/target/msix-staging"
ICONS_DIR="$PROJECT_ROOT/src-tauri/icons"
MAKEAPPX="/c/Program Files (x86)/Windows Kits/10/bin/10.0.26100.0/x64/MakeAppx.exe"
MAKEPRI="/c/Program Files (x86)/Windows Kits/10/bin/10.0.26100.0/x64/MakePri.exe"

# Derive 4-part version from package.json (3-part) + ".0"
THREE_PART=$(cd "$PROJECT_ROOT" && node -p "require('./package.json').version")
VERSION="${THREE_PART}.0"
echo "Building MSIX for version $VERSION"
OUTPUT="$PROJECT_ROOT/src-tauri/target/release/bundle/Beetroot_${VERSION}_x64.msix"

echo "=== Building MSIX package ==="

# Check prerequisites
if [ ! -f "$RELEASE_DIR/beetroot.exe" ]; then
  echo "ERROR: Release build not found. Run 'npm run build:desktop' first."
  exit 1
fi

if [ ! -f "$MAKEAPPX" ]; then
  echo "ERROR: MakeAppx.exe not found at $MAKEAPPX"
  exit 1
fi

# Verify attribution before replacing staging.
node "$PROJECT_ROOT/scripts/third-party-licenses.mjs" --native
if [ ! -f "$RELEASE_DIR/resources/THIRD_PARTY_LICENSES.txt" ] || ! cmp -s "$PROJECT_ROOT/THIRD_PARTY_LICENSES.txt" "$RELEASE_DIR/resources/THIRD_PARTY_LICENSES.txt"; then
  echo "ERROR: Release third-party notices are missing or stale. Rebuild with npm run build:desktop."
  exit 1
fi

rm -rf "$MSIX_STAGING"
mkdir -p "$MSIX_STAGING/images"

echo "Copying release files..."
# Copy main executable
cp "$RELEASE_DIR/beetroot.exe" "$MSIX_STAGING/Beetroot.exe"

# Copy WebView2Loader.dll if present
if [ -f "$RELEASE_DIR/WebView2Loader.dll" ]; then
  cp "$RELEASE_DIR/WebView2Loader.dll" "$MSIX_STAGING/"
fi

# Copy resources (Tauri frontend assets)
if [ -d "$RELEASE_DIR/resources" ]; then
  cp -r "$RELEASE_DIR/resources" "$MSIX_STAGING/"
fi

echo "Copying icons..."
cp "$ICONS_DIR/StoreLogo.png" "$MSIX_STAGING/images/"
cp "$ICONS_DIR/Square44x44Logo.png" "$MSIX_STAGING/images/"
cp "$ICONS_DIR/Square150x150Logo.png" "$MSIX_STAGING/images/"
cp "$ICONS_DIR/Square310x310Logo.png" "$MSIX_STAGING/images/"

echo "Copying AppxManifest.xml..."
STAGED_MANIFEST="$MSIX_STAGING/AppxManifest.xml"
cp "$SCRIPT_DIR/AppxManifest.xml" "$STAGED_MANIFEST"

# Anchor the substitution to the <Identity ... /> block so MinVersion in
# <TargetDeviceFamily> is never touched. "Version=" is a substring of
# "MinVersion=", so an unanchored sed would silently rewrite the OS minimum
# build to the app version (e.g. MinVersion="1.6.6.0").
sed -i "/<Identity/,/ProcessorArchitecture/ s/Version=\"[0-9][0-9.]*\"/Version=\"$VERSION\"/" "$STAGED_MANIFEST"

MANIFEST_VERSION=$(node -e "const fs=require('fs'); const xml=fs.readFileSync(process.argv[1],'utf8'); const m=xml.match(/<Identity[\s\S]*?Version=\"([^\"]+)\"/); if(!m) process.exit(1); console.log(m[1]);" "$STAGED_MANIFEST")
if [ "$MANIFEST_VERSION" != "$VERSION" ]; then
  echo "ERROR: staged AppxManifest.xml Identity Version is $MANIFEST_VERSION, expected $VERSION"
  exit 1
fi

# Belt-and-suspenders: confirm the OS-version attributes were not collateral
# damage from the sed above. Compare against the source manifest verbatim.
ORIGINAL_MIN=$(grep -oE 'MinVersion="[^"]+"' "$SCRIPT_DIR/AppxManifest.xml" | head -1)
ORIGINAL_MAX=$(grep -oE 'MaxVersionTested="[^"]+"' "$SCRIPT_DIR/AppxManifest.xml" | head -1)
STAGED_MIN=$(grep -oE 'MinVersion="[^"]+"' "$STAGED_MANIFEST" | head -1)
STAGED_MAX=$(grep -oE 'MaxVersionTested="[^"]+"' "$STAGED_MANIFEST" | head -1)
if [ "$ORIGINAL_MIN" != "$STAGED_MIN" ] || [ "$ORIGINAL_MAX" != "$STAGED_MAX" ]; then
  echo "ERROR: TargetDeviceFamily attributes were corrupted by the manifest patcher"
  echo "  source : $ORIGINAL_MIN $ORIGINAL_MAX"
  echo "  staged : $STAGED_MIN $STAGED_MAX"
  exit 1
fi
echo "Manifest version matches: $VERSION (Identity-scoped, TargetDeviceFamily preserved)"

# Wide-tile guard: AppxManifest.xml must not declare Wide310x150Logo unless a
# real 310x150 wide tile asset ships with the package. The icon set is square
# only — pointing Wide310x150Logo at a 310x310 asset triggers WACK warnings
# and may cause Microsoft Store rejection on dimension mismatch.
if grep -q 'Wide310x150Logo=' "$STAGED_MANIFEST"; then
  echo "ERROR: AppxManifest.xml declares Wide310x150Logo but no 310x150 asset exists."
  echo "  Either ship a real Wide310x150Logo.png in icons/ and copy it here,"
  echo "  or remove the attribute from packaging/msix/AppxManifest.xml."
  exit 1
fi
echo "Wide tile declaration: absent (correct)"

# MakePri presence + success guards. The previous `2>/dev/null || true`
# suffix masked tool-not-found and config errors — the resulting package
# silently shipped without resources.pri, which only surfaced at install
# time on customer machines.
if [ ! -f "$MAKEPRI" ]; then
  echo "ERROR: MakePri.exe not found at $MAKEPRI"
  exit 1
fi

echo "Generating resources.pri..."
# Create priconfig
cd "$MSIX_STAGING"
# Git Bash otherwise rewrites SDK switches such as /cf into filesystem paths.
MSYS2_ARG_CONV_EXCL="*" "$MAKEPRI" createconfig /cf priconfig.xml /dq en-US /o
MSYS2_ARG_CONV_EXCL="*" "$MAKEPRI" new /pr . /cf priconfig.xml /of resources.pri /o
rm -f priconfig.xml

if [ ! -f "$MSIX_STAGING/resources.pri" ]; then
  echo "ERROR: resources.pri was not generated"
  exit 1
fi
echo "resources.pri generated"

echo "Creating MSIX package..."
MSYS2_ARG_CONV_EXCL="*" "$MAKEAPPX" pack /v /h SHA256 /d "$(cygpath -w "$MSIX_STAGING")" /p "$(cygpath -w "$OUTPUT")" /o

echo ""
echo "=== MSIX package created ==="
echo "Output: $(cygpath -w "$OUTPUT")"
echo ""
echo "To install LOCALLY (correct — exercises WindowsApps StartupTask path):"
echo "  Add-AppPackage -Path '$(cygpath -w "$OUTPUT")'"
echo ""
echo "Sanity check after install (process path must contain 'WindowsApps'):"
echo "  (Get-Process Beetroot).Path"
echo ""
echo "DO NOT use 'Add-AppxPackage -Register .\\AppxManifest.xml' — that runs from"
echo "target\\release\\, is_store_package() returns false, autostart IPC silently"
echo "takes the Run-key fallback. The MSIX startup-task path goes untested."
echo ""
echo "To submit to Store:"
echo "  Upload $(cygpath -w "$OUTPUT") to Partner Center (unsigned — Microsoft signs it)"
