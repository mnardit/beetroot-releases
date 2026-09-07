import { describe, it, expect } from "vitest";
import { transforms } from "../transforms";

describe("transforms", () => {
  const byId = (id: string) => transforms.find((t) => t.id === id)!;

  it("exports 8 transforms", () => {
    expect(transforms).toHaveLength(8);
  });

  it("upper — converts to uppercase", () => {
    expect(byId("upper").fn("hello World")).toBe("HELLO WORLD");
  });

  it("lower — converts to lowercase", () => {
    expect(byId("lower").fn("Hello WORLD")).toBe("hello world");
  });

  it("title — converts to title case", () => {
    expect(byId("title").fn("hello world foo")).toBe("Hello World Foo");
  });

  it("title — handles mixed case", () => {
    expect(byId("title").fn("hELLO wORLD")).toBe("Hello World");
  });

  it("trim — collapses whitespace", () => {
    expect(byId("trim").fn("  hello   world  ")).toBe("hello world");
  });

  it("trim — collapses tabs", () => {
    expect(byId("trim").fn("a\t\tb")).toBe("a b");
  });

  it("nospaces — removes all spaces", () => {
    expect(byId("nospaces").fn("FR12 3456 7890 1234")).toBe("FR12345678901234");
  });

  it("nospaces — preserves tabs and newlines", () => {
    expect(byId("nospaces").fn("a b\tc\nd")).toBe("ab\tc\nd");
  });

  it("nospaces — strips non-breaking spaces (U+00A0)", () => {
    expect(byId("nospaces").fn("FR12\u00A03456\u00A07890")).toBe("FR1234567890");
  });

  it("singleline — joins lines into one", () => {
    expect(byId("singleline").fn("hello\nworld\nfoo")).toBe("hello world foo");
  });

  it("singleline — collapses multiple newlines", () => {
    expect(byId("singleline").fn("a\n\n\nb")).toBe("a b");
  });

  it("sortlines — sorts lines alphabetically", () => {
    expect(byId("sortlines").fn("cherry\napple\nbanana")).toBe("apple\nbanana\ncherry");
  });

  it("sortlines — sorts Cyrillic lines", () => {
    expect(byId("sortlines").fn("вишня\nяблоко\nбанан")).toBe("банан\nвишня\nяблоко");
  });

  it("dedup — removes duplicate lines", () => {
    expect(byId("dedup").fn("apple\nbanana\napple\ncherry\nbanana")).toBe("apple\nbanana\ncherry");
  });

  it("dedup — preserves order of first occurrence", () => {
    expect(byId("dedup").fn("c\nb\na\nb\nc")).toBe("c\nb\na");
  });

  it("dedup — collapses duplicate empty lines", () => {
    expect(byId("dedup").fn("a\n\nb\n\nc")).toBe("a\n\nb\nc");
  });

  it("each transform has id, label, and fn", () => {
    for (const t of transforms) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.label).toBe("string");
      expect(typeof t.fn).toBe("function");
    }
  });
});
