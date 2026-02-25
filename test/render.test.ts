import { test, expect } from "bun:test";
import { render, getRenderer } from "../src/render/index";
import { parseCsv } from "../src/render/csv";
import { sanitizeSvg } from "../src/render/svg";

// ---- Registry ----

test("getRenderer finds code renderer by extension", () => {
  expect(getRenderer("app.ts", "text/typescript")).not.toBeNull();
  expect(getRenderer("app.py", "text/x-python")).not.toBeNull();
});

test("getRenderer finds markdown renderer", () => {
  expect(getRenderer("README.md", "text/markdown")).not.toBeNull();
});

test("getRenderer finds CSV renderer", () => {
  expect(getRenderer("data.csv", "text/csv")).not.toBeNull();
});

test("getRenderer finds JSON renderer", () => {
  expect(getRenderer("config.json", "application/json")).not.toBeNull();
});

test("getRenderer finds SVG renderer", () => {
  expect(getRenderer("icon.svg", "image/svg+xml")).not.toBeNull();
});

test("getRenderer finds image renderer", () => {
  expect(getRenderer("photo.png", "image/png")).not.toBeNull();
});

test("getRenderer finds PDF renderer", () => {
  expect(getRenderer("doc.pdf", "application/pdf")).not.toBeNull();
});

test("getRenderer returns null for unknown type", () => {
  expect(getRenderer("file.xyz", "application/octet-stream")).toBeNull();
});

test("render returns no-preview for unknown type", async () => {
  const result = await render(Buffer.from("data"), "file.bin", "application/octet-stream");
  expect(result).toContain("No preview available");
});

// ---- Code Renderer ----

test("code renderer highlights TypeScript", async () => {
  const content = Buffer.from('const x: number = 42;\nconsole.log(x);');
  const html = await render(content, "test.ts", "text/typescript");
  expect(html).toContain("lumen-code");
  expect(html).toContain("shiki");
});

test("code renderer falls back for unknown language", async () => {
  const content = Buffer.from("some content");
  const renderer = getRenderer("file.zig", "text/x-zig");
  expect(renderer).not.toBeNull();
  const html = await renderer!(content, "file.zig");
  expect(html).toContain("lumen-code");
});

// ---- Markdown Renderer ----

test("markdown renderer produces HTML", async () => {
  const content = Buffer.from("# Hello\n\nThis is **bold** text.");
  const html = await render(content, "test.md", "text/markdown");
  expect(html).toContain("lumen-markdown");
  expect(html).toContain("<h1>");
  expect(html).toContain("<strong>bold</strong>");
});

test("markdown renderer highlights code blocks", async () => {
  const content = Buffer.from("```typescript\nconst x = 1;\n```");
  const html = await render(content, "test.md", "text/markdown");
  expect(html).toContain("shiki");
});

test("markdown renderer rewrites relative links", async () => {
  const content = Buffer.from("[link](./other.md)\n![img](./image.png)");
  const html = await render(content, "test.md", "text/markdown", { bucketId: "b123" });
  expect(html).toContain("/b123/other.md");
  expect(html).toContain("/raw/b123/image.png");
});

test("markdown renderer leaves absolute links unchanged", async () => {
  const content = Buffer.from("[ext](https://example.com)");
  const html = await render(content, "test.md", "text/markdown", { bucketId: "b123" });
  expect(html).toContain("https://example.com");
});

// ---- CSV Renderer ----

test("parseCsv handles basic CSV", () => {
  const rows = parseCsv("a,b,c\n1,2,3\n4,5,6");
  expect(rows).toEqual([["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
});

test("parseCsv handles quoted fields", () => {
  const rows = parseCsv('name,value\n"hello, world",42\n"with ""quotes""",0');
  expect(rows[1][0]).toBe("hello, world");
  expect(rows[2][0]).toBe('with "quotes"');
});

test("parseCsv handles empty CSV", () => {
  const rows = parseCsv("");
  expect(rows).toEqual([]);
});

test("CSV renderer produces table HTML", async () => {
  const content = Buffer.from("name,age\nAlice,30\nBob,25");
  const html = await render(content, "data.csv", "text/csv");
  expect(html).toContain("lumen-csv");
  expect(html).toContain("<table>");
  expect(html).toContain("<th>name</th>");
  expect(html).toContain("Alice");
});

// ---- JSON Renderer ----

test("JSON renderer renders nested objects", async () => {
  const content = Buffer.from(JSON.stringify({ name: "test", items: [1, 2], nested: { key: true } }));
  const html = await render(content, "data.json", "application/json");
  expect(html).toContain("lumen-json");
  expect(html).toContain("json-key");
  expect(html).toContain("json-string");
  expect(html).toContain("json-number");
  expect(html).toContain("json-boolean");
});

test("JSON renderer handles invalid JSON", async () => {
  const content = Buffer.from("{invalid json}");
  const html = await render(content, "bad.json", "application/json");
  expect(html).toContain("Invalid JSON");
});

test("JSON renderer handles null", async () => {
  const content = Buffer.from(JSON.stringify({ key: null }));
  const html = await render(content, "null.json", "application/json");
  expect(html).toContain("json-null");
});

// ---- SVG Renderer ----

test("SVG renderer passes clean SVG through", async () => {
  const svg = '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
  const html = await render(Buffer.from(svg), "icon.svg", "image/svg+xml");
  expect(html).toContain("lumen-svg");
  expect(html).toContain("<circle");
});

test("sanitizeSvg removes script tags", () => {
  const result = sanitizeSvg('<svg><script>alert("xss")</script><circle/></svg>');
  expect(result).not.toContain("<script>");
  expect(result).toContain("<circle/>");
});

test("sanitizeSvg removes event handlers", () => {
  const result = sanitizeSvg('<svg><rect onload="alert(1)" onclick="evil()"/></svg>');
  expect(result).not.toContain("onload");
  expect(result).not.toContain("onclick");
});

test("sanitizeSvg removes javascript: URLs", () => {
  const result = sanitizeSvg('<svg><a href="javascript:alert(1)"><text>click</text></a></svg>');
  expect(result).not.toContain("javascript:");
});

// ---- Image Renderer ----

test("image renderer outputs img tag", async () => {
  const html = await render(Buffer.from(""), "photo.png", "image/png", { bucketId: "b123" });
  expect(html).toContain("lumen-image");
  expect(html).toContain('<img src="/raw/b123/photo.png"');
  expect(html).toContain('alt="photo.png"');
});

// ---- PDF Renderer ----

test("PDF renderer outputs object embed and download link", async () => {
  const html = await render(Buffer.from(""), "doc.pdf", "application/pdf", { bucketId: "b123" });
  expect(html).toContain("lumen-pdf");
  expect(html).toContain('<object data="/raw/b123/doc.pdf"');
  expect(html).toContain("Download doc.pdf");
});
