import { describe, it, expect, beforeAll } from "vitest";
import { transforms } from "../transforms";
import type { ClipboardEntry } from "../../types/clipboard";

// ---------------------------------------------------------------------------
// Mock data generation
// ---------------------------------------------------------------------------

const ITEM_COUNT = 2000;

const CODE_SNIPPETS = [
  'const result = await fetch("/api/data").then(r => r.json());',
  "function fibonacci(n: number): number { return n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2); }",
  'import { useState, useEffect } from "react";\n\nexport function useDebounce<T>(value: T, delay: number): T {\n  const [debounced, setDebounced] = useState(value);\n  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);\n  return debounced;\n}',
  "SELECT u.id, u.name, COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id HAVING order_count > 5 ORDER BY order_count DESC;",
  "git log --oneline --graph --decorate --all | head -20",
  '#include <iostream>\nint main() {\n  std::cout << "Hello World" << std::endl;\n  return 0;\n}',
  'try {\n  const data = JSON.parse(rawInput);\n  validate(data);\n} catch (err) {\n  logger.error("Parse failed", { err });\n  throw new ValidationError("Invalid input");\n}',
  "docker run -d --name postgres -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:16-alpine",
];

const SENTENCES = [
  "The quick brown fox jumps over the lazy dog near the river bank",
  "React hooks simplify state management in functional components",
  "Please review the pull request before merging to main branch",
  "Meeting scheduled for tomorrow at 3pm in conference room B",
  "npm install completed successfully with 0 vulnerabilities",
  "The deployment pipeline runs tests, linting, and builds in parallel",
  "Customer reported an issue with the login page on mobile devices",
  "Updated the README documentation with new API endpoint details",
  "Performance optimization reduced load time by 40 percent",
  "Database migration v5 adds html_content column for rich text support",
  "The clipboard manager supports text and image history with OCR",
  "Keyboard shortcuts help users navigate the application quickly",
  "Error boundary catches rendering exceptions and shows a retry button",
  "System tray icon adapts to the Windows theme automatically",
  "Virtual scrolling renders only visible items for better performance",
  "Fuzzy search powered by Fuse.js finds approximate text matches",
  "Settings are persisted in localStorage with validation on load",
  "The application starts hidden and shows via global hotkey",
  "AI transforms use GPT-5 nano model for text processing",
  "Multi-monitor support centers the window on the active display",
];

const URLS = [
  "https://github.com/tauri-apps/tauri/issues/12345",
  "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference",
  "https://stackoverflow.com/questions/12345678/how-to-fix-react-hook",
  "https://docs.rs/tauri/latest/tauri/struct.Builder.html",
  "https://www.typescriptlang.org/docs/handbook/2/types-from-types.html",
];

const SPECIAL_CHARS = [
  "email@example.com — copied from inbox",
  "C:\\Users\\Admin\\Documents\\project\\src\\main.rs",
  "{ key: 'value', nested: { arr: [1, 2, 3] } }",
  "<div className={styles.container}><span>{text}</span></div>",
  "price = $49.99 | discount = 15% | total = $42.49",
  "regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/",
  "tab\tseparated\tvalues\there",
  "unicode: \u00e9\u00e8\u00ea\u00eb \u00fc\u00f6\u00e4 \u00f1 \u2014 \u2013 \u2026 \u2018quotes\u2019",
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateMockItems(count: number): ClipboardEntry[] {
  const rand = seededRandom(42);
  const items: ClipboardEntry[] = [];
  const allTexts = [...SENTENCES, ...CODE_SNIPPETS, ...URLS, ...SPECIAL_CHARS];

  for (let i = 0; i < count; i++) {
    const r = rand();
    let content: string;
    let contentType: "text" | "image" = "text";

    if (r < 0.05) {
      // 5% image entries
      contentType = "image";
      content = `image_${i}.png`;
    } else if (r < 0.25) {
      // 20% code snippets — pick and vary
      const snippet = CODE_SNIPPETS[Math.floor(rand() * CODE_SNIPPETS.length)];
      content = snippet + `\n// variation ${i}`;
    } else if (r < 0.35) {
      // 10% URLs with context
      const url = URLS[Math.floor(rand() * URLS.length)];
      content = `Check this out: ${url} (item ${i})`;
    } else if (r < 0.45) {
      // 10% special characters
      const special = SPECIAL_CHARS[Math.floor(rand() * SPECIAL_CHARS.length)];
      content = special;
    } else if (r < 0.65) {
      // 20% multi-sentence paragraphs
      const sentenceCount = 2 + Math.floor(rand() * 4);
      const parts: string[] = [];
      for (let s = 0; s < sentenceCount; s++) {
        parts.push(allTexts[Math.floor(rand() * allTexts.length)]);
      }
      content = parts.join(". ") + ".";
    } else {
      // 35% single sentences
      content = SENTENCES[Math.floor(rand() * SENTENCES.length)] + ` (#${i})`;
    }

    items.push({
      id: i + 1,
      content,
      content_hash: `hash_${i.toString(16).padStart(8, "0")}`,
      content_type: contentType,
      image_path: contentType === "image" ? `/images/2025-01/${content}` : null,
      html_content: null,
      note: null,
      starred: rand() < 0.1, // 10% starred
      created_at: new Date(2025, 0, 1, 0, 0, i).toISOString(),
      last_used: new Date(2025, 0, 1, 0, 0, i).toISOString(),
      source_app: null,
      source_title: null,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let mockItems: ClipboardEntry[];

beforeAll(() => {
  mockItems = generateMockItems(ITEM_COUNT);
});

describe("performance", () => {
  // Search performance is now tested via Rust unit tests (search.rs).

  // -------------------------------------------------------------------------
  // 1. Filter/sort performance
  // -------------------------------------------------------------------------
  describe("filter and sort with 2000 items", () => {
    it("filter text items under 10ms", () => {
      const start = performance.now();
      const textItems = mockItems.filter((i) => i.content_type === "text");
      const elapsed = performance.now() - start;

      expect(textItems.length).toBeGreaterThan(0);
      expect(textItems.length).toBeLessThan(ITEM_COUNT);
      expect(elapsed).toBeLessThan(10);
    });

    it("filter image items under 10ms", () => {
      const start = performance.now();
      const imageItems = mockItems.filter((i) => i.content_type === "image");
      const elapsed = performance.now() - start;

      expect(imageItems.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(10);
    });

    it("filter starred items under 10ms", () => {
      const start = performance.now();
      const starred = mockItems.filter((i) => i.starred);
      const elapsed = performance.now() - start;

      expect(starred.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(10);
    });

    it("combined filter + hasImages check under 20ms", () => {
      // Simulate the useMemo computation from useAppState
      const start = performance.now();

      const filtered = mockItems.filter((i) => i.content_type === "text");
      const hasImages = mockItems.some((i) => i.content_type === "image");
      const matchMap = new Map<number, readonly unknown[]>();
      for (const item of filtered) {
        matchMap.set(item.id, []);
      }

      const elapsed = performance.now() - start;

      expect(filtered.length).toBeGreaterThan(0);
      expect(hasImages).toBe(true);
      expect(matchMap.size).toBe(filtered.length);
      expect(elapsed).toBeLessThan(20);
    });

    it("sort by last_used under 20ms", () => {
      const copy = [...mockItems];
      const start = performance.now();
      copy.sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime());
      const elapsed = performance.now() - start;

      expect(copy[0].id).toBeDefined();
      expect(elapsed).toBeLessThan(20);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Batch operations
  // -------------------------------------------------------------------------
  describe("batch operations", () => {
    it("build SQL IN clause for 100 items under 5ms", () => {
      const ids = mockItems.slice(0, 100).map((i) => i.id);

      const start = performance.now();
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `DELETE FROM clipboard_items WHERE id IN (${placeholders})`;
      const elapsed = performance.now() - start;

      expect(sql).toContain("IN (");
      expect(placeholders.split(", ").length).toBe(100);
      expect(elapsed).toBeLessThan(5);
    });

    it("batch copy join 50 items with separator under 5ms", () => {
      const selected = mockItems.filter((i) => i.content_type === "text").slice(0, 50);

      const separators = ["\n", "\n\n", ", ", " | "];

      for (const sep of separators) {
        const start = performance.now();
        const joined = selected.map((i) => i.content).join(sep);
        const elapsed = performance.now() - start;

        expect(joined.length).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(5);
      }
    });

    it("apply all 8 transforms to 50 items under 20ms", () => {
      const selected = mockItems.filter((i) => i.content_type === "text").slice(0, 50);

      const start = performance.now();
      for (const transform of transforms) {
        for (const item of selected) {
          transform.fn(item.content);
        }
      }
      const elapsed = performance.now() - start;

      expect(transforms.length).toBe(8);
      expect(elapsed).toBeLessThan(20);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Data generation validation
  // -------------------------------------------------------------------------
  describe("mock data quality", () => {
    it("generates exactly 2000 items", () => {
      expect(mockItems.length).toBe(ITEM_COUNT);
    });

    it("has varied content types", () => {
      const textCount = mockItems.filter((i) => i.content_type === "text").length;
      const imageCount = mockItems.filter((i) => i.content_type === "image").length;

      expect(textCount).toBeGreaterThan(1800);
      expect(imageCount).toBeGreaterThan(50);
      expect(textCount + imageCount).toBe(ITEM_COUNT);
    });

    it("has varied content lengths", () => {
      const lengths = mockItems
        .filter((i) => i.content_type === "text")
        .map((i) => i.content.length);
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);

      expect(minLen).toBeLessThan(50);
      expect(maxLen).toBeGreaterThan(200);
    });

    it("has some starred items", () => {
      const starredCount = mockItems.filter((i) => i.starred).length;
      expect(starredCount).toBeGreaterThan(50);
      expect(starredCount).toBeLessThan(400);
    });

    it("has unique IDs", () => {
      const ids = new Set(mockItems.map((i) => i.id));
      expect(ids.size).toBe(ITEM_COUNT);
    });

    it("produces deterministic output (seeded random)", () => {
      const items2 = generateMockItems(ITEM_COUNT);
      expect(items2[0].content).toBe(mockItems[0].content);
      expect(items2[999].content).toBe(mockItems[999].content);
      expect(items2[1999].content).toBe(mockItems[1999].content);
    });
  });
});
