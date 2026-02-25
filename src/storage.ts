import { mkdir, unlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, normalize } from "node:path";
import { filesDir } from "./config";

/** Validate and resolve a user-provided path, preventing directory traversal */
function safePath(base: string, userPath: string): string {
  const normalized = normalize(userPath);
  if (normalized.startsWith("..") || normalize("/" + normalized) !== "/" + normalized) {
    throw new Error("Invalid file path");
  }
  const full = resolve(base, normalized);
  const expectedPrefix = resolve(base);
  if (!full.startsWith(expectedPrefix + "/") && full !== expectedPrefix) {
    throw new Error("Path traversal detected");
  }
  return full;
}

function filePath(bucketId: string, path: string): string {
  const bucketDir = resolve(filesDir, bucketId);
  return safePath(bucketDir, path);
}

function versionPath(bucketId: string, path: string, version: number): string {
  const versionsDir = resolve(filesDir, bucketId, ".versions");
  return safePath(versionsDir, `${path}.v${version}`);
}

export async function writeFile(bucketId: string, path: string, data: Blob): Promise<void> {
  const dest = filePath(bucketId, path);
  await mkdir(dirname(dest), { recursive: true });
  await Bun.write(dest, data);
}

export function readFile(bucketId: string, path: string): ReturnType<typeof Bun.file> {
  return Bun.file(filePath(bucketId, path));
}

export function getFilePath(bucketId: string, path: string): string {
  return filePath(bucketId, path);
}

export async function deleteStoredFile(bucketId: string, path: string): Promise<void> {
  const fp = filePath(bucketId, path);
  if (existsSync(fp)) {
    await unlink(fp);
  }
}

export async function deleteBucketDir(bucketId: string): Promise<void> {
  const dir = join(filesDir, bucketId);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}

export function fileExists(bucketId: string, path: string): boolean {
  return existsSync(filePath(bucketId, path));
}

export async function archiveVersion(bucketId: string, path: string, version: number): Promise<void> {
  const src = filePath(bucketId, path);
  const dest = versionPath(bucketId, path, version);
  if (!existsSync(src)) return;
  await mkdir(dirname(dest), { recursive: true });
  const data = Bun.file(src);
  await Bun.write(dest, data);
}

export function readVersion(bucketId: string, path: string, version: number): ReturnType<typeof Bun.file> {
  return Bun.file(versionPath(bucketId, path, version));
}

export async function ensureDataDirs(): Promise<void> {
  await mkdir(filesDir, { recursive: true });
}

export async function hashFile(data: Blob): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await data.arrayBuffer());
  return hasher.digest("hex");
}

/**
 * Stream a File/Blob to disk while computing SHA-256 incrementally.
 */
export async function streamWriteFile(
  bucketId: string,
  path: string,
  blob: Blob,
): Promise<{ sha256: string; size: number }> {
  return streamWriteFromBody(bucketId, path, blob.stream());
}

/**
 * Stream a ReadableStream (e.g. req.body) directly to disk while
 * computing SHA-256 incrementally. Never buffers the full content
 * in memory — each chunk is hashed and flushed immediately.
 * Uses getReader() for explicit stream consumption (more reliable
 * than for-await in Bun for large streams).
 */
export async function streamWriteFromBody(
  bucketId: string,
  path: string,
  body: ReadableStream<Uint8Array>,
): Promise<{ sha256: string; size: number }> {
  const dest = filePath(bucketId, path);
  await mkdir(dirname(dest), { recursive: true });

  const hasher = new Bun.CryptoHasher("sha256");
  const writer = Bun.file(dest).writer();
  let totalSize = 0;

  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hasher.update(value);
      writer.write(value);
      totalSize += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  await writer.end();

  return { sha256: hasher.digest("hex") as string, size: totalSize };
}
