import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { readText, writeText } from "tauri-plugin-clipboard-api";
import {
  pasteSelectedItem,
  registerPlainTextHotkey,
  unregisterPlainTextHotkey,
} from "../lib/tauri";
import { suppressedWrite } from "../lib/paste";
import { createLogger } from "../lib/log";
import type { AppSettings } from "../lib/settings";

const log = createLogger("plainTextHotkey");

export function usePlainTextHotkey(settings: AppSettings) {
  const hotkeyRef = useRef("");

  useEffect(() => {
    const hotkey = settings.plainTextHotkey;
    const prev = hotkeyRef.current;

    // Unregister previous hotkey if it changed
    if (prev && prev !== hotkey) {
      unregisterPlainTextHotkey(prev).catch((e) =>
        log.warn("failed to unregister plain text hotkey", e),
      );
    }

    hotkeyRef.current = hotkey;

    if (!hotkey) return;

    // Register the hotkey in Rust (layout-aware via Windows API)
    registerPlainTextHotkey(hotkey).catch((e) =>
      log.warn("failed to register plain text hotkey", e),
    );

    // Listen for the "plain-text-paste" event emitted by the Rust hotkey handler
    const unlisten = listen("plain-text-paste", async () => {
      try {
        const text = await readText();
        if (!text) return;
        await suppressedWrite(() => writeText(text));
        await pasteSelectedItem();
      } catch (e) {
        log.warn("plain text paste failed", e);
      }
    });

    return () => {
      unregisterPlainTextHotkey(hotkey).catch((e) =>
        log.warn("failed to unregister plain text hotkey", e),
      );
      unlisten.then((fn_) => fn_()).catch(() => {});
    };
  }, [settings.plainTextHotkey]);
}
