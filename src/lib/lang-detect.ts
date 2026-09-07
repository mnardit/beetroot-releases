import type { ModelOperations as ModelOpsType } from "@vscode/vscode-languagedetection";

let model: ModelOpsType | null = null;
const cache = new Map<string, string>();

// VS Code ML model returns short IDs (file extensions), hljs uses full names
const LANG_MAP: Record<string, string> = {
  rs: "rust",
  kt: "kotlin",
  rb: "ruby",
  py: "python",
  ts: "typescript",
  js: "javascript",
  cs: "csharp",
  mm: "objectivec",
  el: "lisp",
  ex: "elixir",
  sh: "bash",
  bat: "dos",
  ps1: "powershell",
  md: "markdown",
  tex: "latex",
  hs: "haskell",
  clj: "clojure",
  erl: "erlang",
  fs: "fsharp",
  pl: "perl",
  r: "r",
};

function mapLang(id: string): string {
  return LANG_MAP[id] ?? id;
}

export async function detectLanguage(code: string): Promise<string> {
  const key = code.slice(0, 500);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  if (!model) {
    try {
      const { ModelOperations } = await import("@vscode/vscode-languagedetection");
      model = new ModelOperations({
        modelJsonLoaderFunc: () => fetch("/model/model.json").then((r) => r.json()),
        weightsLoaderFunc: () => fetch("/model/group1-shard1of1.bin").then((r) => r.arrayBuffer()),
      });
    } catch (e) {
      console.error("[lang-detect] Failed to load ML model:", e);
      cache.set(key, "");
      return "";
    }
  }

  let results;
  try {
    results = await model.runModel(code);
  } catch (e) {
    console.error("[lang-detect] runModel failed:", e);
    cache.set(key, "");
    return "";
  }
  const raw = results[0]?.languageId ?? "";
  const lang = mapLang(raw);

  if (cache.size > 1000) {
    const keys = cache.keys();
    for (let i = 0; i < 200; i++) {
      const n = keys.next();
      if (n.done) break;
      cache.delete(n.value);
    }
  }
  cache.set(key, lang);
  return lang;
}
