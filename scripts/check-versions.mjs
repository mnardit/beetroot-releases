#!/usr/bin/env node
// Verifies version sync across 5 manifests. Exits non-zero with a list of
// drifts. Run from repo root.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), "utf8");

const pkg = JSON.parse(read("package.json")).version;
const lock = JSON.parse(read("package-lock.json")).version;
const tauri = JSON.parse(read("src-tauri/tauri.conf.json")).version;
const cargoMatch = read("src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m);
if (!cargoMatch) {
  console.error("FAIL: Cargo.toml has no top-level version");
  process.exit(1);
}
const cargo = cargoMatch[1];

const msixMatch = read("packaging/msix/AppxManifest.xml").match(
  /<Identity\b[^>]*\bVersion="([^"]+)"/,
);
if (!msixMatch) {
  console.error("FAIL: AppxManifest.xml has no Identity Version");
  process.exit(1);
}
const msix = msixMatch[1];

const expected = `${pkg}.0`;
const drifts = [];
if (lock !== pkg) drifts.push(`package-lock.json: ${lock} (expected ${pkg})`);
if (tauri !== pkg) drifts.push(`tauri.conf.json: ${tauri} (expected ${pkg})`);
if (cargo !== pkg) drifts.push(`Cargo.toml: ${cargo} (expected ${pkg})`);
if (msix !== expected) drifts.push(`AppxManifest.xml Identity: ${msix} (expected ${expected})`);

if (drifts.length) {
  console.error(`FAIL: version drift (package.json = ${pkg}):`);
  for (const d of drifts) console.error(`  - ${d}`);
  process.exit(1);
}
console.log(`OK: all 5 manifests at ${pkg} (MSIX ${expected})`);
