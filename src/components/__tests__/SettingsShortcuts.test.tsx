import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsShortcuts } from "../SettingsShortcuts";

vi.mock("../../lib/i18n", () => ({ useTranslation: () => (key: string) => key }));

describe("shortcut recorder", () => {
  it("keeps recording after Shift+V until a command modifier is held", () => {
    const onHotkeyChange = vi.fn();
    const { container } = render(
      <SettingsShortcuts
        hotkey="Ctrl+Backquote"
        plainTextHotkey=""
        shortcutPinWindow="Alt+KeyP"
        shortcutFollowCursor="Alt+KeyF"
        keyLabels={{}}
        onHotkeyChange={onHotkeyChange}
        onPlainTextHotkeyChange={vi.fn()}
        onShortcutPinWindowChange={vi.fn()}
        onShortcutFollowCursorChange={vi.fn()}
      />,
    );
    const recorder = container.querySelector('[aria-label="settings.shortcutGlobalHotkey"]')!;
    fireEvent.click(recorder);
    fireEvent.keyDown(recorder, { code: "ShiftLeft", key: "Shift" });
    fireEvent.keyDown(recorder, { code: "KeyV", key: "V" });
    expect(onHotkeyChange).not.toHaveBeenCalled();
    fireEvent.keyDown(recorder, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(recorder, { code: "KeyV", key: "V" });
    expect(onHotkeyChange).toHaveBeenCalledExactlyOnceWith("Ctrl+Shift+KeyV");
  });
});
