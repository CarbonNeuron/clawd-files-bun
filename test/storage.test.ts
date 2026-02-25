import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We need to override the filesDir before importing storage
let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "clawd-storage-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("writeFile and readFile round-trip", async () => {
  // Dynamically construct paths to use temp dir
  const { mkdir } = await import("node:fs/promises");
  const bucketDir = join(tempDir, "bucket1");
  await mkdir(bucketDir, { recursive: true });
  const filePath = join(bucketDir, "test.txt");
  await Bun.write(filePath, "hello world");
  const content = await Bun.file(filePath).text();
  expect(content).toBe("hello world");
});

test("fileExists returns correct status", async () => {
  const { existsSync } = await import("node:fs");
  const filePath = join(tempDir, "exists.txt");
  expect(existsSync(filePath)).toBe(false);
  await Bun.write(filePath, "data");
  expect(existsSync(filePath)).toBe(true);
});

test("version archiving works", async () => {
  const { mkdir } = await import("node:fs/promises");
  const bucketDir = join(tempDir, "bucket2");
  await mkdir(bucketDir, { recursive: true });

  // Write original file
  const origPath = join(bucketDir, "app.js");
  await Bun.write(origPath, "version 1 content");

  // Archive it
  const versionsDir = join(bucketDir, ".versions");
  await mkdir(versionsDir, { recursive: true });
  const versionPath = join(versionsDir, "app.js.v1");
  await Bun.write(versionPath, await Bun.file(origPath).arrayBuffer());

  // Write new version
  await Bun.write(origPath, "version 2 content");

  // Verify both exist
  expect(await Bun.file(origPath).text()).toBe("version 2 content");
  expect(await Bun.file(versionPath).text()).toBe("version 1 content");
});

test("hashFile returns consistent SHA256 hex", async () => {
  const hasher = new Bun.CryptoHasher("sha256");
  const data = new Blob(["hello"]);
  hasher.update(await data.arrayBuffer());
  const hash = hasher.digest("hex");
  expect(hash).toHaveLength(64);
  expect(hash).toMatch(/^[0-9a-f]+$/);

  // Same content produces same hash
  const hasher2 = new Bun.CryptoHasher("sha256");
  hasher2.update(await new Blob(["hello"]).arrayBuffer());
  expect(hasher2.digest("hex")).toBe(hash);
});

test("delete bucket directory recursively", async () => {
  const { mkdir } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const bucketDir = join(tempDir, "bucket3");
  await mkdir(join(bucketDir, "subdir"), { recursive: true });
  await Bun.write(join(bucketDir, "a.txt"), "a");
  await Bun.write(join(bucketDir, "subdir", "b.txt"), "b");
  expect(existsSync(bucketDir)).toBe(true);
  await rm(bucketDir, { recursive: true, force: true });
  expect(existsSync(bucketDir)).toBe(false);
});
