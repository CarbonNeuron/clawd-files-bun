import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ADMIN_KEY = "dev-admin-key-change-in-production";
let baseUrl: string;
let server: any;
let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "clawd-api-test-"));

  // Set env vars before importing
  process.env.DATA_DIR = tempDir;
  process.env.ADMIN_KEY = ADMIN_KEY;
  process.env.PORT = "0"; // Random port

  // Clear module cache to force re-import with new env
  // We need to use a dynamic import trick
  const { clearRoutes } = await import("../src/router");
  clearRoutes();

  const { resetDb } = await import("../src/db");
  resetDb();

  // Re-register routes and start server
  const { ensureDataDirs } = await import("../src/storage");
  await ensureDataDirs();

  const { getDb } = await import("../src/db");
  getDb(join(tempDir, "test.db"));

  const { registerKeyRoutes } = await import("../src/routes/keys");
  const { registerBucketRoutes } = await import("../src/routes/buckets");
  const { registerFileRoutes } = await import("../src/routes/files");
  const { registerUploadLinkRoutes } = await import("../src/routes/upload-links");
  const { registerShortRoutes } = await import("../src/routes/short");

  registerKeyRoutes();
  registerBucketRoutes();
  registerFileRoutes();
  registerUploadLinkRoutes();
  registerShortRoutes();

  const { matchRoute } = await import("../src/router");

  server = Bun.serve({
    port: 0,
    routes: {
      "/health": new Response("ok"),
    },
    async fetch(req) {
      const url = new URL(req.url);
      const route = matchRoute(req.method, url.pathname);
      if (route) {
        try {
          return await route.handler(req, route.params);
        } catch (err) {
          console.error(err);
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });

  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  if (server) server.stop();
  await rm(tempDir, { recursive: true, force: true });
});

function adminHeaders(extra?: Record<string, string>) {
  return { Authorization: `Bearer ${ADMIN_KEY}`, ...extra };
}

// ---- Key Management ----

test("POST /api/keys creates a key", async () => {
  const res = await fetch(`${baseUrl}/api/keys`, {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Key" }),
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.key).toMatch(/^cf4_/);
  expect(data.name).toBe("Test Key");
});

test("GET /api/keys lists keys", async () => {
  const res = await fetch(`${baseUrl}/api/keys`, {
    headers: adminHeaders(),
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.keys.length).toBeGreaterThanOrEqual(1);
});

test("POST /api/keys requires admin", async () => {
  const res = await fetch(`${baseUrl}/api/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Fail" }),
  });
  expect(res.status).toBe(401);
});

// ---- Bucket CRUD ----

let testApiKey: string;
let testBucketId: string;

test("create API key for bucket tests", async () => {
  const res = await fetch(`${baseUrl}/api/keys`, {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bucket Test Key" }),
  });
  const data = await res.json();
  testApiKey = data.key;
  expect(testApiKey).toMatch(/^cf4_/);
});

test("POST /api/buckets creates bucket", async () => {
  const res = await fetch(`${baseUrl}/api/buckets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Test Bucket", description: "For testing", expiresIn: "7d" }),
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  testBucketId = data.bucket.id;
  expect(data.bucket.name).toBe("Test Bucket");
  expect(data.bucket.description).toBe("For testing");
  expect(data.bucket.expires_at).not.toBeNull();
});

test("GET /api/buckets lists user's buckets", async () => {
  const res = await fetch(`${baseUrl}/api/buckets`, {
    headers: { Authorization: `Bearer ${testApiKey}` },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.buckets.length).toBeGreaterThanOrEqual(1);
});

test("GET /api/buckets/:id returns bucket detail", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}`, {
    headers: { Accept: "application/json" },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.bucket.name).toBe("Test Bucket");
  expect(data.files).toBeArray();
});

test("PATCH /api/buckets/:id updates bucket", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: "Updated description" }),
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.bucket.description).toBe("Updated description");
});

// ---- File Upload/Download ----

test("POST /api/buckets/:id/upload uploads files", async () => {
  const formData = new FormData();
  formData.append("files", new File(["hello world"], "test.txt", { type: "text/plain" }));
  formData.append("files", new File(["console.log('hi')"], "app.js", { type: "application/javascript" }));

  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${testApiKey}` },
    body: formData,
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.uploaded).toHaveLength(2);
  expect(data.uploaded[0].path).toBe("test.txt");
});

test("GET /raw/:bucketId/:path serves raw file", async () => {
  const res = await fetch(`${baseUrl}/raw/${testBucketId}/test.txt`);
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toBe("hello world");
  expect(res.headers.get("accept-ranges")).toBe("bytes");
});

test("GET /raw/:bucketId/:path supports Range requests", async () => {
  const res = await fetch(`${baseUrl}/raw/${testBucketId}/test.txt`, {
    headers: { Range: "bytes=0-4" },
  });
  expect(res.status).toBe(206);
  const text = await res.text();
  expect(text).toBe("hello");
});

test("GET /raw/:bucketId/:path supports ETag/304", async () => {
  const res1 = await fetch(`${baseUrl}/raw/${testBucketId}/test.txt`);
  const etag = res1.headers.get("etag");
  await res1.text(); // consume body
  expect(etag).toBeTruthy();

  const res2 = await fetch(`${baseUrl}/raw/${testBucketId}/test.txt`, {
    headers: { "If-None-Match": etag! },
  });
  expect(res2.status).toBe(304);
});

test("file re-upload creates new version", async () => {
  const formData = new FormData();
  formData.append("files", new File(["hello world v2"], "test.txt", { type: "text/plain" }));

  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${testApiKey}` },
    body: formData,
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.uploaded[0].version).toBe(2);
});

test("GET /api/buckets/:id/files/:path/versions lists versions", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/files/test.txt/versions`);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.current).toBe(2);
  expect(data.versions.length).toBeGreaterThanOrEqual(1);
});

test("GET /api/buckets/:id/summary returns plain text", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/summary`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/plain");
  const text = await res.text();
  expect(text).toContain("Test Bucket");
  expect(text).toContain("test.txt");
});

test("GET /api/buckets/:id/zip downloads ZIP", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/zip`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/zip");
  // Just verify it's a valid response with data
  const blob = await res.blob();
  expect(blob.size).toBeGreaterThan(0);
});

// ---- Short URLs ----

test("GET /s/:code redirects to raw file", async () => {
  // First, get the short code from the bucket detail
  const detailRes = await fetch(`${baseUrl}/api/buckets/${testBucketId}`, {
    headers: { Accept: "application/json" },
  });
  const detail = await detailRes.json();
  const shortCode = detail.files[0].short_code;

  const res = await fetch(`${baseUrl}/s/${shortCode}`, { redirect: "manual" });
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain(`/raw/${testBucketId}/`);
});

// ---- Upload Links ----

test("POST /api/buckets/:id/upload-link creates link", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload-link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: "1h" }),
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.url).toContain("/api/upload/");
  expect(data.token).toBeTruthy();
});

test("POST /upload/:token uploads via token", async () => {
  // Generate link
  const linkRes = await fetch(`${baseUrl}/api/buckets/${testBucketId}/upload-link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: "1h" }),
  });
  const { token } = await linkRes.json();

  // Upload via token
  const formData = new FormData();
  formData.append("files", new File(["token upload content"], "via-token.txt", { type: "text/plain" }));

  const res = await fetch(`${baseUrl}/api/upload/${token}`, {
    method: "POST",
    body: formData,
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.uploaded).toHaveLength(1);
  expect(data.uploaded[0].path).toBe("via-token.txt");
});

// ---- File Deletion ----

test("DELETE /api/buckets/:id/files/:path deletes file", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${testBucketId}/files/app.js`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${testApiKey}` },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.deleted).toBe(true);

  // Verify it's gone
  const rawRes = await fetch(`${baseUrl}/raw/${testBucketId}/app.js`);
  expect(rawRes.status).toBe(404);
});

// ---- Bucket Deletion ----

test("DELETE /api/buckets/:id deletes bucket", async () => {
  // Create a new bucket to delete
  const createRes = await fetch(`${baseUrl}/api/buckets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${testApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Delete Me" }),
  });
  const { bucket } = await createRes.json();

  const res = await fetch(`${baseUrl}/api/buckets/${bucket.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${testApiKey}` },
  });
  expect(res.status).toBe(200);

  // Verify it's gone
  const getRes = await fetch(`${baseUrl}/api/buckets/${bucket.id}`, {
    headers: { Accept: "application/json" },
  });
  expect(getRes.status).toBe(404);
});
