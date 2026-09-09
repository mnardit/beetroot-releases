export type SearchMode = "fuzzy" | "regex";
export type TypeFilter = "all" | "starred" | "text" | "image" | "notes";
export const TYPE_FILTER_VALUES = ["all", "starred", "text", "image", "notes"] as const;

export interface ClipboardEntry {
  id: number;
  content: string;
  content_hash: string;
  content_type: "text" | "image";
  image_path: string | null;
  html_content: string | null;
  note: string | null;
  starred: boolean;
  created_at: string;
  last_used: string;
  source_app: string | null;
  source_title: string | null;
}
