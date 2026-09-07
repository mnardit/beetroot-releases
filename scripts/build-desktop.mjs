import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLicenses, checkNativeLicenses } from "./third-party-licenses.mjs";

export function buildDesktop(root, args) {
  if (args[0] !== "build") throw new Error("Expected the Tauri build command");
  const manifest = checkLicenses(root);
  const build = spawnSync(
    process.execPath,
    [resolve(root, "node_modules/@tauri-apps/cli/tauri.js"), ...args],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  if (build.error) throw build.error;
  if (build.status !== 0)
    throw new Error(`Tauri build failed (exit ${build.status ?? build.signal})`);

  // tauri-action uploads only after this command succeeds. Verify the downloaded
  // installer toolchains as well as the application dependencies before returning.
  checkNativeLicenses(root, manifest);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildDesktop(resolve(dirname(fileURLToPath(import.meta.url)), ".."), process.argv.slice(2));
  console.log("Desktop build and native third-party attribution verified");
}
