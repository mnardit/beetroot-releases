import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function prepareVersion(root, version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("Expected a stable X.Y.Z version without leading zeroes");
  }

  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const updates = new Map();
  for (const path of ["package.json", "package-lock.json", "src-tauri/tauri.conf.json"]) {
    const data = JSON.parse(read(path));
    data.version = version;
    if (path === "package-lock.json") {
      if (!data.packages?.[""]) throw new Error("Missing root package in package-lock.json");
      data.packages[""].version = version;
    }
    updates.set(path, `${JSON.stringify(data, null, 2)}\n`);
  }

  const cargo = read("src-tauri/Cargo.toml");
  const packageSection = /(^\[package\]\r?\n[\s\S]*?^version\s*=\s*")[^"]+("[^\r\n]*$)/m;
  if (!packageSection.test(cargo)) throw new Error("Missing Cargo package version");
  updates.set(
    "src-tauri/Cargo.toml",
    cargo.replace(packageSection, (_match, prefix, suffix) => `${prefix}${version}${suffix}`),
  );

  const lock = read("src-tauri/Cargo.lock");
  const rootPackage = /(^\[\[package\]\]\r?\nname = "beetroot"\r?\nversion = ")[^"]+(")/m;
  if (!rootPackage.test(lock)) throw new Error("Missing beetroot package in Cargo.lock");
  updates.set(
    "src-tauri/Cargo.lock",
    lock.replace(rootPackage, (_match, prefix, suffix) => `${prefix}${version}${suffix}`),
  );

  // Validate every input before writing any version-bearing file.
  for (const [path, contents] of updates) writeFileSync(resolve(root, path), contents);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareVersion(process.cwd(), process.argv[2] ?? "");
}
