import { useMemo } from "react";
import { detectContentType, type ContentType } from "../lib/content-detect";
import type { ClipboardEntry } from "../types/clipboard";

/**
 * Detects content type for a clipboard entry, accounting for images.
 * Returns the detected content type and whether the entry is an image.
 */
export function useContentType(item: ClipboardEntry): {
  contentType: ContentType;
  isImage: boolean;
} {
  const isImage = item.content_type === "image" && !!item.image_path;
  const contentType = useMemo(
    () => (isImage ? ("plain" as ContentType) : detectContentType(item.content)),
    [isImage, item.content],
  );
  return { contentType, isImage };
}
