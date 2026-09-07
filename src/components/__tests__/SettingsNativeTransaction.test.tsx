import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { act, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../Settings";
import { useAppState } from "../../hooks/useAppState";
import { usePlainTextHotkey } from "../../hooks/usePlainTextHotkey";
import { defaultSettings, keySettingsProps } from "../../test/fixtures";
import { loadSettings, saveSettings } from "../../lib/settings";

vi.mock("../../hooks/useClipboardMonitor", () => ({ useClipboardMonitor: vi.fn() }));

function Harness() {
  const state = useAppState();
  return (
    <>
      <button onClick={() => state.setShowSettings(true)}>Open settings</button>
      <output>{JSON.stringify(state.settings)}</output>
      {state.showSettings && (
        <Settings
          {...keySettingsProps()}
          settings={state.settings}
          onSave={state.handleSaveSettings}
          onClose={() => state.setShowSettings(false)}
        />
      )}
    </>
  );
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function PlainTextSettingsHarness() {
  const [settings, setSettings] = useState({
    ...defaultSettings(),
    plainTextHotkey: "Ctrl+Shift+V",
  });
  const [open, setOpen] = useState(true);
  usePlainTextHotkey(settings);
  return open ? (
    <Settings
      {...keySettingsProps()}
      settings={settings}
      onClose={() => setOpen(false)}
      onSave={(next) => {
        if (!saveSettings(next)) return false;
        setSettings(next);
        setOpen(false);
        return true;
      }}
    />
  ) : null;
}

describe("saved and native settings transaction", () => {
  const storage = localStorage;
  const initial = { ...defaultSettings(), plainTextHotkey: "Ctrl+Shift+KeyV" };
  let native: { main: string; plain: string; autostart: boolean };
  let operations: string[];
  let refuse: string;
  let block: ReturnType<typeof deferred> | null;
  let rollbackFailure: boolean;
  let rejectedKeys: string[];
  let delayCleanup: boolean;
  let pendingCleanup: (() => void)[];

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: storage.getItem.bind(storage),
      setItem: storage.setItem.bind(storage),
      removeItem: storage.removeItem.bind(storage),
      clear: storage.clear.bind(storage),
    });
    localStorage.clear();
    saveSettings(initial);
    native = { main: initial.hotkey, plain: "", autostart: false };
    operations = [];
    refuse = "";
    block = null;
    rollbackFailure = false;
    rejectedKeys = [];
    delayCleanup = false;
    pendingCleanup = [];
    vi.mocked(invoke)
      .mockReset()
      .mockImplementation(async (command, args) => {
        const params = args as
          | { shortcutStr?: string; expectedShortcut?: string; action?: string }
          | undefined;
        if (
          command === "change_hotkey" ||
          (command === "replace_hotkey" && params?.action === "main")
        ) {
          const key = params!.shortcutStr!;
          const previous = native.main;
          operations.push(`main:${key}`);
          if (rejectedKeys.includes(key)) throw new Error("startup key occupied");
          if (block && key === "Ctrl+F9") await block.promise;
          if (refuse === "main" && key === "Ctrl+F9") throw new Error("main conflict");
          if (refuse === "nativeRollback" && key === "Ctrl+F9") {
            native.main = "";
            throw new Error(
              "Hotkey conflict. Rollback failed: restore unavailable. No hotkey is active.",
            );
          }
          if (rollbackFailure && key === initial.hotkey) throw new Error("restore unavailable");
          native.main = key;
          return command === "replace_hotkey" ? previous : undefined;
        } else if (
          command === "register_plain_text_hotkey" ||
          (command === "replace_hotkey" && params?.action === "plain_text")
        ) {
          const key = params!.shortcutStr!;
          const previous = native.plain;
          operations.push(`plain:${key}`);
          if (rejectedKeys.includes(key)) throw new Error("startup key occupied");
          if (refuse === "plain" && key === "Ctrl+F10") throw new Error("plain conflict");
          native.plain = key;
          return command === "replace_hotkey" ? previous : undefined;
        } else if (command === "unregister_plain_text_hotkey") {
          operations.push(`clear:${params?.expectedShortcut ?? "*"}`);
          const clear = () => {
            if (!params?.expectedShortcut || native.plain === params.expectedShortcut)
              native.plain = "";
          };
          if (delayCleanup && params?.expectedShortcut) pendingCleanup.push(clear);
          else clear();
        } else if (command === "autostart_enable" || command === "autostart_disable") {
          operations.push(command);
          if (refuse.startsWith("disabled_") && command === "autostart_enable")
            throw new Error(refuse);
          native.autostart = command === "autostart_enable";
        } else if (command === "search_items") {
          return {
            items: [],
            filter_counts: { all: 0, starred: 0, text: 0, image: 0, notes: 0 },
            app_counts: {},
            app_last_used: {},
            regex_error: null,
          };
        } else if (command === "get_key_labels") return {};
        else if (command === "get_os_build") return 22631;
        else if (command === "get_app_icons") return {};
        else if (command === "check_recovery_notice") return null;
        else if (command === "autostart_is_enabled") {
          operations.push(command);
          return native.autostart;
        } else return false;
      });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function openAndEdit() {
    const view = render(<Harness />);
    await act(async () => {
      fireEvent.click(within(view.container).getByRole("button", { name: "Open settings" }));
    });
    const ui = within(view.container);
    fireEvent.click(ui.getByRole("tab", { name: "Shortcuts" }));
    for (const [index, code] of [
      [0, "F9"],
      [1, "F10"],
    ] as const) {
      const recorder = view.container.querySelectorAll(".settings__hotkey-recorder")[index];
      fireEvent.click(recorder);
      fireEvent.keyDown(recorder, { key: "Control", code: "ControlLeft" });
      fireEvent.keyDown(recorder, { key: code, code, ctrlKey: true });
      expect(recorder).toHaveTextContent(`Ctrl+${code}`);
    }
    operations = [];
    return { ...view, ui };
  }

  it.each(["disabled_by_user", "disabled_by_policy"])(
    "restores both keys after %s and keeps status-specific guidance",
    async (status) => {
      const { ui, container } = await openAndEdit();
      fireEvent.click(ui.getByRole("tab", { name: "General" }));
      fireEvent.click(ui.getAllByRole("switch")[0]);
      refuse = status;
      await act(async () => {
        fireEvent.click(ui.getByRole("button", { name: "Save" }));
      });
      expect(native).toEqual({
        main: initial.hotkey,
        plain: initial.plainTextHotkey,
        autostart: false,
      });
      expect(ui.getByRole("alert")).toHaveTextContent(
        status === "disabled_by_user" ? /Task Manager/ : /administrator|policy/,
      );
      expect(ui.getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "false");
      fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
      expect(container.querySelector(".settings")).not.toBeInTheDocument();
      expect(loadSettings().hotkey).toBe(initial.hotkey);
    },
  );

  it.each([
    { main: "Ctrl+Backquote", plain: "", clear: false, failure: "storage" },
    { main: "Ctrl+Backquote", plain: "", clear: false, failure: "autostart" },
    { main: "", plain: "Alt+F6", clear: true, failure: "storage" },
  ])("restores the native predecessor after rejected startup keys: %j", async (prior) => {
    const saved = { ...initial, hotkey: "Ctrl+F7", plainTextHotkey: "Ctrl+F8" };
    saveSettings(saved);
    rejectedKeys = [saved.hotkey, saved.plainTextHotkey];
    native.main = prior.main;
    native.plain = prior.plain;
    const { ui, container } = await openAndEdit();
    expect(native.main).toBe(prior.main);
    expect(native.plain).toBe(prior.plain);
    if (prior.clear) {
      const row = container.querySelectorAll(".settings__hotkey-row")[1] as HTMLElement;
      fireEvent.click(within(row).getByRole("button", { name: "Clear" }));
    }
    if (prior.failure === "autostart") {
      fireEvent.click(ui.getByRole("tab", { name: "General" }));
      fireEvent.click(ui.getAllByRole("switch")[0]);
      refuse = "disabled_by_user";
    } else {
      vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    }
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(native).toEqual({ main: prior.main, plain: prior.plain, autostart: false });
    expect(loadSettings().hotkey).toBe("Ctrl+F7");
    expect(loadSettings().plainTextHotkey).toBe("Ctrl+F8");
    expect(JSON.parse(container.querySelector("output")!.textContent!).hotkey).toBe("Ctrl+F7");
    expect(ui.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("retains actual autostart status after it diverges from saved intent", async () => {
    const { ui } = await openAndEdit();
    native.autostart = true;
    fireEvent.click(ui.getByRole("tab", { name: "General" }));
    fireEvent.click(ui.getAllByRole("switch")[0]);
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(native.autostart).toBe(true);
    expect(loadSettings().autostart).toBe(false);
    expect(operations).toContain("autostart_is_enabled");
    expect(operations).not.toContain("autostart_disable");
  });

  it("keeps an alias-only Save registered after delayed old hook cleanup", async () => {
    saveSettings({ ...initial, plainTextHotkey: "Ctrl+Shift+V" });
    const view = render(<PlainTextSettingsHarness />);
    const ui = within(view.container);
    await act(async () => {});
    expect(native.plain).toBe("Ctrl+Shift+V");
    fireEvent.click(ui.getByRole("tab", { name: "Shortcuts" }));
    const recorder = view.container.querySelectorAll(".settings__hotkey-recorder")[1];
    fireEvent.click(recorder);
    fireEvent.keyDown(recorder, { key: "Control", code: "ControlLeft" });
    fireEvent.keyDown(recorder, { key: "Shift", code: "ShiftLeft", ctrlKey: true });
    fireEvent.keyDown(recorder, { key: "V", code: "KeyV", ctrlKey: true, shiftKey: true });
    delayCleanup = true;
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(loadSettings().plainTextHotkey).toBe("Ctrl+Shift+KeyV");
    expect(native.plain).toBe("Ctrl+Shift+KeyV");
    expect(operations).toContain("plain:Ctrl+Shift+KeyV");
    expect(pendingCleanup.length).toBeGreaterThan(0);
    await act(async () => pendingCleanup.forEach((clear) => clear()));
    expect(native.plain).toBe("Ctrl+Shift+KeyV");
    expect(view.container.querySelector(".settings")).not.toBeInTheDocument();
  });

  it.each(["main", "plain"])("does not persist a rejected %s replacement", async (kind) => {
    const { ui } = await openAndEdit();
    refuse = kind;
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(ui.getByRole("alert")).toHaveTextContent(`${kind} conflict`);
    expect(native).toEqual({
      main: initial.hotkey,
      plain: initial.plainTextHotkey,
      autostart: false,
    });
    expect(loadSettings().plainTextHotkey).toBe(initial.plainTextHotkey);
  });

  it("persists only after native installation and cleanup does not remove the replacement", async () => {
    const { ui, container } = await openAndEdit();
    const originalSet = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key === "beetroot_settings") {
        expect(native.main).toBe("Ctrl+F9");
        expect(native.plain).toBe("Ctrl+F10");
        operations.push("persist");
      }
      originalSet(key, value);
    });
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(native.plain).toBe("Ctrl+F10");
    expect(loadSettings().plainTextHotkey).toBe("Ctrl+F10");
    expect(container.querySelector(".settings")).not.toBeInTheDocument();
    expect(operations.indexOf("persist")).toBeGreaterThan(operations.indexOf("plain:Ctrl+F10"));
  });

  it("restores native effects when actual settings storage fails, retaining saved hook state", async () => {
    const { ui, container } = await openAndEdit();
    fireEvent.click(ui.getByRole("tab", { name: "General" }));
    fireEvent.click(ui.getAllByRole("switch")[0]);
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(native).toEqual({
      main: initial.hotkey,
      plain: initial.plainTextHotkey,
      autostart: false,
    });
    expect(JSON.parse(container.querySelector("output")!.textContent!).hotkey).toBe(initial.hotkey);
    expect(loadSettings().hotkey).toBe(initial.hotkey);
    expect(ui.getByRole("alert")).toHaveTextContent(/save/i);
  });

  it("ignores duplicate Save, Cancel, close and Escape until async Save settles", async () => {
    const { ui, container } = await openAndEdit();
    const close = container.querySelector(".settings__close")!;
    const panel = container.querySelector(".settings")!;
    block = deferred();
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    fireEvent.click(ui.getByRole("button", { name: /Saving/ }));
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    fireEvent.click(close);
    fireEvent.keyDown(panel, { key: "Escape" });
    try {
      expect(container.querySelector(".settings")).toBeInTheDocument();
    } finally {
      await act(async () => {
        block!.resolve();
      });
    }
    expect(operations.filter((op) => op === "main:Ctrl+F9")).toHaveLength(1);
    expect(native.plain).toBe("Ctrl+F10");
  });

  it("surfaces failed rollback and does not save the requested keys", async () => {
    const { ui } = await openAndEdit();
    refuse = "plain";
    rollbackFailure = true;
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(ui.getByRole("alert")).toHaveTextContent(/rollback.*restore unavailable/i);
    expect(loadSettings().hotkey).toBe(initial.hotkey);
    expect(native.main).toBe("Ctrl+F9");
  });

  it("blocks saving after native registration reports a failed internal rollback", async () => {
    const { ui } = await openAndEdit();
    refuse = "nativeRollback";
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(ui.getByRole("alert")).toHaveTextContent(/No hotkey is active/);
    expect(ui.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(loadSettings().hotkey).toBe(initial.hotkey);
  });

  it.each([false, true])(
    "clears plain-text registration transactionally with storage failure=%s",
    async (failStorage) => {
      const { ui, container } = await openAndEdit();
      const row = container.querySelectorAll(".settings__hotkey-row")[1] as HTMLElement;
      fireEvent.click(within(row).getByRole("button", { name: "Clear" }));
      if (failStorage)
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
          throw new DOMException("full", "QuotaExceededError");
        });
      await act(async () => {
        fireEvent.click(ui.getByRole("button", { name: "Save" }));
      });
      expect(native.plain).toBe(failStorage ? initial.plainTextHotkey : "");
      expect(loadSettings().plainTextHotkey).toBe(failStorage ? initial.plainTextHotkey : "");
    },
  );
});
