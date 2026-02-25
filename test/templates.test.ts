import { test, expect, beforeAll } from "bun:test";
import { layout } from "../src/templates/layout";
import { homePage } from "../src/templates/home";
import { bucketPage } from "../src/templates/bucket";
import { filePage } from "../src/templates/file";
import { buildClientJs } from "../src/client-bundle";
import type { BucketRow, FileRow, VersionRow } from "../src/db";

beforeAll(async () => {
  await buildClientJs();
});

test("layout renders HTML document shell", () => {
  const html = layout({ title: "Test", content: "<p>Hello</p>" });
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("<title>Test — ClawdFiles</title>");
  expect(html).toContain("ClawdFiles");
  expect(html).toContain("<style>");
  expect(html).toContain("<p>Hello</p>");
});

test("layout escapes title", () => {
  const html = layout({ title: '<script>alert("xss")</script>', content: "" });
  expect(html).not.toContain("<script>alert");
  expect(html).toContain("&lt;script&gt;");
});

test("home page renders features", () => {
  const html = homePage();
  expect(html).toContain("ClawdFiles");
  expect(html).toContain("Built-in Previews");
  expect(html).toContain("Version History");
});

test("bucket page renders file table", () => {
  const bucket: BucketRow = {
    id: "test123456",
    name: "Test Bucket",
    description: "A test",
    purpose: "testing",
    owner_key_hash: "hash",
    created_at: Math.floor(Date.now() / 1000) - 3600,
    expires_at: null,
    file_count: 2,
    total_size: 1024,
  };

  const files: FileRow[] = [
    { id: 1, bucket_id: "test123456", path: "hello.txt", size: 512, mime_type: "text/plain", short_code: "abc123", version: 1, sha256: "sha", uploaded_at: Math.floor(Date.now() / 1000) - 1800 },
    { id: 2, bucket_id: "test123456", path: "app.ts", size: 512, mime_type: "text/typescript", short_code: "def456", version: 1, sha256: "sha2", uploaded_at: Math.floor(Date.now() / 1000) - 900 },
  ];

  const html = bucketPage(bucket, files);
  expect(html).toContain("Test Bucket");
  expect(html).toContain("hello.txt");
  expect(html).toContain("app.ts");
  expect(html).toContain("2 files");
  expect(html).toContain("no expiry");
  expect(html).toContain('"bucketId":"test123456"');
});

test("file page renders preview and metadata", () => {
  const bucket: BucketRow = {
    id: "test123456",
    name: "Test Bucket",
    description: "",
    purpose: "",
    owner_key_hash: "hash",
    created_at: Math.floor(Date.now() / 1000),
    expires_at: null,
    file_count: 1,
    total_size: 100,
  };

  const file: FileRow = {
    id: 1,
    bucket_id: "test123456",
    path: "readme.md",
    size: 100,
    mime_type: "text/markdown",
    short_code: "abc123",
    version: 2,
    sha256: "sha",
    uploaded_at: Math.floor(Date.now() / 1000),
  };

  const versions: VersionRow[] = [
    { id: 1, file_id: 1, version: 1, size: 80, sha256: "sha_v1", created_at: Math.floor(Date.now() / 1000) - 3600 },
  ];

  const html = filePage(bucket, file, "<p>Rendered content</p>", versions);
  expect(html).toContain("readme.md");
  expect(html).toContain("Rendered content");
  expect(html).toContain("v2");
  expect(html).toContain("Version History");
  expect(html).toContain("abc123");
  expect(html).toContain("Download");
  expect(html).toContain("previewContainer");
});

test("bucket page uses document icon for unknown MIME types, not folder", () => {
  const bucket: BucketRow = {
    id: "test123456", name: "Test", description: "", purpose: "",
    owner_key_hash: "hash", created_at: Math.floor(Date.now() / 1000),
    expires_at: null, file_count: 1, total_size: 100,
  };
  const files: FileRow[] = [{
    id: 1, bucket_id: "test123456", path: "data.bin",
    size: 100, mime_type: "application/octet-stream",
    short_code: "abc123", version: 1, sha256: "sha",
    uploaded_at: Math.floor(Date.now() / 1000),
  }];
  const html = bucketPage(bucket, files);
  expect(html).not.toContain("\u{1F4C1}");
  expect(html).toContain("\u{1F4C4}");
});

test("bucket page grid card renders code snippet when provided", () => {
  const bucket: BucketRow = {
    id: "test123456", name: "Test", description: "", purpose: "",
    owner_key_hash: "hash", created_at: Math.floor(Date.now() / 1000),
    expires_at: null, file_count: 1, total_size: 100,
  };
  const files: FileRow[] = [{
    id: 1, bucket_id: "test123456", path: "app.ts",
    size: 100, mime_type: "text/typescript",
    short_code: "abc123", version: 1, sha256: "sha",
    uploaded_at: Math.floor(Date.now() / 1000),
  }];
  const snippets = new Map<string, string>();
  snippets.set("app.ts", '<pre class="shiki"><code>const x = 1;</code></pre>');
  const html = bucketPage(bucket, files, undefined, snippets);
  expect(html).toContain("gridCodePreview");
  expect(html).toContain("const x = 1;");
  expect(html).toContain("gridCodeFade");
});

test("bucket page grid card renders video element for video files", () => {
  const bucket: BucketRow = {
    id: "test123456", name: "Test", description: "", purpose: "",
    owner_key_hash: "hash", created_at: Math.floor(Date.now() / 1000),
    expires_at: null, file_count: 1, total_size: 5000,
  };
  const files: FileRow[] = [{
    id: 1, bucket_id: "test123456", path: "clip.mp4",
    size: 5000, mime_type: "video/mp4",
    short_code: "vid123", version: 1, sha256: "sha",
    uploaded_at: Math.floor(Date.now() / 1000),
  }];
  const html = bucketPage(bucket, files);
  expect(html).toContain("<video");
  expect(html).toContain("preload");
  expect(html).toContain("gridVideoPreview");
  expect(html).toContain("clip.mp4");
});
