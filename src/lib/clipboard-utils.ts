import type { ClipboardEntry } from "../types/clipboard";

export function textEntry(content: string): ClipboardEntry {
  return {
    id: 0,
    content,
    content_hash: "",
    content_type: "text",
    image_path: null,
    html_content: null,
    note: null,
    starred: false,
    created_at: "",
    last_used: "",
    source_app: null,
    source_title: null,
  };
}
