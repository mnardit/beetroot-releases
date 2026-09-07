import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isIsolatedBuild, isStoreBuild } from "../../lib/tauri";
import { useUpdater } from "../useUpdater";

// Override the global setup mock so we can also expose `Update`. The hook
// imports `Update` as a type only, but we keep the named export here for
// completeness so factory replacement matches the real module surface.
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
  Update: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  isStoreBuild: vi.fn(),
  isIsolatedBuild: vi.fn(),
}));

type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished"; data: Record<string, never> };

type UpdateMock = {
  version: string;
  downloadAndInstall: ReturnType<typeof vi.fn>;
};

function makeUpdate(version = "1.6.6"): UpdateMock {
  return {
    version,
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
  };
}

describe("useUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolve isStoreBuild quickly to false so most tests don't need
    // to override it. Tests that rely on the safe-default `storeBuild=true`
    // before resolution must override with a never-resolving promise.
    vi.mocked(isStoreBuild).mockResolvedValue(false);
    vi.mocked(isIsolatedBuild).mockResolvedValue(false);
    vi.mocked(check).mockResolvedValue(null);
    vi.mocked(relaunch).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([true, false])(
    "blocks manual and automatic checks in isolated builds (auto=%s)",
    async (auto) => {
      vi.mocked(isIsolatedBuild).mockResolvedValue(true);
      vi.useFakeTimers();
      const { result } = renderHook(() => useUpdater(auto));
      await act(async () => {
        await result.current.checkForUpdates();
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(result.current.isolatedBuild).toBe(true);
      expect(result.current.storeBuild).toBe(false);
      expect(result.current.status.state).toBe("idle");
      expect(check).not.toHaveBeenCalled();
    },
  );

  it("fails closed when the build profile cannot be read", async () => {
    vi.mocked(isIsolatedBuild).mockRejectedValue(new Error("IPC unavailable"));
    const { result } = renderHook(() => useUpdater(false));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(check).not.toHaveBeenCalled();
    expect(result.current.isolatedBuild).toBe(true);
  });

  it("blocks a manual check in a Store build", async () => {
    vi.mocked(isStoreBuild).mockResolvedValue(true);
    const { result } = renderHook(() => useUpdater(false));
    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(check).not.toHaveBeenCalled();
  });

  it("starts with status='idle' and storeBuild=true (safe default)", () => {
    // Block isStoreBuild so the safe default sticks during this assertion.
    vi.mocked(isStoreBuild).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useUpdater(false));

    expect(result.current.status.state).toBe("idle");
    expect(result.current.storeBuild).toBe(true);
  });

  it("transitions idle -> checking -> upToDate when no update available", async () => {
    vi.mocked(check).mockResolvedValue(null);

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status.state).toBe("upToDate");
  });

  it("transitions idle -> checking -> available when update found", async () => {
    const update = makeUpdate("1.6.6");
    vi.mocked(check).mockResolvedValue(update as never);

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status.state).toBe("available");
    if (result.current.status.state === "available") {
      expect(result.current.status.version).toBe("1.6.6");
    }
  });

  it("transitions to error when check() rejects", async () => {
    vi.mocked(check).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.status.state).toBe("error");
    if (result.current.status.state === "error") {
      expect(result.current.status.message).toContain("network");
    }
  });

  it("downloadAndInstall is a no-op when status is not 'available'", async () => {
    const update = makeUpdate();
    // check() returns null, so status stays idle/upToDate, never available
    vi.mocked(check).mockResolvedValue(null);

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.downloadAndInstall();
    });

    expect(result.current.status.state).toBe("idle");
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
  });

  it("downloadAndInstall reports progress and reaches 'ready'", async () => {
    const update = makeUpdate();
    let emit: ((e: DownloadEvent) => void) | null = null;
    update.downloadAndInstall.mockImplementation(async (cb: (e: DownloadEvent) => void) => {
      emit = cb;
      // Started + Progress sequence
      cb({ event: "Started", data: { contentLength: 100 } });
      cb({ event: "Progress", data: { chunkLength: 50 } });
    });
    vi.mocked(check).mockResolvedValue(update as never);

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.status.state).toBe("available");

    await act(async () => {
      await result.current.downloadAndInstall();
    });

    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(result.current.status.state).toBe("ready");
    expect(emit).not.toBeNull();
  });

  it("downloadAndInstall transitions to error on download failure", async () => {
    const update = makeUpdate();
    update.downloadAndInstall.mockRejectedValue(new Error("dl failed"));
    vi.mocked(check).mockResolvedValue(update as never);

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.status.state).toBe("available");

    await act(async () => {
      await result.current.downloadAndInstall();
    });

    expect(result.current.status.state).toBe("error");
    if (result.current.status.state === "error") {
      expect(result.current.status.message).toContain("dl failed");
    }
  });

  it("restartApp calls relaunch", async () => {
    vi.mocked(relaunch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.restartApp();
    });

    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it("restartApp surfaces error if relaunch throws", async () => {
    vi.mocked(relaunch).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.restartApp();
    });

    expect(result.current.status.state).toBe("error");
    if (result.current.status.state === "error") {
      expect(result.current.status.message).toContain("boom");
    }
  });

  it("dismiss resets status to idle", async () => {
    const update = makeUpdate();
    vi.mocked(check).mockResolvedValue(update as never);

    const { result } = renderHook(() => useUpdater(false));

    await act(async () => {
      await result.current.checkForUpdates();
    });
    expect(result.current.status.state).toBe("available");

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.status.state).toBe("idle");
  });

  it("auto-checks 5s after mount when enabled and not store build", async () => {
    vi.mocked(isStoreBuild).mockResolvedValue(false);
    vi.mocked(check).mockResolvedValue(null);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useUpdater(true));

    // Wait for isStoreBuild to resolve and the storeBuild state to flip,
    // which schedules the 5s auto-check setTimeout.
    await vi.waitFor(() => {
      expect(result.current.storeBuild).toBe(false);
    });

    // Advance past the 5s auto-check timer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await vi.waitFor(() => {
      expect(check).toHaveBeenCalledTimes(1);
    });
  });

  it("does NOT auto-check when storeBuild=true", async () => {
    vi.mocked(isStoreBuild).mockResolvedValue(true);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderHook(() => useUpdater(true));

    await vi.waitFor(() => {
      expect(isStoreBuild).toHaveBeenCalled();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(check).not.toHaveBeenCalled();
  });

  it("does NOT auto-check when enabled=false", async () => {
    vi.mocked(isStoreBuild).mockResolvedValue(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderHook(() => useUpdater(false));

    await vi.waitFor(() => {
      expect(isStoreBuild).toHaveBeenCalled();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(check).not.toHaveBeenCalled();
  });
});
