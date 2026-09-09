export type ContentType = "url" | "email" | "code" | "json" | "color" | "plain";

const URL_RE = /^https?:\/\/\S+|^www\.\S+/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}){1,2}$/i;
const RGB_COLOR_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/i;
const CODE_PATTERNS =
  /\b(?:function|const|let|var|import|export|class|def|public|private|return|if|else|for|while)\b/;
const CODE_BRACES = /[{};]/;
// SQL: statement keyword at line start (or after ;/() + structural keyword
const SQL_STATEMENT_RE = /(?:^|[;(])\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im;
const SQL_CLAUSE_RE =
  /\b(?:FROM|WHERE|JOIN|INTO|VALUES|SET|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|BETWEEN|EXISTS|DISTINCT|LIMIT|OFFSET|TABLE|INDEX|ON)\b/i;
const SHELL_RE =
  /(?:^|\|)\s*(?:sudo|apt|npm|yarn|pnpm|git|cd|ls|mkdir|rm|cp|mv|chmod|chown|grep|curl|wget|cat|echo|export|source|pip|brew|cargo|docker|kubectl)\b/m;
// Strong language-specific signals (no braces check needed)
const CODE_LANG_SPECIFIC =
  /\bfn\s+\w+|impl\s+\w+|\btrait\s+\w+|println!|macro_rules!|#\[derive|func\s+\w+|defer\s|:=\s|fmt\.\w+|guard\s+let|@IBOutlet|attr_accessor|elsif\b|unless\b|<\?php|\$this->/;
// Object/config literals: multiple key: value lines with nesting (JS objects, YAML-like configs)
const OBJ_LITERAL_RE = /^\s*\{[\s\S]*\w+\s*:\s*.+[\s\S]*\w+\s*:\s*.+[\s\S]*\}\s*$/;
const REGEX_RE = /\\[sdwbSDWB]|\\[tn]|\[\^[^\]]+\]|\(\?[=!:<]/;
// Windows paths (C:\...) and LaTeX (\section, \begin) produce false \s, \d, \b, \t, \n matches
const WIN_PATH_RE = /^[A-Za-z]:\\/;
const LATEX_RE =
  /\\(?:begin|end|section|subsection|paragraph|textbf|textit|usepackage|documentclass|frac|item|label|ref|cite|emph)\b/;
const HSL_COLOR_RE = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?/i;
const URL_EXTRACT_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const COLOR_EXTRACT_RE =
  /#(?:[0-9a-f]{3}){1,2}\b|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*[\d.]+)?\s*\)|hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?(?:\s*,\s*[\d.]+)?\s*\)/i;

const contentTypeCache = new Map<string, ContentType>();

function looksLikeCode(text: string): boolean {
  // JS/Python/Java/C keywords + braces/semicolons
  if (CODE_PATTERNS.test(text) && CODE_BRACES.test(text)) return true;
  // Rust/Go/Swift/Ruby/PHP — unambiguous language-specific patterns
  if (CODE_LANG_SPECIFIC.test(text)) return true;
  // SQL: statement keyword at line start + structural clause
  if (SQL_STATEMENT_RE.test(text) && SQL_CLAUSE_RE.test(text)) return true;
  // Shell: CLI commands at line start or after pipe
  if (SHELL_RE.test(text)) return true;
  // Regex: [^...] negated char class, (?= lookahead — skip for Windows paths and LaTeX
  if (REGEX_RE.test(text) && !WIN_PATH_RE.test(text) && !LATEX_RE.test(text)) return true;
  return false;
}

export function detectContentType(text: string): ContentType {
  const trimmed = text.trim();
  const cached = contentTypeCache.get(trimmed);
  if (cached !== undefined) return cached;

  let result: ContentType = "plain";

  if (trimmed) {
    // Color: hex, rgb(), or hsl()
    if (HEX_COLOR_RE.test(trimmed) || RGB_COLOR_RE.test(trimmed) || HSL_COLOR_RE.test(trimmed))
      result = "color";
    // Email: single-line with @ and domain
    else if (trimmed.indexOf("\n") === -1 && EMAIL_RE.test(trimmed)) result = "email";
    // URL: starts with http(s):// or www.
    else if (URL_RE.test(trimmed)) result = "url";
    // JSON: starts with { or [ and is valid JSON
    else if ((trimmed[0] === "{" || trimmed[0] === "[") && trimmed.length > 1) {
      try {
        JSON.parse(trimmed);
        result = "json";
      } catch {
        // not valid JSON — check for code patterns or object/config literals
        if (looksLikeCode(trimmed) || OBJ_LITERAL_RE.test(trimmed)) result = "code";
      }
    } else if (looksLikeCode(trimmed)) result = "code";
  }

  // Only cache small entries to limit memory (1000 × 10KB = 10MB max)
  if (trimmed.length <= 10_000) {
    if (contentTypeCache.size > 1000) {
      const keys = contentTypeCache.keys();
      for (let i = 0; i < 200; i++) {
        const next = keys.next();
        if (next.done) break;
        contentTypeCache.delete(next.value);
      }
    }
    contentTypeCache.set(trimmed, result);
  }
  return result;
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_EXTRACT_RE);
  return matches ? [...new Set(matches)] : [];
}

const colorCache = new Map<string, string | null>();

export function extractColor(text: string): string | null {
  const trimmed = text.trim();
  const cached = colorCache.get(trimmed);
  if (cached !== undefined) return cached;

  const match = trimmed.match(COLOR_EXTRACT_RE);
  const result = match ? match[0] : null;

  if (trimmed.length <= 10_000) {
    if (colorCache.size > 1000) {
      const keys = colorCache.keys();
      for (let i = 0; i < 200; i++) {
        const next = keys.next();
        if (next.done) break;
        colorCache.delete(next.value);
      }
    }
    colorCache.set(trimmed, result);
  }
  return result;
}
