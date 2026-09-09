export interface Transform {
  id: string;
  label: string;
  fn: (text: string) => string;
}

export const transforms: Transform[] = [
  { id: "upper", label: "UPPERCASE", fn: (t) => t.toUpperCase() },
  { id: "lower", label: "lowercase", fn: (t) => t.toLowerCase() },
  {
    id: "title",
    label: "Title Case",
    fn: (t) =>
      t.replace(/(?:^|[\s\-_])[\p{L}\p{N}]\S*/gu, (w) => {
        const lead = w.match(/^[\s\-_]*/)?.[0] ?? "";
        const word = w.slice(lead.length);
        return lead + word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase();
      }),
  },
  { id: "trim", label: "Trim whitespace", fn: (t) => t.trim().replace(/[ \t]+/g, " ") },
  { id: "nospaces", label: "Remove spaces", fn: (t) => t.replace(/[\p{Zs}]/gu, "") },
  {
    id: "singleline",
    label: "Single line",
    fn: (t) =>
      t
        .replace(/[\r\n]+/g, " ")
        .replace(/ {2,}/g, " ")
        .trim(),
  },
  {
    id: "sortlines",
    label: "Sort lines",
    fn: (t) =>
      t
        .split(/\r?\n/)
        .sort((a, b) => a.localeCompare(b))
        .join("\n"),
  },
  { id: "dedup", label: "Remove duplicates", fn: (t) => [...new Set(t.split(/\r?\n/))].join("\n") },
];
