import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareVersion } from "../../../scripts/prepare-version.mjs";

describe("prepareVersion", () => {
  let root;
  const read = (path) => readFileSync(join(root, path), "utf8");
  const json = (path) => JSON.parse(read(path));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "beetroot-version-"));
    mkdirSync(join(root, "src-tauri"));
    writeFileSync(join(root, "package.json"), '{"name":"beetroot","version":"1.6.6"}');
    writeFileSync(
      join(root, "package-lock.json"),
      JSON.stringify({
        version: "1.6.6",
        packages: { "": { version: "1.6.6" }, "node_modules/example": { version: "2.0.0" } },
      }),
    );
    writeFileSync(join(root, "src-tauri/tauri.conf.json"), '{"version":"1.6.6"}');
    writeFileSync(
      join(root, "src-tauri/Cargo.toml"),
      '[package]\nname = "beetroot"\nversion = "1.6.6"\n\n[dependencies]\nexample = "2"\n',
    );
    writeFileSync(
      join(root, "src-tauri/Cargo.lock"),
      'version = 4\n\n[[package]]\nname = "beetroot"\nversion = "1.6.6"\n\n[[package]]\nname = "example"\nversion = "2.0.0"\n',
    );
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("updates root manifests and lock entries without changing dependencies", () => {
    prepareVersion(root, "1.6.7");
    expect(json("package.json").version).toBe("1.6.7");
    expect(json("src-tauri/tauri.conf.json").version).toBe("1.6.7");
    expect(json("package-lock.json").version).toBe("1.6.7");
    expect(json("package-lock.json").packages[""].version).toBe("1.6.7");
    expect(json("package-lock.json").packages["node_modules/example"].version).toBe("2.0.0");
    expect(read("src-tauri/Cargo.toml")).toContain('version = "1.6.7"');
    expect(read("src-tauri/Cargo.lock")).toContain('name = "beetroot"\nversion = "1.6.7"');
    expect(read("src-tauri/Cargo.lock")).toContain('name = "example"\nversion = "2.0.0"');
  });

  it.each(["", "v1.2.3", "1.2", "01.2.3", "1.2.3-rc.1", "1.2.3; echo unsafe"])(
    "rejects invalid stable version %s before writing",
    (version) => {
      expect(() => prepareVersion(root, version)).toThrow("Expected a stable");
      expect(json("package.json").version).toBe("1.6.6");
    },
  );

  it("does not partially update files when a lock entry is missing", () => {
    writeFileSync(join(root, "src-tauri/Cargo.lock"), "version = 4\n");
    expect(() => prepareVersion(root, "1.6.7")).toThrow("Missing beetroot");
    expect(json("package.json").version).toBe("1.6.6");
    expect(json("package-lock.json").version).toBe("1.6.6");
  });
});
