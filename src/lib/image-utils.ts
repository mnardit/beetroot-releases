/** Determine MIME type from image file path extension. */
export function getMimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const mimes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
  };
  return mimes[ext || ""] || "image/png";
}
