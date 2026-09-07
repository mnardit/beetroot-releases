import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  pasteSelectedItem,
  changeHotkey,
  getDataPath,
  changeDataPath,
  dbSaveImageItem,
  deleteImage,
  readImageBase64,
  readImageThumbnail,
  enableAutostart,
  disableAutostart,
  isAutostartEnabled,
  isIsolatedBuild,
  ocrImage,
} from "../tauri";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue("" as never);
});

describe("tauri wrappers", () => {
  it("reads the isolated build flag through the registered IPC command", async () => {
    mockInvoke.mockResolvedValueOnce(true);
    await expect(isIsolatedBuild()).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith("is_isolated_build");
  });

  it("propagates build profile failures so consumers can fail closed", async () => {
    mockInvoke.mockRejectedValueOnce("profile unavailable");
    await expect(isIsolatedBuild()).rejects.toBe("profile unavailable");
  });
  it("pasteSelectedItem invokes correct command", async () => {
    await pasteSelectedItem();
    expect(mockInvoke).toHaveBeenCalledWith("paste_selected_item");
  });

  it("changeHotkey passes shortcutStr", async () => {
    await changeHotkey("Ctrl+Shift+V");
    expect(mockInvoke).toHaveBeenCalledWith("change_hotkey", { shortcutStr: "Ctrl+Shift+V" });
  });

  it("getDataPath invokes get_data_path", async () => {
    mockInvoke.mockResolvedValue("C:\\data" as never);
    const result = await getDataPath();
    expect(result).toBe("C:\\data");
    expect(mockInvoke).toHaveBeenCalledWith("get_data_path");
  });

  it("changeDataPath passes newPath", async () => {
    await changeDataPath("D:\\backup");
    expect(mockInvoke).toHaveBeenCalledWith("change_data_path", { newPath: "D:\\backup" });
  });

  it("dbSaveImageItem saves bytes and row through one command", async () => {
    const entry = { id: 42, image_path: "C:\\images\\abc.png" };
    mockInvoke.mockResolvedValue(entry);
    const result = await dbSaveImageItem("base64data", "abcdef1234567890", "Editor", "Image");
    expect(result).toBe(entry);
    expect(mockInvoke).toHaveBeenCalledExactlyOnceWith("db_save_image_item", {
      base64Data: "base64data",
      contentHash: "abcdef1234567890",
      sourceApp: "Editor",
      sourceTitle: "Image",
    });
  });

  it("deleteImage passes path", async () => {
    await deleteImage("C:\\images\\abc.png");
    expect(mockInvoke).toHaveBeenCalledWith("delete_image", { path: "C:\\images\\abc.png" });
  });

  it("readImageBase64 returns base64 string", async () => {
    mockInvoke.mockResolvedValue("aGVsbG8=" as never);
    const result = await readImageBase64("C:\\images\\abc.png");
    expect(result).toBe("aGVsbG8=");
  });

  it("readImageThumbnail invokes read_image_thumbnail with path and maxDim", async () => {
    mockInvoke.mockResolvedValue("data:image/png;base64,aGVsbG8=" as never);
    const result = await readImageThumbnail("C:\\images\\abc.png", 96);
    expect(result).toBe("data:image/png;base64,aGVsbG8=");
    expect(mockInvoke).toHaveBeenCalledWith("read_image_thumbnail", {
      path: "C:\\images\\abc.png",
      maxDim: 96,
    });
  });

  it("enableAutostart invokes plugin command", async () => {
    mockInvoke.mockResolvedValueOnce(true as never);
    await enableAutostart();
    expect(mockInvoke).toHaveBeenCalledWith("autostart_enable");
  });

  it("disableAutostart invokes plugin command", async () => {
    await disableAutostart();
    expect(mockInvoke).toHaveBeenCalledWith("autostart_disable");
  });

  it("isAutostartEnabled invokes autostart_is_enabled and returns the boolean", async () => {
    mockInvoke.mockResolvedValueOnce(true as never);
    const result = await isAutostartEnabled();
    expect(mockInvoke).toHaveBeenCalledWith("autostart_is_enabled");
    expect(result).toBe(true);
  });

  it("ocrImage passes path and returns text", async () => {
    mockInvoke.mockResolvedValue("Hello world" as never);
    const result = await ocrImage("C:\\images\\abc.png");
    expect(result).toBe("Hello world");
    expect(mockInvoke).toHaveBeenCalledWith("ocr_image", { path: "C:\\images\\abc.png" });
  });

  it("propagates invoke errors", async () => {
    mockInvoke.mockRejectedValue(new Error("command failed") as never);
    await expect(pasteSelectedItem()).rejects.toThrow("command failed");
  });
});
