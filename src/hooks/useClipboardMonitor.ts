import { useEffect, useRef } from "react";
import { startMonitor, stopMonitor, MONITOR_UPDATE_EVENT } from "tauri-plugin-clipboard-api";
import { listen } from "@tauri-apps/api/event";
import { captureClipboard } from "../lib/clipboard-capture";
import { createLogger } from "../lib/log";
import type { TranslationKey } from "../lib/i18n";
import { cacheExePath } from "./useAppIcons";

const log = createLogger("clipboard");
// The plugin owns one watcher. Serialize start/stop across retries and React mounts.
let monitorLifecycle = Promise.resolve();

export function useClipboardMonitor(
  onNewText: (
    text: string,
    html?: string,
    sourceApp?: string,
    sourceTitle?: string,
    isCurrent?: () => boolean,
  ) => void,
  onNewImage: (
    base64: string,
    sourceApp?: string,
    sourceTitle?: string,
    isCurrent?: () => boolean,
  ) => void,
  paused = false,
  onWarning?: (key: TranslationKey) => void,
) {
  const textRef = useRef(onNewText);
  const imageRef = useRef(onNewImage);
  const warningRef = useRef(onWarning);
  const pausedRef = useRef(paused);
  const pauseGeneration = useRef(0);
  const lastTextRef = useRef<{ value: string; at: number } | null>(null);
  const lastImageRef = useRef<{ value: string; at: number } | null>(null);
  const suppressedSequence = useRef<number | null>(null);

  useEffect(() => {
    textRef.current = onNewText;
    imageRef.current = onNewImage;
    warningRef.current = onWarning;
    if (pausedRef.current !== paused) {
      pauseGeneration.current++;
      lastTextRef.current = null;
      lastImageRef.current = null;
    }
    pausedRef.current = paused;
  });

  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    let unlisten: (() => void) | undefined;
    let ownsMonitor = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function capture(gen: number) {
      const pauseGen = pauseGeneration.current;
      const isCurrent = () =>
        !cancelled &&
        gen === generation &&
        !pausedRef.current &&
        pauseGen === pauseGeneration.current;
      if (!isCurrent()) return;
      const result = await captureClipboard(isCurrent);
      if (!result || !isCurrent()) return;
      if (suppressedSequence.current === result.sequence) return;
      if (result.suppress(result.sequence)) {
        suppressedSequence.current = result.sequence;
        return;
      }
      if (result.warning) warningRef.current?.(result.warning);
      const content = result.content;
      if (!content) return;
      const source = result.source;
      const now = Date.now();
      const ref = content.kind === "text" ? lastTextRef : lastImageRef;
      const value =
        content.kind === "text"
          ? content.value
          : `${content.value.length}:${content.value.slice(0, 256)}:${content.value.length > 320 ? content.value.slice(-64) : ""}`;
      if (ref.current?.value === value && now - ref.current.at < 500) return;
      ref.current = { value, at: now };
      if (source?.exe_name && source.exe_path) cacheExePath(source.exe_name, source.exe_path);
      if (content.kind === "text")
        textRef.current(content.value, content.html, source?.exe_name, source?.title, isCurrent);
      else imageRef.current(content.value, source?.exe_name, source?.title, isCurrent);
    }

    async function stopOwnedMonitor() {
      unlisten?.();
      unlisten = undefined;
      if (ownsMonitor) {
        ownsMonitor = false;
        await stopMonitor();
      }
    }

    function setup(attempt = 0) {
      const gen = ++generation;
      lastTextRef.current = null;
      lastImageRef.current = null;
      unlisten?.();
      unlisten = undefined;
      monitorLifecycle = monitorLifecycle
        .then(async () => {
          await stopOwnedMonitor();
          if (cancelled || gen !== generation) return;
          const listener = await listen(MONITOR_UPDATE_EVENT, async (event) => {
            if (event.payload === "clipboard update") await capture(gen);
          });
          if (cancelled || gen !== generation) {
            listener();
            return;
          }
          unlisten = listener;
          ownsMonitor = true;
          await startMonitor();
          if (cancelled || gen !== generation) await stopOwnedMonitor();
        })
        .catch(async (error) => {
          await stopOwnedMonitor().catch((error) =>
            log.warn("Clipboard monitor stop failed", error),
          );
          if (cancelled || gen !== generation) return;
          generation++;
          log.warn("Clipboard monitor setup failed", error);
          if (attempt < 3) retryTimer = setTimeout(() => setup(attempt + 1), 1000 * 2 ** attempt);
        });
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible" || cancelled) return;
      clearTimeout(retryTimer);
      setup();
    }
    setup();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      generation++;
      clearTimeout(retryTimer);
      unlisten?.();
      unlisten = undefined;
      monitorLifecycle = monitorLifecycle
        .then(stopOwnedMonitor)
        .catch((error) => log.warn("Clipboard monitor stop failed", error));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
