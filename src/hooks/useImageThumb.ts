import { useState, useEffect, useMemo } from "react";
import { readImageBase64, readImageThumbnail } from "../lib/tauri";
import { THUMB_CACHE_MAX } from "../lib/constants";

const thumbCache = new Map<string, string>();
/** Single-entry cache for full-size preview — preview is one-at-a-time, no need for LRU. */
const previewCache = new Map<string, string>();

/** Module-level pending loads — shared across all component instances, never cancelled */
const pendingLoads = new Map<string, Promise<string>>();

/** Test-only handles. Do not use from production code. */
export const _testing = { thumbCache, previewCache, pendingLoads };

function thumbCacheSet(key: string, value: string) {
  if (thumbCache.has(key)) thumbCache.delete(key);
  if (thumbCache.size >= THUMB_CACHE_MAX) {
    const oldest = thumbCache.keys().next().value;
    if (oldest !== undefined) thumbCache.delete(oldest);
  }
  thumbCache.set(key, value);
}

function previewCacheSet(key: string, value: string) {
  // Single-entry: drop everything before adding new
  previewCache.clear();
  previewCache.set(key, value);
}

export const THUMB_ERROR = "__error__";

/**
 * Cache key encodes both path and maxDim so list thumbnails and full-size
 * previews are stored independently.
 */
function cacheKey(imagePath: string, maxDim: number | null): string {
  return maxDim !== null ? `${imagePath}?dim=${maxDim}` : imagePath;
}

function getCached(key: string, isFullSize: boolean): string | undefined {
  return isFullSize ? previewCache.get(key) : thumbCache.get(key);
}

function setCached(key: string, value: string, isFullSize: boolean) {
  if (isFullSize) {
    previewCacheSet(key, value);
  } else {
    thumbCacheSet(key, value);
  }
}

/** Start loading an image (or join an existing load). Always completes, never cancelled. */
function loadImage(imagePath: string, maxDim: number | null): Promise<string> {
  const key = cacheKey(imagePath, maxDim);
  const existing = pendingLoads.get(key);
  if (existing) return existing;

  const isFullSize = maxDim === null;
  const fetchFn = isFullSize
    ? readImageBase64(imagePath).then((b64) => `data:image/png;base64,${b64}`)
    : readImageThumbnail(imagePath, maxDim).then((dataUrl) => dataUrl);

  const promise = fetchFn
    .then((dataUrl) => {
      setCached(key, dataUrl, isFullSize);
      return dataUrl;
    })
    .catch(() => {
      setCached(key, THUMB_ERROR, isFullSize);
      return THUMB_ERROR;
    })
    .finally(() => {
      pendingLoads.delete(key);
    });

  pendingLoads.set(key, promise);
  return promise;
}

/**
 * Load and cache an image for display.
 *
 * @param imagePath  Path to the image file, or `null` for no-op.
 * @param maxDim     If provided, the image is downscaled via the backend
 *                   `read_image_thumbnail` command (PNG, aspect-ratio preserved).
 *                   Stored in 100-entry LRU `thumbCache`.
 *                   Pass `null` (default) to load the full-resolution image via
 *                   `read_image_base64` — stored in single-entry `previewCache`
 *                   (preview is one-at-a-time so larger cache wastes heap).
 *                   Recommended values: 96 for list thumbnails.
 */
export function useImageThumb(imagePath: string | null, maxDim: number | null = null) {
  const isFullSize = maxDim === null;
  const key = imagePath ? cacheKey(imagePath, maxDim) : null;

  // Get cached value synchronously (no effect needed for cached values)
  const cachedValue = useMemo(
    () => (key ? (getCached(key, isFullSize) ?? null) : null),
    [key, isFullSize],
  );

  // asyncSrc is keyed by the cache key it was loaded for. When the image
  // path changes (e.g. virtualized row reuse, preview navigation) the stale
  // src is gated out until the new key's load resolves — without this, the
  // hook briefly returned the previous image while the new one loaded.
  const [asyncSrc, setAsyncSrc] = useState<{ key: string; src: string } | null>(null);

  useEffect(() => {
    // Skip if no path or already cached
    if (!imagePath || !key) return;
    if (getCached(key, isFullSize) !== undefined) return;

    let mounted = true;

    loadImage(imagePath, maxDim).then((result) => {
      if (mounted) setAsyncSrc({ key, src: result });
    });

    return () => {
      mounted = false;
    };
  }, [imagePath, key, maxDim, isFullSize]);

  // Return cached value if available, otherwise the async-loaded value
  // ONLY if it matches the current key (prevents flashing the previous image).
  return cachedValue ?? (asyncSrc && asyncSrc.key === key ? asyncSrc.src : null);
}
