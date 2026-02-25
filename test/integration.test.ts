import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let ADMIN_KEY: string;
let baseUrl: string;
let server: any;
let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "clawd-integration-"));

  // Use the config module's admin key (already evaluated from .env or prior test)
  const { config } = await import("../src/config");
  ADMIN_KEY = config.adminKey || "dev-admin-key-change-in-production";

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
  getDb(join(tempDir, "integration.db"));

  // Import renderers
  await import("../src/render/index");

  const { registerKeyRoutes } = await import("../src/routes/keys");
  const { registerBucketRoutes } = await import("../src/routes/buckets");
  const { registerFileRoutes } = await import("../src/routes/files");
  const { registerUploadLinkRoutes } = await import("../src/routes/upload-links");
  const { registerShortRoutes } = await import("../src/routes/short");
  const { registerDocRoutes } = await import("../src/routes/docs");
  const { registerPageRoutes } = await import("../src/routes/pages");

  registerKeyRoutes();
  registerBucketRoutes();
  registerFileRoutes();
  registerUploadLinkRoutes();
  registerShortRoutes();
  registerDocRoutes();
  registerPageRoutes();

  const { matchRoute } = await import("../src/router");
  const { buildStyles } = await import("../src/render/styles");
  const styles = await buildStyles();

  server = Bun.serve({
    port: 0,
    routes: {
      "/health": new Response("ok"),
      "/render/styles.css": () => new Response(styles.css, { headers: { "Content-Type": "text/css" } }),
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
      return new Response("Not Found", { status: 404 });
    },
  });

  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  if (server) server.stop();
  await rm(tempDir, { recursive: true, force: true });
});

// ---- Full Lifecycle ----

let apiKey: string;
let bucketId: string;
let shortCode: string;

test("1. create API key", async () => {
  const res = await fetch(`${baseUrl}/api/keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "integration-key" }),
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  apiKey = data.key;
  expect(apiKey).toMatch(/^cf4_/);
});

test("2. create bucket", async () => {
  const res = await fetch(`${baseUrl}/api/buckets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Integration Bucket", description: "End-to-end test", expiresIn: "7d" }),
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  bucketId = data.bucket.id;
  expect(bucketId).toBeTruthy();
});

test("3. upload files", async () => {
  const fd = new FormData();
  fd.append("files", new File(["# Hello\n\nWorld"], "README.md", { type: "text/markdown" }));
  fd.append("files", new File(["const x: number = 42;"], "app.ts", { type: "text/typescript" }));
  fd.append("files", new File(["name,age\nAlice,30\nBob,25"], "data.csv", { type: "text/csv" }));
  fd.append("files", new File([JSON.stringify({ key: "value", nested: { a: 1 } })], "config.json", { type: "application/json" }));

  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.uploaded).toHaveLength(4);
  shortCode = data.uploaded[0].shortCode;
});

test("4. list files via bucket detail (JSON)", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}`, {
    headers: { Accept: "application/json" },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.files).toHaveLength(4);
});

test("5. download raw file", async () => {
  const res = await fetch(`${baseUrl}/raw/${bucketId}/app.ts`);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("const x: number = 42;");
});

test("6. Range request", async () => {
  const res = await fetch(`${baseUrl}/raw/${bucketId}/README.md`, {
    headers: { Range: "bytes=0-6" },
  });
  expect(res.status).toBe(206);
  expect(await res.text()).toBe("# Hello");
});

test("7. short URL redirect", async () => {
  const res = await fetch(`${baseUrl}/s/${shortCode}`, { redirect: "manual" });
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain(`/raw/${bucketId}/`);
});

// ---- Content Negotiation ----

test("8. bucket page serves HTML for browsers", async () => {
  const res = await fetch(`${baseUrl}/${bucketId}`, {
    headers: { Accept: "text/html" },
  });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("Integration Bucket");
  expect(html).toContain("README.md");
});

test("9. bucket page serves JSON for API clients", async () => {
  const res = await fetch(`${baseUrl}/${bucketId}`, {
    headers: { Accept: "application/json" },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.bucket.name).toBe("Integration Bucket");
});

test("10. file page renders preview", async () => {
  const res = await fetch(`${baseUrl}/${bucketId}/app.ts`, {
    headers: { Accept: "text/html" },
  });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("app.ts");
  expect(html).toContain("shiki"); // Code highlighting
});

test("11. markdown renders with README in bucket", async () => {
  const res = await fetch(`${baseUrl}/${bucketId}`, {
    headers: { Accept: "text/html" },
  });
  const html = await res.text();
  expect(html).toContain("lumen-markdown"); // README rendered
});

test("12. CSV renders as table", async () => {
  const res = await fetch(`${baseUrl}/${bucketId}/data.csv`, {
    headers: { Accept: "text/html" },
  });
  const html = await res.text();
  expect(html).toContain("lumen-csv");
  expect(html).toContain("Alice");
});

test("13. JSON renders as tree", async () => {
  const res = await fetch(`${baseUrl}/${bucketId}/config.json`, {
    headers: { Accept: "text/html" },
  });
  const html = await res.text();
  expect(html).toContain("lumen-json");
  expect(html).toContain("json-key");
});

// ---- Upload Links ----

test("14. generate upload link and upload via token", async () => {
  const linkRes = await fetch(`${baseUrl}/api/buckets/${bucketId}/upload-link`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: "1h" }),
  });
  expect(linkRes.status).toBe(201);
  const { token } = await linkRes.json();

  const fd = new FormData();
  fd.append("files", new File(["uploaded via token"], "token-file.txt"));
  const uploadRes = await fetch(`${baseUrl}/upload/${token}`, {
    method: "POST",
    body: fd,
  });
  expect(uploadRes.status).toBe(201);
  const data = await uploadRes.json();
  expect(data.uploaded[0].path).toBe("token-file.txt");
});

// ---- File Versioning ----

test("15. re-upload creates version", async () => {
  const fd = new FormData();
  fd.append("files", new File(["version 2"], "README.md"));
  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  const data = await res.json();
  expect(data.uploaded[0].version).toBe(2);
});

test("16. version history shows versions", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}/files/README.md/versions`);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.current).toBe(2);
  expect(data.versions.length).toBeGreaterThanOrEqual(1);
});

// ---- ZIP Download ----

test("17. ZIP download", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}/zip`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/zip");
  const blob = await res.blob();
  expect(blob.size).toBeGreaterThan(0);
});

// ---- Summary ----

test("18. plain text summary", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}/summary`);
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toContain("Integration Bucket");
  expect(text).toContain("README.md");
});

// ---- Docs ----

test("19. llms.txt", async () => {
  const res = await fetch(`${baseUrl}/llms.txt`);
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toContain("ClawdFiles");
  expect(text).toContain("POST /api/keys");
});

test("20. openapi.json", async () => {
  const res = await fetch(`${baseUrl}/openapi.json`);
  expect(res.status).toBe(200);
  const spec = await res.json();
  expect(spec.openapi).toBe("3.1.0");
  expect(spec.paths["/api/keys"]).toBeTruthy();
});

test("21. docs page", async () => {
  const res = await fetch(`${baseUrl}/docs`);
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("scalar");
});

// ---- Home Page ----

test("22. home page", async () => {
  const res = await fetch(`${baseUrl}/`);
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("ClawdFiles");
});

// ---- Health Check ----

test("23. health check", async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("ok");
});

// ---- File Deletion ----

test("24. delete file", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}/files/token-file.txt`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  expect(res.status).toBe(200);
  const raw = await fetch(`${baseUrl}/raw/${bucketId}/token-file.txt`);
  expect(raw.status).toBe(404);
});

// ---- Bucket Deletion ----

test("25. delete bucket cleans up everything", async () => {
  const res = await fetch(`${baseUrl}/api/buckets/${bucketId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  expect(res.status).toBe(200);

  const get = await fetch(`${baseUrl}/api/buckets/${bucketId}`, {
    headers: { Accept: "application/json" },
  });
  expect(get.status).toBe(404);
});
