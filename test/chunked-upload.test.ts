import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ADMIN_KEY = "dev-admin-key-change-in-production";
let baseUrl: string;
let server: any;
let tempDir: string;
let testBucketId: string;
let testApiKey: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "clawd-chunk-test-"));

  process.env.DATA_DIR = tempDir;
  process.env.ADMIN_KEY = ADMIN_KEY;
  process.env.PORT = "0";

  const { clearRoutes } = await import("../src/router");
  clearRoutes();

  const { resetDb } = await import("../src/db");
  resetDb();

  const { ensureDataDirs } = await import("../src/storage");
  await ensureDataDirs();

  const { getDb } = await import("../src/db");
  getDb(join(tempDir, "test.db"));

  const { registerKeyRoutes } = await import("../src/routes/keys");
  const { registerBucketRoutes } = await import("../src/routes/buckets");
  const { registerFileRoutes } = await import("../src/routes/files");

  registerKeyRoutes();
  registerBucketRoutes();
  registerFileRoutes();

  const { matchRoute } = await import("../src/router");

  server = Bun.serve({
    port: 0,
    maxRequestBodySize: 1024 * 1024 * 1024 * 10,
    routes: {
      "/health": new Response("ok"),
    },
    async fetch(req) {
      const url = new URL(req.url);
      const route = matchRoute(req.method, url.pathname);
      if (route) {
        return route.handler(req, route.params);
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  baseUrl = `http://localhost:${server.port}`;

  // Create API key
  const keyRes = await fetch(`${baseUrl}/api/keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Test Key" }),
  });
  const keyData = await keyRes.json();
  testApiKey = keyData.key;

  // Create test bucket
  const bucketRes = await fetch(`${baseUrl}/api/buckets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Chunk Test Bucket" }),
  });
  const bucketData = await bucketRes.json();
  testBucketId = bucketData.bucket.id;
});

afterAll(async () => {
  server.stop();
  await rm(tempDir, { recursive: true, force: true });
});

test("chunked upload: small file (under 5MB) - single chunk", async () => {
  const uploadId = "test-upload-" + Date.now();
  const filename = "small-test.txt";
  const content = "Hello, this is a small test file!";
  const chunk = new TextEncoder().encode(content);

  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload/chunk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "X-Chunk-Index": "0",
      "X-Total-Chunks": "1",
      "X-Upload-Id": uploadId,
      "X-Filename": filename,
    },
    body: chunk,
  });

  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.complete).toBe(true);
  expect(data.file.path).toBe(filename);
  expect(data.file.size).toBe(content.length);
});

test("chunked upload: multi-chunk file", async () => {
  const uploadId = "test-upload-multi-" + Date.now();
  const filename = "multi-chunk.txt";
  
  // Create a file content split into 3 chunks
  const chunk1 = new TextEncoder().encode("Part 1 of the file. ");
  const chunk2 = new TextEncoder().encode("Part 2 of the file. ");
  const chunk3 = new TextEncoder().encode("Part 3 of the file.");
  const totalSize = chunk1.length + chunk2.length + chunk3.length;

  // Upload chunk 1
  const res1 = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload/chunk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "X-Chunk-Index": "0",
      "X-Total-Chunks": "3",
      "X-Upload-Id": uploadId,
      "X-Filename": filename,
    },
    body: chunk1,
  });
  expect(res1.status).toBe(200);
  const data1 = await res1.json();
  expect(data1.complete).toBe(false);
  expect(data1.received).toBe(1);
  expect(data1.total).toBe(3);

  // Upload chunk 2
  const res2 = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload/chunk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "X-Chunk-Index": "1",
      "X-Total-Chunks": "3",
      "X-Upload-Id": uploadId,
      "X-Filename": filename,
    },
    body: chunk2,
  });
  expect(res2.status).toBe(200);
  const data2 = await res2.json();
  expect(data2.complete).toBe(false);
  expect(data2.received).toBe(2);

  // Upload chunk 3 (final)
  const res3 = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload/chunk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "X-Chunk-Index": "2",
      "X-Total-Chunks": "3",
      "X-Upload-Id": uploadId,
      "X-Filename": filename,
    },
    body: chunk3,
  });
  expect(res3.status).toBe(201);
  const data3 = await res3.json();
  expect(data3.complete).toBe(true);
  expect(data3.file.path).toBe(filename);
  expect(data3.file.size).toBe(totalSize);

  // Verify file can be downloaded
  const downloadRes = await fetch(`${baseUrl}/raw/${testBucketId}/${filename}`);
  expect(downloadRes.status).toBe(200);
  const content = await downloadRes.text();
  expect(content).toBe("Part 1 of the file. Part 2 of the file. Part 3 of the file.");
});

test("chunked upload: invalid headers return 400", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload/chunk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      // Missing required headers
    },
    body: "test",
  });

  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.error).toBe("Invalid chunk headers");
});

test("chunked upload: unauthorized without auth", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload/chunk`, {
    method: "POST",
    headers: {
      "X-Chunk-Index": "0",
      "X-Total-Chunks": "1",
      "X-Upload-Id": "test",
      "X-Filename": "test.txt",
    },
    body: "test",
  });

  expect(res.status).toBe(401);
});
