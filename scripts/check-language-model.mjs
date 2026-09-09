import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = realpathSync(tmpdir());
const outputDirectory = mkdtempSync(join(temporaryRoot, "beetroot-model-"));
const originalFetch = globalThis.fetch;
const browser = new Window();
const originalGlobals = new Map();
const requests = [];

try {
  await build({
    root,
    configFile: join(root, "vite.config.ts"),
    build: {
      outDir: outputDirectory,
      copyPublicDir: false,
      emptyOutDir: false,
      rollupOptions: {
        input: join(root, "src/lib/lang-detect.ts"),
        preserveEntrySignatures: "strict",
        output: {
          entryFileNames: "entry.mjs",
          chunkFileNames: "[name]-[hash].mjs",
        },
      },
    },
  });

  // Exercise the production bundle with real model assets; no network is allowed.
  const assets = {
    "/model/model.json": join(root, "public/model/model.json"),
    "/model/group1-shard1of1.bin": join(root, "public/model/group1-shard1of1.bin"),
  };
  globalThis.fetch = async (url) => {
    assert.ok(Object.hasOwn(assets, url), `Unexpected model request: ${url}`);
    requests.push(url);
    return new Response(readFileSync(assets[url]));
  };
  browser.fetch = globalThis.fetch;
  for (const key of ["window", "self", "document", "navigator"]) {
    originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key === "window" || key === "self" ? browser : browser[key],
    });
  }
  const { detectLanguage } = await import(pathToFileURL(join(outputDirectory, "entry.mjs")));
  const cases = [
    [
      "python",
      'import os\n\ndef list_files(path):\n    for name in os.listdir(path):\n        print(name)\n\nif __name__ == "__main__":\n    list_files(".")\n',
    ],
    [
      "rust",
      'use std::collections::HashMap;\n\nfn main() {\n    let mut counts: HashMap<&str, usize> = HashMap::new();\n    for word in ["one", "two", "one"] {\n        *counts.entry(word).or_insert(0) += 1;\n    }\n    println!("{:?}", counts);\n}\n',
    ],
    [
      "sql",
      "SELECT customer_id, COUNT(*) AS order_count, SUM(total) AS total_amount\nFROM orders\nWHERE created_at >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY customer_id\nHAVING COUNT(*) > 3\nORDER BY total_amount DESC;",
    ],
  ];
  for (const [expected, source] of cases) {
    assert.equal(await detectLanguage(source), expected, `Bundled model failed: ${expected}`);
  }
  assert.deepEqual(requests.sort(), Object.keys(assets).sort());
  console.log("Production language-model check passed: python, rust, sql; local assets only.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  await browser.happyDOM.close();
  const target = realpathSync(outputDirectory);
  if (dirname(target) !== temporaryRoot || !basename(target).startsWith("beetroot-model-")) {
    throw new Error("Refusing to remove an unexpected model-check directory");
  }
  rmSync(target, { recursive: true });
}
