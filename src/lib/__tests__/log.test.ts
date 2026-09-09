import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger, timed } from "../log";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createLogger", () => {
  it("returns object with debug, info, warn, error methods", () => {
    const log = createLogger("test");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("error outputs to console.error with formatted message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("mymodule");
    log.error("something broke");
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toContain("[ERROR]");
    expect(msg).toContain("[mymodule]");
    expect(msg).toContain("something broke");
  });

  it("warn outputs to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("net");
    log.warn("timeout");
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toContain("[WARN]");
    expect(msg).toContain("[net]");
  });

  it("includes ISO timestamp in message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("test");
    log.error("check timestamp");
    const msg = spy.mock.calls[0][0] as string;
    // ISO timestamp pattern: YYYY-MM-DDTHH:MM:SS
    expect(msg).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("passes extra args through", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("test");
    const extra = { code: 500 };
    log.error("failed", extra);
    expect(spy).toHaveBeenCalledWith(expect.any(String), extra);
  });
});

describe("timed", () => {
  it("returns the result of the function", async () => {
    const log = createLogger("perf");
    const result = await timed(log, "fast", async () => 42, 1000);
    expect(result).toBe(42);
  });

  it("does not warn for fast operations", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("perf");
    await timed(log, "fast", async () => "ok", 1000);
    expect(spy).not.toHaveBeenCalled();
  });

  it("warns when operation exceeds threshold", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("perf");
    await timed(
      log,
      "slow-op",
      async () => {
        await new Promise((r) => setTimeout(r, 50));
      },
      10,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toContain("Slow: slow-op");
    expect(msg).toContain("threshold 10ms");
  });
});
