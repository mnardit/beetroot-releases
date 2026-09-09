import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { execPath } from "node:process";
import { checkLicenses, checkNativeLicenses } from "../../../scripts/third-party-licenses.mjs";
import { buildDesktop } from "../../../scripts/build-desktop.mjs";

vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal();
  const spawn = vi.fn();
  return { ...original, spawnSync: spawn, default: { ...original.default, spawnSync: spawn } };
});
vi.mock("../../../scripts/third-party-licenses.mjs", () => {
  const api = { checkLicenses: vi.fn(), checkNativeLicenses: vi.fn() };
  return { ...api, default: api };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(checkLicenses).mockReturnValue({ reviewed: true });
  vi.mocked(spawnSync).mockReturnValue({ status: 0 });
});

describe("desktop build attribution gate", () => {
  it("preserves command arguments and checks native artifacts after a successful build", () => {
    const root = resolve("example project");
    const args = ["build", "--config", "unsigned config.json", "--", "--locked"];
    buildDesktop(root, args);
    expect(spawnSync).toHaveBeenCalledWith(
      execPath,
      [resolve(root, "node_modules/@tauri-apps/cli/tauri.js"), ...args],
      { cwd: root, stdio: "inherit" },
    );
    expect(checkNativeLicenses).toHaveBeenCalledWith(root, { reviewed: true });
    expect(checkLicenses.mock.invocationCallOrder[0]).toBeLessThan(
      spawnSync.mock.invocationCallOrder[0],
    );
    expect(spawnSync.mock.invocationCallOrder[0]).toBeLessThan(
      checkNativeLicenses.mock.invocationCallOrder[0],
    );
  });

  it("does not start a build with stale license inputs", () => {
    vi.mocked(checkLicenses).mockImplementation(() => {
      throw new Error("stale inventory");
    });
    expect(() => buildDesktop(resolve("example"), ["build"])).toThrow("stale inventory");
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it.each([
    { status: 1 },
    { status: null, signal: "SIGTERM" },
    { error: new Error("spawn failed") },
  ])("fails a broken build without claiming native verification", (result) => {
    vi.mocked(spawnSync).mockReturnValue(result);
    expect(() => buildDesktop(resolve("example"), ["build"])).toThrow();
    expect(checkNativeLicenses).not.toHaveBeenCalled();
  });

  it("does not return success when the produced native artifacts fail attribution", () => {
    vi.mocked(checkNativeLicenses).mockImplementation(() => {
      throw new Error("unexpected native DLL");
    });
    expect(() => buildDesktop(resolve("example"), ["build"])).toThrow("unexpected native DLL");
    expect(spawnSync).toHaveBeenCalledOnce();
  });

  it("rejects unrelated Tauri commands", () => {
    expect(() => buildDesktop(resolve("example"), ["dev"])).toThrow(
      "Expected the Tauri build command",
    );
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
