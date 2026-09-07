import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import script from "../../../src-tauri/src/navigation-dispatch.js?raw";

function harness() {
  const invoke = vi.fn().mockResolvedValue(undefined);
  const host: Record<string, unknown> = { __TAURI_INTERNALS__: { invoke } };
  const dispatch = runInNewContext(`${script}\ndispatchNoFocusNavigation`, { window: host }) as (
    handler: string,
    action: string,
    vk: number,
    generation: number,
    retry: boolean,
  ) => void;
  return { host, invoke, dispatch };
}

describe("no-focus navigation readiness", () => {
  it.each([
    ["__beetrootNav", "down", 0x28],
    ["__beetrootAction", "space", 0x20],
    ["__beetrootAction", "enter", 0x0d],
  ] as const)(
    "hands missing %s/%s back to the native generation guard once",
    (handler, action, vk) => {
      const { host, invoke, dispatch } = harness();
      dispatch(handler, action, vk, 7, true);
      expect(invoke).toHaveBeenCalledExactlyOnceWith("retry_no_focus_navigation", {
        vk,
        generation: 7,
      });
      const ready = vi.fn();
      host[handler] = ready;
      // The native retry re-enters its main-thread active/generation guard before this eval.
      dispatch(handler, action, vk, 7, false);
      expect(ready).toHaveBeenCalledExactlyOnceWith(action);
      expect(invoke).toHaveBeenCalledTimes(1);
    },
  );

  it("delivers ready navigation immediately without a duplicate retry", () => {
    const { host, invoke, dispatch } = harness();
    const ready = vi.fn();
    host.__beetrootNav = ready;
    dispatch("__beetrootNav", "down", 0x28, 7, true);
    expect(ready).toHaveBeenCalledExactlyOnceWith("down");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not retry again when readiness is still absent at the bounded handoff", () => {
    const { invoke, dispatch } = harness();
    dispatch("__beetrootNav", "down", 0x28, 7, false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not duplicate an action when an installed handler throws", () => {
    const { host, invoke, dispatch } = harness();
    host.__beetrootAction = () => {
      throw new Error("handler failed");
    };
    dispatch("__beetrootAction", "enter", 0x0d, 7, true);
    expect(invoke).not.toHaveBeenCalled();
  });
});
