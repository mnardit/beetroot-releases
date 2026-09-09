import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBackgroundJobs } from "../useBackgroundJobs";

const mockSubmitJob = vi.fn();
const mockCancelJob = vi.fn();
vi.mock("../../lib/tauri", () => ({
  submitJob: (...args: unknown[]) => mockSubmitJob(...args),
  cancelJob: (...args: unknown[]) => mockCancelJob(...args),
}));

const mockListen = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mockSubmitJob.mockReset();
  mockCancelJob.mockReset();
  mockListen.mockResolvedValue(() => {});
  mockTFn.mockClear();
});

/** t() mock: spy-able, returns key with params interpolated */
const mockTFn = vi.fn((key: string, params?: Record<string, string | number>) => {
  let result = key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
});
const mockT = mockTFn as unknown as import("../../lib/i18n").TFunction;

describe("useBackgroundJobs", () => {
  it("submitJob calls IPC and returns job id", async () => {
    mockSubmitJob.mockResolvedValue(42);
    const { result } = renderHook(() =>
      useBackgroundJobs({ showInfo: vi.fn(), showError: vi.fn(), t: mockT }),
    );

    let jobId: number | null | undefined;
    await act(async () => {
      jobId = await result.current.submitJob({
        provider: "openai",

        model: "gpt-4o",
        prompt: "Fix grammar",
        promptName: "Fix Grammar",
        inputText: "hello",
      });
    });

    expect(jobId).toBe(42);
    expect(mockSubmitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        promptName: "Fix Grammar",
      }),
    );
  });

  it("cancelJob calls IPC", async () => {
    mockCancelJob.mockResolvedValue(true);
    const { result } = renderHook(() =>
      useBackgroundJobs({ showInfo: vi.fn(), showError: vi.fn(), t: mockT }),
    );

    let cancelled: boolean | undefined;
    await act(async () => {
      cancelled = await result.current.cancelJob(42);
    });

    expect(cancelled).toBe(true);
  });

  it("registers event listeners on mount", () => {
    renderHook(() => useBackgroundJobs({ showInfo: vi.fn(), showError: vi.fn(), t: mockT }));

    expect(mockListen).toHaveBeenCalledWith("job-completed", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("job-failed", expect.any(Function));
  });

  it("shows toast when notified=false on job-completed", async () => {
    let completedHandler: ((event: unknown) => void) | undefined;
    mockListen.mockImplementation((eventName: string, handler: (event: unknown) => void) => {
      if (eventName === "job-completed") completedHandler = handler;
      return Promise.resolve(() => {});
    });

    const showInfo = vi.fn();
    renderHook(() => useBackgroundJobs({ showInfo, showError: vi.fn(), t: mockT }));

    await act(async () => {
      completedHandler?.({
        payload: {
          id: 1,
          result: "ok",
          source: "user",
          prompt_name: "Fix Grammar",
          notified: false,
        },
      });
    });

    expect(mockTFn).toHaveBeenCalledWith("toast.aiCompleted", { name: "Fix Grammar" });
    expect(showInfo).toHaveBeenCalled();
  });

  it("skips toast when notified=true on job-completed (Rust sent native notification)", async () => {
    let completedHandler: ((event: unknown) => void) | undefined;
    mockListen.mockImplementation((eventName: string, handler: (event: unknown) => void) => {
      if (eventName === "job-completed") completedHandler = handler;
      return Promise.resolve(() => {});
    });

    const showInfo = vi.fn();
    renderHook(() => useBackgroundJobs({ showInfo, showError: vi.fn(), t: mockT }));

    await act(async () => {
      completedHandler?.({
        payload: {
          id: 1,
          result: "ok",
          source: "user",
          prompt_name: "Fix Grammar",
          notified: true,
        },
      });
    });

    expect(showInfo).not.toHaveBeenCalled();
  });

  it("shows error toast when notified=false on job-failed", async () => {
    let failedHandler: ((event: unknown) => void) | undefined;
    mockListen.mockImplementation((eventName: string, handler: (event: unknown) => void) => {
      if (eventName === "job-failed") failedHandler = handler;
      return Promise.resolve(() => {});
    });

    const showError = vi.fn();
    renderHook(() => useBackgroundJobs({ showInfo: vi.fn(), showError, t: mockT }));

    await act(async () => {});
    await act(async () => {
      failedHandler?.({
        payload: { id: 1, error: "timeout", prompt_name: "Fix Grammar", notified: false },
      });
    });

    expect(mockTFn).toHaveBeenCalledWith("toast.aiFailed", {
      name: "Fix Grammar",
      error: "timeout",
    });
    expect(showError).toHaveBeenCalled();
  });

  it("skips error toast when notified=true on job-failed (Rust sent native notification)", async () => {
    let failedHandler: ((event: unknown) => void) | undefined;
    mockListen.mockImplementation((eventName: string, handler: (event: unknown) => void) => {
      if (eventName === "job-failed") failedHandler = handler;
      return Promise.resolve(() => {});
    });

    const showError = vi.fn();
    renderHook(() => useBackgroundJobs({ showInfo: vi.fn(), showError, t: mockT }));

    await act(async () => {});
    await act(async () => {
      failedHandler?.({
        payload: { id: 1, error: "timeout", prompt_name: "Fix Grammar", notified: true },
      });
    });

    expect(showError).not.toHaveBeenCalled();
  });
});
