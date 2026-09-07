import { describe, it, expect } from "vitest";
import { detectContentType, extractUrls } from "../content-detect";

describe("detectContentType", () => {
  it("detects URLs starting with http", () => {
    expect(detectContentType("https://example.com")).toBe("url");
    expect(detectContentType("http://localhost:3000/path")).toBe("url");
  });

  it("detects URLs starting with www", () => {
    expect(detectContentType("www.example.com")).toBe("url");
  });

  it("detects email addresses", () => {
    expect(detectContentType("user@example.com")).toBe("email");
    expect(detectContentType("test.user+tag@domain.co.uk")).toBe("email");
  });

  it("detects JSON objects", () => {
    expect(detectContentType('{"key": "value"}')).toBe("json");
    expect(detectContentType("[1, 2, 3]")).toBe("json");
  });

  it("does not detect invalid JSON", () => {
    expect(detectContentType("{not json}")).not.toBe("json");
  });

  it("detects hex colors", () => {
    expect(detectContentType("#ff0000")).toBe("color");
    expect(detectContentType("#FFF")).toBe("color");
  });

  it("detects rgb colors", () => {
    expect(detectContentType("rgb(255, 0, 0)")).toBe("color");
    expect(detectContentType("rgba(0, 128, 255, 0.5)")).toBe("color");
  });

  it("detects code snippets", () => {
    expect(detectContentType("function hello() { return 1; }")).toBe("code");
    expect(detectContentType("const x = { a: 1 };")).toBe("code");
    expect(detectContentType("import React from 'react';\nclass App {}")).toBe("code");
  });

  it("returns plain for regular text", () => {
    expect(detectContentType("Hello world")).toBe("plain");
    expect(detectContentType("just some text")).toBe("plain");
    expect(detectContentType("")).toBe("plain");
  });

  it("returns plain for empty/whitespace", () => {
    expect(detectContentType("   ")).toBe("plain");
  });

  it("detects SQL queries as code", () => {
    expect(detectContentType("SELECT * FROM users WHERE id = 1")).toBe("code");
    expect(detectContentType("INSERT INTO logs (msg) VALUES ('test')")).toBe("code");
    expect(detectContentType("UPDATE users SET name = 'John' WHERE id = 1")).toBe("code");
    expect(detectContentType("DELETE FROM sessions WHERE expired = true")).toBe("code");
    expect(detectContentType("SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id")).toBe(
      "code",
    );
    expect(detectContentType("CREATE TABLE users (id INT, name VARCHAR(255))")).toBe("code");
    expect(
      detectContentType("SELECT COUNT(*) FROM orders GROUP BY status ORDER BY count DESC LIMIT 10"),
    ).toBe("code");
  });

  it("does not false-positive plain text as SQL", () => {
    expect(detectContentType("Please select a color from the list")).toBe("plain");
    expect(detectContentType("I need to update my phone")).toBe("plain");
    expect(detectContentType("delete this message")).toBe("plain");
  });

  it("detects shell commands as code", () => {
    expect(detectContentType("npm install express")).toBe("code");
    expect(detectContentType("git commit -m 'fix bug'")).toBe("code");
    expect(detectContentType("cat file.txt | grep error | sort")).toBe("code");
    expect(detectContentType("sudo apt install nginx")).toBe("code");
    expect(detectContentType("curl -s https://api.example.com/data")).toBe("code");
    expect(detectContentType("docker run -d -p 8080:80 nginx")).toBe("code");
    expect(detectContentType("cargo build --release")).toBe("code");
  });

  it("detects regex patterns as code", () => {
    expect(detectContentType("\\d+\\.\\d+\\.\\d+")).toBe("code");
    expect(detectContentType("(?=.*[A-Z])(?=.*\\d)")).toBe("code");
    expect(detectContentType("\\bfunction\\b|\\bclass\\b")).toBe("code");
    expect(detectContentType("[^a-z0-9]+")).toBe("code");
  });

  it("does not false-positive Windows paths as code", () => {
    expect(detectContentType("C:\\data\\report.txt")).toBe("plain");
    expect(detectContentType("C:\\users\\name\\new folder")).toBe("plain");
    expect(detectContentType("D:\\Downloads\\setup.exe")).toBe("plain");
    expect(detectContentType("C:\\Windows\\System32\\drivers\\etc\\hosts")).toBe("plain");
  });

  it("detects Rust code", () => {
    expect(detectContentType('fn main() {\n    println!("Hello");\n}')).toBe("code");
    expect(detectContentType("impl Display for MyStruct {\n    fn fmt(&self) {}\n}")).toBe("code");
    expect(detectContentType("#[derive(Debug, Clone)]\nstruct Point { x: f64, y: f64 }")).toBe(
      "code",
    );
  });

  it("detects Go code", () => {
    expect(detectContentType('func main() {\n    fmt.Println("Hello")\n}')).toBe("code");
    expect(detectContentType("x := 42\ndefer file.Close()")).toBe("code");
  });

  it("detects Swift code", () => {
    expect(detectContentType("guard let value = optional else { return }")).toBe("code");
  });

  it("detects Ruby code", () => {
    expect(detectContentType("attr_accessor :name\ndef greet\n  puts 'hi'\nend")).toBe("code");
    expect(detectContentType("unless condition\n  do_something\nend")).toBe("code");
  });

  it("detects PHP code", () => {
    expect(detectContentType("<?php echo 'hello'; ?>")).toBe("code");
    expect(detectContentType("$this->name = 'test';")).toBe("code");
  });

  it("detects JS/TS object literals as code", () => {
    expect(
      detectContentType(
        '{\n  model: "gpt-5-nano",\n  messages: [\n    { role: "user", content: text },\n  ],\n  max_completion_tokens: 4096,\n}',
      ),
    ).toBe("code");
    expect(detectContentType('{\n  host: "localhost",\n  port: 3000,\n  debug: true,\n}')).toBe(
      "code",
    );
  });

  it("does not false-positive short braced text as code", () => {
    expect(detectContentType("{hello}")).toBe("plain");
    expect(detectContentType("{not code}")).toBe("plain");
  });

  it("does not false-positive LaTeX as code", () => {
    expect(detectContentType("\\section{Introduction}")).toBe("plain");
    expect(detectContentType("\\begin{document}\\end{document}")).toBe("plain");
    expect(detectContentType("\\textbf{bold text}")).toBe("plain");
    expect(detectContentType("\\usepackage{amsmath}")).toBe("plain");
  });
});

describe("extractUrls", () => {
  it("extracts URLs from text", () => {
    const text = "Check https://example.com and http://test.org/path for details";
    const urls = extractUrls(text);
    expect(urls).toEqual(["https://example.com", "http://test.org/path"]);
  });

  it("returns empty array when no URLs", () => {
    expect(extractUrls("no urls here")).toEqual([]);
  });

  it("deduplicates URLs", () => {
    const text = "https://a.com and https://a.com again";
    expect(extractUrls(text)).toEqual(["https://a.com"]);
  });
});
