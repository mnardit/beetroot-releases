import { describe, it, expect } from "vitest";
import { setSuppressNext, checkAndResetSuppress, suppressedWrite } from "../paste";

describe("suppress counter", () => {
  it("defaults to false", () => {
    // drain state from prior tests
    while (checkAndResetSuppress()) {
      /* drain residual suppress counters from earlier tests */
    }
    expect(checkAndResetSuppress()).toBe(false);
  });

  it("suppresses default count (1) then resets", () => {
    setSuppressNext();
    expect(checkAndResetSuppress()).toBe(true); // 1 event for plain text/image
    expect(checkAndResetSuppress()).toBe(false); // exhausted
  });

  it("explicit count=2 suppresses both events (rich text)", () => {
    setSuppressNext(2);
    expect(checkAndResetSuppress()).toBe(true); // text event
    expect(checkAndResetSuppress()).toBe(true); // HTML format event
    expect(checkAndResetSuppress()).toBe(false);
  });

  it("setSuppressNext resets counter, not additive", () => {
    setSuppressNext(2);
    setSuppressNext(2); // resets to 2
    expect(checkAndResetSuppress()).toBe(true);
    expect(checkAndResetSuppress()).toBe(true);
    expect(checkAndResetSuppress()).toBe(false);
  });
});

describe("suppressedWrite", () => {
  it("clears the suppress counter when the inner write rejects", async () => {
    // Drain any residual suppression from prior tests.
    while (checkAndResetSuppress()) {
      /* drain */
    }

    const err = new Error("simulated clipboard write failure");
    await expect(suppressedWrite(() => Promise.reject(err))).rejects.toBe(err);

    // After a rejected write, the suppress counter must be 0 — otherwise
    // the next genuine clipboard event would be silently eaten.
    expect(checkAndResetSuppress()).toBe(false);
  });

  it("keeps the counter at the expected value when the inner write succeeds", async () => {
    while (checkAndResetSuppress()) {
      /* drain */
    }

    const result = await suppressedWrite(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    // Default count = 1: the impending real clipboard event should be
    // suppressed exactly once.
    expect(checkAndResetSuppress()).toBe(true);
    expect(checkAndResetSuppress()).toBe(false);
  });
});
