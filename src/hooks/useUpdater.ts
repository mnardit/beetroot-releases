import { useState, useEffect, useCallback, useRef } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isIsolatedBuild, isStoreBuild } from "../lib/tauri";

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string; update: Update }
  | { state: "downloading"; progress: number }
  | { state: "ready" }
  | { state: "error"; message: string }
  | { state: "upToDate" };

export function useUpdater(enabled: boolean = true) {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [storeBuild, setStoreBuild] = useState(true); // safe default: no updates until confirmed non-Store
  const [isolatedBuild, setIsolatedBuild] = useState(true);
  const checkedRef = useRef(false);
  const buildSupportRef = useRef<Promise<boolean> | null>(null);
  const resolveUpdateSupport = useCallback(() => {
    buildSupportRef.current ??= Promise.all([isStoreBuild(), isIsolatedBuild()]).then(
      ([store, isolated]) => {
        setStoreBuild(store);
        setIsolatedBuild(isolated);
        return !store && !isolated;
      },
      () => false,
    );
    return buildSupportRef.current;
  }, []);

  // Detect Store build once on mount
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    void resolveUpdateSupport();
  }, [resolveUpdateSupport]);

  const checkForUpdates = useCallback(async () => {
    if (!(await resolveUpdateSupport())) return;
    setStatus({ state: "checking" });
    try {
      const update = await check();
      if (update) {
        setStatus({
          state: "available",
          version: update.version,
          update,
        });
      } else {
        setStatus({ state: "upToDate" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ state: "error", message: msg });
    }
  }, [resolveUpdateSupport]);

  const downloadAndInstall = useCallback(async () => {
    if (status.state !== "available" || !(await resolveUpdateSupport())) return;

    const { update } = status;
    setStatus({ state: "downloading", progress: 0 });

    let contentLength = 0;
    let downloaded = 0;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          const data = event.data as { contentLength?: number };
          contentLength = data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          const data = event.data as { chunkLength: number };
          downloaded += data.chunkLength;
          const progress = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
          setStatus({ state: "downloading", progress });
        }
      });
      setStatus({ state: "ready" });
    } catch (e) {
      setStatus({
        state: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [status, resolveUpdateSupport]);

  const restartApp = useCallback(async () => {
    try {
      await relaunch();
    } catch (e) {
      setStatus({
        state: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus({ state: "idle" });
  }, []);

  // Check for updates on mount (with delay to not block startup)
  // Skip for Store builds — Store handles updates
  useEffect(() => {
    if (!enabled || storeBuild || isolatedBuild) return;
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000); // Check 5 seconds after app start

    return () => clearTimeout(timer);
  }, [enabled, storeBuild, isolatedBuild, checkForUpdates]);

  return {
    status,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
    dismiss,
    storeBuild,
    isolatedBuild,
  };
}
