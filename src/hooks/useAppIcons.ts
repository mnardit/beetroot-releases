import { useState, useEffect, useRef, useCallback } from "react";
import { getAppIcon, getAllAppIcons } from "../lib/tauri";
import type { ClipboardEntry } from "../types/clipboard";

export interface AppIconData {
  displayName: string;
  iconBase64: string | null;
}

/** Module-level cache of exe_name → exe_path, populated by clipboard monitor */
const exePathCache: Record<string, string> = {};

/** Store an exe_path hint for later icon extraction (called from clipboard monitor) */
export function cacheExePath(exeName: string, exePath: string) {
  if (exeName && exePath && !exePathCache[exeName]) {
    exePathCache[exeName] = exePath;
  }
}

/** Fetch and cache app icons for clipboard items that have source_app set. */
export function useAppIcons(items: ClipboardEntry[]) {
  const [icons, setIcons] = useState<Record<string, AppIconData>>({});
  const knownRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const batchLoadedRef = useRef(false);

  // One-time batch load of all cached icons from DB
  useEffect(() => {
    if (batchLoadedRef.current) return;
    batchLoadedRef.current = true;
    getAllAppIcons()
      .then((all) => {
        const batch: Record<string, AppIconData> = {};
        for (const item of all) {
          batch[item.exe_name] = {
            displayName: item.display_name,
            iconBase64: item.icon_base64,
          };
          knownRef.current.add(item.exe_name);
        }
        setIcons((prev) => ({ ...batch, ...prev }));
      })
      .catch(() => {
        // Batch load failed — fall back to individual fetches
      });
  }, []);

  const fetchIcon = useCallback((exeName: string) => {
    pendingRef.current.add(exeName);
    knownRef.current.add(exeName);
    getAppIcon(exeName, exePathCache[exeName])
      .then((info) => {
        setIcons((prev) => ({
          ...prev,
          [exeName]: {
            displayName: info.display_name,
            iconBase64: info.icon_base64,
          },
        }));
      })
      .catch(() => {
        setIcons((prev) => ({
          ...prev,
          [exeName]: {
            displayName: exeName.replace(/\.exe$/i, ""),
            iconBase64: null,
          },
        }));
      })
      .finally(() => {
        pendingRef.current.delete(exeName);
      });
  }, []);

  useEffect(() => {
    for (const item of items) {
      if (
        item.source_app &&
        !knownRef.current.has(item.source_app) &&
        !pendingRef.current.has(item.source_app)
      ) {
        fetchIcon(item.source_app);
      }
    }
  }, [items, fetchIcon]);

  return icons;
}
