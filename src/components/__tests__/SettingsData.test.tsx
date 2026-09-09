import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsData } from "../SettingsData";
import {
  getDataPath,
  changeDataPath,
  switchDataPath,
  pickFolder,
  checkDataPathDrive,
  checkCloudSync,
  dbGetStats,
} from "../../lib/tauri";

vi.mock("../../lib/tauri", () => ({
  getDataPath: vi.fn(),
  changeDataPath: vi.fn(),
  switchDataPath: vi.fn(),
  pickFolder: vi.fn(),
  checkDataPathDrive: vi.fn(),
  checkCloudSync: vi.fn(),
  dbGetStats: vi.fn(),
}));

vi.mock("../../lib/dialogState", () => ({
  setDialogActive: vi.fn(),
}));

describe("SettingsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDataPath).mockResolvedValue("C:\\Users\\Test\\AppData\\Roaming\\Beetroot");
    vi.mocked(dbGetStats).mockResolvedValue({
      total_items: 42,
      text_items: 30,
      image_items: 10,
      starred_items: 2,
      db_size_bytes: 12345,
      images_dir_size_bytes: 67890,
    });
  });

  it("renders nothing while data path is loading", () => {
    vi.mocked(getDataPath).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<SettingsData onError={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders data path + stats once loaded", async () => {
    const { container } = render(<SettingsData onError={vi.fn()} />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Beetroot");
    });
    expect(container.textContent).toContain("42"); // total_items
    expect(container.textContent).toContain("12.1 KB"); // formatBytes(12345) = "12.1 KB"
  });

  it("Move button triggers pickFolder + changeDataPath flow", async () => {
    vi.mocked(pickFolder).mockResolvedValue("D:\\NewLocation");
    vi.mocked(checkDataPathDrive).mockResolvedValue(null);
    vi.mocked(checkCloudSync).mockResolvedValue(null);
    vi.mocked(changeDataPath).mockResolvedValue(undefined);

    const { container } = render(<SettingsData onError={vi.fn()} />);
    await vi.waitFor(() => {
      expect(container.querySelector(".settings__btn")).not.toBeNull();
    });
    const moveBtn = container.querySelectorAll(".settings__btn")[0] as HTMLElement;
    await userEvent.click(moveBtn);

    await vi.waitFor(() => {
      expect(pickFolder).toHaveBeenCalled();
      expect(changeDataPath).toHaveBeenCalledWith("D:\\NewLocation");
    });
  });

  it("Switch button calls switchDataPath instead of changeDataPath", async () => {
    vi.mocked(pickFolder).mockResolvedValue("D:\\Switched");
    vi.mocked(checkDataPathDrive).mockResolvedValue(null);
    vi.mocked(checkCloudSync).mockResolvedValue(null);
    vi.mocked(switchDataPath).mockResolvedValue(undefined);

    const { container } = render(<SettingsData onError={vi.fn()} />);
    await vi.waitFor(() => {
      expect(container.querySelector(".settings__btn")).not.toBeNull();
    });
    const switchBtn = container.querySelectorAll(".settings__btn")[1] as HTMLElement;
    await userEvent.click(switchBtn);

    await vi.waitFor(() => {
      expect(switchDataPath).toHaveBeenCalledWith("D:\\Switched");
      expect(changeDataPath).not.toHaveBeenCalled();
    });
  });

  it("cancelled folder pick is a no-op (no IPC chain)", async () => {
    vi.mocked(pickFolder).mockResolvedValue(null);

    const { container } = render(<SettingsData onError={vi.fn()} />);
    await vi.waitFor(() => {
      expect(container.querySelector(".settings__btn")).not.toBeNull();
    });
    await userEvent.click(container.querySelectorAll(".settings__btn")[0] as HTMLElement);

    await new Promise((r) => setTimeout(r, 50));
    expect(checkDataPathDrive).not.toHaveBeenCalled();
    expect(changeDataPath).not.toHaveBeenCalled();
  });

  it("removable drive triggers onError with unstableDrive warning", async () => {
    const onError = vi.fn();
    vi.mocked(pickFolder).mockResolvedValue("E:\\USBStick");
    vi.mocked(checkDataPathDrive).mockResolvedValue("removable");

    const { container } = render(<SettingsData onError={onError} />);
    await vi.waitFor(() => {
      expect(container.querySelector(".settings__btn")).not.toBeNull();
    });
    await userEvent.click(container.querySelectorAll(".settings__btn")[0] as HTMLElement);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(changeDataPath).not.toHaveBeenCalled();
    });
  });

  it("cloud-sync folder triggers onError with cloudSync warning", async () => {
    const onError = vi.fn();
    vi.mocked(pickFolder).mockResolvedValue("C:\\Users\\X\\OneDrive\\Beetroot");
    vi.mocked(checkDataPathDrive).mockResolvedValue(null);
    vi.mocked(checkCloudSync).mockResolvedValue("OneDrive");

    const { container } = render(<SettingsData onError={onError} />);
    await vi.waitFor(() => {
      expect(container.querySelector(".settings__btn")).not.toBeNull();
    });
    await userEvent.click(container.querySelectorAll(".settings__btn")[0] as HTMLElement);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(changeDataPath).not.toHaveBeenCalled();
    });
  });

  it("changeDataPath rejection surfaces error and resets migrating state", async () => {
    const onError = vi.fn();
    vi.mocked(pickFolder).mockResolvedValue("D:\\NewLocation");
    vi.mocked(checkDataPathDrive).mockResolvedValue(null);
    vi.mocked(checkCloudSync).mockResolvedValue(null);
    vi.mocked(changeDataPath).mockRejectedValue(new Error("io error"));

    const { container } = render(<SettingsData onError={onError} />);
    await vi.waitFor(() => {
      expect(container.querySelector(".settings__btn")).not.toBeNull();
    });
    await userEvent.click(container.querySelectorAll(".settings__btn")[0] as HTMLElement);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining("io error"));
    });
  });
});
