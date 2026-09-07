#!/usr/bin/env bash
# Pre-bump gate. Runs source checks shared with CI. Fail fast.
# Usage: ./scripts/pre-release-check.sh
set -euo pipefail

cd "$(dirname "$0")/.."

step() { printf '\n=== %s ===\n' "$1"; }

step "1/8 versions in sync"
node scripts/check-versions.mjs

step "2/8 attribution and language model"
npm run check:licenses
npm run check:model

step "3/8 typecheck"
npx --no-install tsc --noEmit

step "4/8 lint"
npm run lint

step "5/8 prettier"
npm run format:check

step "6/8 frontend tests and coverage"
npm run test:coverage

step "7/8 rust fmt + clippy + tests"
(cd src-tauri && cargo fmt -- --check)
(cd src-tauri && cargo clippy --locked --all-targets -- -D warnings)
(cd src-tauri && cargo test --locked --all-targets)

step "8/8 done"
echo "Source checks passed. Installer builds and native smoke checks are still required."
