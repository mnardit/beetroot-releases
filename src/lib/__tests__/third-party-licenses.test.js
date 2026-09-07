import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { cwd } from "node:process";
import {
  cargoComponentIds,
  checkLicenses,
  checkNativeLicenses,
  inputDigests,
  licenseCheckPlugin,
  manifestPath,
  noticePath,
  renderNotices,
  requireComponents,
  sha256,
  validateManifest,
} from "../../../scripts/third-party-licenses.mjs";

vi.mock("node:child_process", () => {
  const execFileSync = vi.fn();
  return { execFileSync, default: { execFileSync } };
});

const fixtures = [];
const prefix = join(tmpdir(), "beetroot-license-test-");
const terms = "Copyright 2026 Example upstream contributor.\nExample test license terms.";
const termId = sha256(terms);
function inventory() {
  return {
    schemaVersion: 1,
    components: [
      {
        id: "npm:react@1.0.0",
        ecosystem: "npm",
        name: "react",
        version: "1.0.0",
        license: "MIT",
        source: "https://example.com/react/1.0.0",
        notices: [termId],
      },
    ],
    texts: [{ id: termId, sources: ["https://example.com/react/1.0.0/LICENSE"], text: terms }],
    assets: [
      { path: "src/fonts/OFL.txt", encoding: "utf8", sha256: sha256("Example font terms\n") },
    ],
  };
}
function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  writeFileSync(target, content);
}
function fixture() {
  const root = mkdtempSync(prefix);
  fixtures.push(root);
  write(
    root,
    "package-lock.json",
    JSON.stringify({
      version: "1.0.0",
      packages: {
        "": { name: "beetroot", version: "1.0.0" },
        "node_modules/react": { version: "1.0.0" },
      },
    }),
  );
  write(
    root,
    "src-tauri/Cargo.lock",
    'version = 4\n\n[[package]]\nname = "beetroot"\nversion = "1.0.0"\ndependencies = ["example"]\n',
  );
  write(
    root,
    "src-tauri/Cargo.toml",
    '[package]\nname = "beetroot"\nversion = "1.0.0"\n\n[dependencies]\nexample = "1"\n',
  );
  write(root, "src/fonts/OFL.txt", "Example font terms\n");
  mkdirSync(join(root, "public/model"), { recursive: true });
  write(
    root,
    "node_modules/react/package.json",
    JSON.stringify({ name: "react", version: "1.0.0" }),
  );
  const manifest = { ...inventory(), inputs: inputDigests(root) };
  write(root, manifestPath, JSON.stringify(manifest));
  write(root, noticePath, renderNotices(manifest));
  return root;
}
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  for (const root of fixtures.splice(0)) {
    const path = resolve(root);
    if (!path.startsWith(resolve(prefix)) || path.slice(resolve(prefix).length).includes(sep)) {
      throw new Error("Refusing to remove an unowned test directory");
    }
    rmSync(path, { recursive: true });
  }
});

describe("third-party attribution", () => {
  it("accepts reviewed texts and renders reproducibly", () => {
    const manifest = inventory();
    expect(() => validateManifest(manifest)).not.toThrow();
    expect(renderNotices(manifest)).toContain(terms);
    expect(renderNotices(manifest)).toBe(renderNotices(globalThis.structuredClone(manifest)));
  });

  it("rejects edited text even when it retains the old notice ID", () => {
    const manifest = inventory();
    manifest.texts[0].text += " changed";
    expect(() => validateManifest(manifest)).toThrow("Invalid or duplicate license text");
  });

  it("omits trailing horizontal whitespace without changing original text or its hash", () => {
    const manifest = inventory();
    const original = "Copyright 2026 Example.  \n\tIndented terms.\t\n \t\nEnd.";
    const id = sha256(original);
    manifest.texts[0] = { ...manifest.texts[0], id, text: original };
    manifest.components[0].notices = [id];
    expect(() => validateManifest(manifest)).not.toThrow();
    const rendered = renderNotices(manifest);
    expect(rendered).toContain("Copyright 2026 Example.\n\tIndented terms.\n\nEnd.");
    expect(rendered).not.toMatch(/[\t ]+$/m);
    expect(manifest.texts[0]).toMatchObject({ id, text: original });
    expect(sha256(manifest.texts[0].text)).toBe(id);
  });

  it("rejects generic copyright templates but permits the Apache appendix", () => {
    const manifest = inventory();
    const setTerms = (value) => {
      manifest.texts[0] = { ...manifest.texts[0], id: sha256(value), text: value };
      manifest.components[0].notices = [sha256(value)];
    };
    setTerms("Copyright (c) <year> <copyright holders>\nPermission is hereby granted");
    expect(() => validateManifest(manifest)).toThrow("Unresolved copyright template");
    setTerms("Copyright [yyyy] [name of copyright owner]");
    expect(() => validateManifest(manifest)).not.toThrow();
  });

  it("rejects missing component notices and duplicate identities", () => {
    const manifest = inventory();
    manifest.components[0].notices = ["missing"];
    expect(() => validateManifest(manifest)).toThrow("Missing license text");
    const duplicate = inventory();
    duplicate.components.push(globalThis.structuredClone(duplicate.components[0]));
    expect(() => validateManifest(duplicate)).toThrow("duplicate component");
  });

  it("checks the actual candidate notice artifact", () => {
    expect(checkLicenses(cwd()).components.length).toBeGreaterThan(400);
  });

  it("rejects a stale distribution file and regenerates it explicitly", () => {
    const root = fixture();
    write(root, noticePath, "stale");
    expect(() => checkLicenses(root)).toThrow("is stale");
    checkLicenses(root, { write: true });
    expect(() => checkLicenses(root)).not.toThrow();
  });

  it("ignores project-only version changes but detects Cargo dependency changes", () => {
    const root = fixture();
    const before = inputDigests(root);
    const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
    lock.version = "9.9.9";
    lock.packages[""].version = "9.9.9";
    write(root, "package-lock.json", JSON.stringify(lock));
    for (const path of ["src-tauri/Cargo.lock", "src-tauri/Cargo.toml"]) {
      write(
        root,
        path,
        readFileSync(join(root, path), "utf8").replace('version = "1.0.0"', 'version = "9.9.9"'),
      );
    }
    expect(inputDigests(root)).toEqual(before);
    write(
      root,
      "src-tauri/Cargo.toml",
      readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8").replace(
        'example = "1"',
        'example = "2"',
      ),
    );
    expect(() => checkLicenses(root)).toThrow("Dependency inputs changed");
  });

  it("rejects an npm dependency version absent from the inventory", () => {
    const root = fixture();
    const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
    lock.packages["node_modules/react"].version = "2.0.0";
    write(root, "package-lock.json", JSON.stringify(lock));
    expect(() => checkLicenses(root)).toThrow("npm:react@2.0.0");
  });

  it("normalizes line endings and detects changed or added licensed assets", () => {
    const root = fixture();
    write(root, "src/fonts/OFL.txt", "Example font terms\r\n");
    expect(() => checkLicenses(root)).not.toThrow();
    write(root, "src/fonts/OFL.txt", "Different terms\n");
    expect(() => checkLicenses(root)).toThrow("Licensed asset changed");
    write(root, "src/fonts/added.woff2", "new font");
    expect(() => checkLicenses(root)).toThrow("Licensed asset inventory changed");
  });

  it("detects rendered dev packages and distinct nested package versions", () => {
    const root = fixture();
    const plugin = licenseCheckPlugin();
    plugin.configResolved({ root });
    const build = (path) =>
      plugin.generateBundle(
        {},
        {
          main: {
            type: "chunk",
            modules: {
              [`\0${join(root, path, "index.js").replaceAll("\\", "/")}?commonjs-proxy`]: {
                renderedLength: 10,
              },
            },
          },
        },
      );
    expect(() => build("node_modules/react")).not.toThrow();
    write(
      root,
      "node_modules/dev-only/package.json",
      JSON.stringify({ name: "dev-only", version: "1.0.0" }),
    );
    expect(() => build("node_modules/dev-only")).toThrow("npm:dev-only@1.0.0");
    write(
      root,
      "node_modules/plugin/node_modules/react/package.json",
      JSON.stringify({ name: "react", version: "0.5.0" }),
    );
    expect(() => build("node_modules/plugin/node_modules/react")).toThrow("npm:react@0.5.0");
  });

  it("walks normal/build Cargo dependencies and rejects newly reachable crates", () => {
    const metadata = {
      resolve: {
        root: "root",
        nodes: [
          {
            id: "root",
            deps: [
              { pkg: "normal", dep_kinds: [{ kind: null }] },
              { pkg: "builder", dep_kinds: [{ kind: "build" }] },
              { pkg: "dev", dep_kinds: [{ kind: "dev" }] },
            ],
          },
        ],
      },
      packages: [
        { id: "root", name: "beetroot", version: "1.0.0", source: null },
        ...["normal", "builder", "dev"].map((id) => ({
          id,
          name: id,
          version: "1.0.0",
          source: "registry",
        })),
      ],
    };
    expect(cargoComponentIds(metadata)).toEqual(["cargo:normal@1.0.0", "cargo:builder@1.0.0"]);
    expect(() => requireComponents(inventory(), cargoComponentIds(metadata))).toThrow(
      "cargo:normal@1.0.0",
    );
  });

  it("pins CI toolchains and routes release uploads through native verification", () => {
    const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
    expect(readFileSync("rust-toolchain.toml", "utf8")).toContain(
      `channel = "${manifest.native.rust}"`,
    );
    for (const path of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
      const workflow = readFileSync(path, "utf8");
      expect(workflow).not.toContain("dtolnay/rust-toolchain@stable");
      expect(workflow).toContain(`dtolnay/rust-toolchain@${manifest.native.rust}`);
    }
    expect(readFileSync(".github/workflows/release.yml", "utf8")).toContain(
      "tauriScript: node scripts/build-desktop.mjs",
    );
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain("npm run build:desktop");
  });

  function nativeFixture() {
    const root = fixture();
    const manifest = inventory();
    manifest.native = {
      rust: "1.89.0",
      files: [{ kind: "tauri-cache", path: "native.dll", sha256: sha256("native bytes") }],
    };
    vi.stubEnv("LOCALAPPDATA", root);
    write(root, "tauri/native.dll", "native bytes");
    vi.mocked(execFileSync).mockImplementation((command) => {
      if (command === "rustc") return "rustc 1.89.0 (example)\n";
      if (command === "cargo")
        return JSON.stringify({
          resolve: { root: "root", nodes: [{ id: "root", deps: [] }] },
          packages: [{ id: "root", source: null }],
        });
      throw new Error(`Unexpected command: ${command}`);
    });
    return { root, manifest };
  }

  it("verifies native hashes using locked metadata without requiring a warm Cargo cache", () => {
    const { root, manifest } = nativeFixture();
    expect(() => checkNativeLicenses(root, manifest)).not.toThrow();
    const args = vi.mocked(execFileSync).mock.calls.find(([command]) => command === "cargo")[1];
    expect(args).toContain("--locked");
    expect(args).toContain("x86_64-pc-windows-msvc");
    expect(args).not.toContain("--offline");
  });

  it("rejects a changed native artifact before declaring its attribution verified", () => {
    const { root, manifest } = nativeFixture();
    write(root, "tauri/native.dll", "changed native bytes");
    expect(() => checkNativeLicenses(root, manifest)).toThrow("Native artifact changed");
  });

  it("rejects a different compiler before checking native files", () => {
    const { root, manifest } = nativeFixture();
    vi.mocked(execFileSync).mockReturnValueOnce("rustc 1.90.0 (example)\n");
    expect(() => checkNativeLicenses(root, manifest)).toThrow("Unreviewed Rust toolchain: 1.90.0");
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it("checks native attribution and current notices before MSIX staging", () => {
    const script = readFileSync("packaging/msix/build-msix.sh", "utf8");
    const preflight = script.indexOf(
      'node "$PROJECT_ROOT/scripts/third-party-licenses.mjs" --native',
    );
    expect(preflight).toBeGreaterThan(0);
    expect(preflight).toBeLessThan(script.indexOf('rm -rf "$MSIX_STAGING"'));
    expect(script).toContain(
      'cmp -s "$PROJECT_ROOT/THIRD_PARTY_LICENSES.txt" "$RELEASE_DIR/resources/THIRD_PARTY_LICENSES.txt"',
    );
  });
});
