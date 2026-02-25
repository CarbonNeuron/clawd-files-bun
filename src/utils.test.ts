import { test, expect } from "bun:test";
import {
  generateShortCode,
  generateBucketId,
  getMimeType,
  wantsJson,
  wantsHtml,
  escapeHtml,
  formatBytes,
  formatRelativeDate,
  parseExpiresIn,
} from "./utils";

test("generateShortCode returns correct length", () => {
  expect(generateShortCode(6)).toHaveLength(6);
  expect(generateShortCode(8)).toHaveLength(8);
});

test("generateShortCode excludes confusing characters", () => {
  for (let i = 0; i < 100; i++) {
    const code = generateShortCode(20);
    expect(code).not.toMatch(/[0OoIl1]/);
  }
});

test("generateBucketId returns 10-char string", () => {
  const id = generateBucketId();
  expect(id).toHaveLength(10);
  expect(id).toMatch(/^[a-z0-9]+$/);
});

test("getMimeType returns correct MIME types", () => {
  expect(getMimeType("file.ts")).toBe("text/typescript");
  expect(getMimeType("image.png")).toBe("image/png");
  expect(getMimeType("doc.pdf")).toBe("application/pdf");
  expect(getMimeType("video.mp4")).toBe("video/mp4");
  expect(getMimeType("FILE.JSON")).toBe("application/json");
  expect(getMimeType("unknown.xyz")).toBe("application/octet-stream");
});

test("wantsJson detects JSON preference", () => {
  const jsonReq = new Request("http://localhost/test", {
    headers: { accept: "application/json" },
  });
  expect(wantsJson(jsonReq)).toBe(true);

  const curlReq = new Request("http://localhost/test", {
    headers: { "user-agent": "curl/8.0" },
  });
  expect(wantsJson(curlReq)).toBe(true);

  const htmlReq = new Request("http://localhost/test", {
    headers: { accept: "text/html" },
  });
  expect(wantsJson(htmlReq)).toBe(false);
});

test("wantsHtml detects HTML preference", () => {
  const req = new Request("http://localhost/test", {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  expect(wantsHtml(req)).toBe(true);

  const jsonReq = new Request("http://localhost/test", {
    headers: { accept: "application/json" },
  });
  expect(wantsHtml(jsonReq)).toBe(false);
});

test("escapeHtml escapes special characters", () => {
  expect(escapeHtml("<script>alert('xss')</script>")).not.toContain("<script>");
  expect(escapeHtml('a"b')).toContain("&quot;");
});

test("formatBytes formats correctly", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1024)).toBe("1.0 KB");
  expect(formatBytes(1536)).toBe("1.5 KB");
  expect(formatBytes(1048576)).toBe("1.0 MB");
  expect(formatBytes(1073741824)).toBe("1.0 GB");
});

test("formatRelativeDate returns human-readable strings", () => {
  const now = Math.floor(Date.now() / 1000);
  expect(formatRelativeDate(now - 30)).toBe("just now");
  expect(formatRelativeDate(now - 120)).toBe("2m ago");
  expect(formatRelativeDate(now - 7200)).toBe("2h ago");
  expect(formatRelativeDate(now - 172800)).toBe("2d ago");
});

test("parseExpiresIn parses duration strings", () => {
  const now = Math.floor(Date.now() / 1000);

  const h1 = parseExpiresIn("1h");
  expect(h1).toBeGreaterThan(now);
  expect(h1! - now).toBeGreaterThanOrEqual(3599);
  expect(h1! - now).toBeLessThanOrEqual(3601);

  const d7 = parseExpiresIn("7d");
  expect(d7! - now).toBeGreaterThanOrEqual(604799);

  expect(parseExpiresIn("never")).toBeNull();
  expect(parseExpiresIn("")).toBeNull();
  expect(parseExpiresIn("invalid")).toBeNull();
});
