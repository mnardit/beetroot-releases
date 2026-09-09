import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppFilterDropdown } from "../AppFilterDropdown";

// AppFilterDropdown consumes useTranslation() from ../lib/i18n. The default
// I18nContext value is the English translator, so without a provider the
// component renders real English strings (e.g. filter.apps -> "Apps").

describe("AppFilterDropdown ARIA", () => {
  function renderDropdown() {
    return render(
      <AppFilterDropdown
        appFilter={null}
        setAppFilter={() => {}}
        appCounts={{ "chrome.exe": 5, "notepad.exe": 2 }}
        appLastUsed={{
          "chrome.exe": "2026-05-01T10:00:00Z",
          "notepad.exe": "2026-05-01T09:00:00Z",
        }}
        appIcons={{}}
      />,
    );
  }

  it("opens with role=menu container and correct aria-label", async () => {
    const user = userEvent.setup();
    const { container } = renderDropdown();

    const trigger = container.querySelector(".filter-bar__chip") as HTMLElement | null;
    expect(trigger).toBeTruthy();

    await user.click(trigger!);

    const menu = container.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    expect(menu?.getAttribute("aria-label")).toBe("Apps");
  });
});
