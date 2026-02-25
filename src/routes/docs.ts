import { addRoute } from "../router";
import { config } from "../config";
import { layout, layoutStyles } from "../templates/layout";
import baseStyles from "../styles/base.module.css";

export function registerDocRoutes() {
  // LLMs.txt
  addRoute("GET", "/llms.txt", async () => {
    const text = `# ClawdFiles v4 API
> File hosting with built-in rendering, versioning, and short URLs.

Base URL: ${config.baseUrl}

## Authentication
All write operations require a Bearer token in the Authorization header.
- Admin key: Set via ADMIN_KEY environment variable
- API keys: Generated via POST /api/keys (admin only), format: cf4_<prefix>_<secret>

## Endpoints

### Keys (Admin only)
- POST /api/keys — Create API key. Body: { "name": "key-name" }
- GET /api/keys — List all keys
- DELETE /api/keys/:prefix — Revoke key

### Buckets
- POST /api/buckets — Create bucket. Body: { "name": "...", "description?": "...", "expiresIn?": "7d" }
- GET /api/buckets — List your buckets
- GET /api/buckets/:id — Bucket detail + file list
- PATCH /api/buckets/:id — Update bucket
- DELETE /api/buckets/:id — Delete bucket + all files

### Files
- POST /api/buckets/:id/upload — Upload files (multipart/form-data, field: "files")
- DELETE /api/buckets/:id/files/:path — Delete file
- GET /api/buckets/:id/files/:path/versions — Version history
- GET /raw/:bucketId/:path — Raw file download (supports Range requests)

### Upload Links
- POST /api/buckets/:id/upload-link — Generate pre-signed upload URL
- POST /upload/:token — Upload via token (no auth needed)
- GET /upload/:token — Drag-and-drop upload page

### Short URLs
- GET /s/:code — Redirect to raw file

### Streaming Upload (large files)
- PUT /api/buckets/:id/upload/:filename — Stream raw file body to disk (no multipart, no buffering)
- PUT /api/upload/:token/:filename — Stream upload via token (no auth needed)
  Note: For files over a few hundred MB, prefer PUT over POST to avoid memory buffering.

### Admin Dashboard
- POST /api/admin/dashboard-link — Generate a time-limited admin dashboard URL (admin only, expires in 24h)
- GET /admin?token=:token — Admin dashboard page showing stats, API keys, and all buckets

### Utilities
- GET /api/buckets/:id/summary — Plain text summary (LLM-friendly)
- GET /api/buckets/:id/zip — Download all files as ZIP
- GET /health — Health check
- GET /openapi.json — OpenAPI 3.1 spec
- GET /docs — Interactive API docs (Scalar)

## Content Negotiation
GET /:bucketId and GET /:bucketId/:path return HTML for browsers, JSON for API clients (Accept: application/json or curl/httpie user-agents).

## Duration Formats
expiresIn accepts: "1h", "24h", "7d", "30d", "never"
`;

    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });

  // OpenAPI spec
  addRoute("GET", "/openapi.json", async () => {
    const spec = {
      openapi: "3.1.0",
      info: {
        title: "ClawdFiles v4 API",
        version: "4.0.0",
        description: "File hosting with built-in rendering, versioning, and short URLs.",
      },
      servers: [{ url: config.baseUrl }],
      tags: [
        { name: "Keys", description: "API key management (admin only)" },
        { name: "Buckets", description: "Bucket CRUD (API key required)" },
        { name: "Files", description: "File upload, download, and management (API key required)" },
        { name: "Upload Links", description: "Pre-signed upload URLs (API key to generate, no auth to use)" },
        { name: "Public", description: "Unauthenticated endpoints" },
      ],
      paths: {
        "/api/keys": {
          post: {
            tags: ["Keys"],
            summary: "Create API key",
            description: "Generate a new API key. The full key is returned once and cannot be retrieved again.",
            security: [{ adminKey: [] }],
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string", description: "Human-readable name for this key" } }, required: ["name"] } } } },
            responses: {
              "201": { description: "Key created. Save the `key` field — it won't be shown again." },
              "401": { description: "Missing or invalid authorization" },
              "403": { description: "Not an admin key" },
            },
          },
          get: {
            tags: ["Keys"],
            summary: "List API keys",
            description: "List all API keys (prefix and name only, not the secrets).",
            security: [{ adminKey: [] }],
            responses: {
              "200": { description: "Key list" },
              "403": { description: "Not an admin key" },
            },
          },
        },
        "/api/keys/{prefix}": {
          delete: {
            tags: ["Keys"],
            summary: "Revoke API key",
            description: "Permanently revoke an API key by its prefix. All buckets owned by this key will lose their owner.",
            security: [{ adminKey: [] }],
            parameters: [{ name: "prefix", in: "path", required: true, schema: { type: "string" }, description: "8-character hex prefix of the key" }],
            responses: {
              "200": { description: "Key deleted" },
              "404": { description: "Key not found" },
            },
          },
        },
        "/api/buckets": {
          post: {
            tags: ["Buckets"],
            summary: "Create bucket",
            description: "Create a new file bucket. The caller becomes the owner.",
            security: [{ apiKey: [] }],
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, purpose: { type: "string" }, expiresIn: { type: "string", description: "Duration string: 1h, 24h, 7d, 30d, or never" } }, required: ["name"] } } } },
            responses: { "201": { description: "Bucket created" } },
          },
          get: {
            tags: ["Buckets"],
            summary: "List buckets",
            description: "List buckets owned by the calling key. Admins see all buckets.",
            security: [{ apiKey: [] }],
            responses: { "200": { description: "Bucket list" } },
          },
        },
        "/api/buckets/{id}": {
          get: {
            tags: ["Buckets"],
            summary: "Get bucket detail",
            description: "Public. Returns bucket metadata and file list. JSON for API clients, HTML for browsers.",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Bucket with files" }, "404": { description: "Bucket not found" } },
          },
          patch: {
            tags: ["Buckets"],
            summary: "Update bucket",
            description: "Update bucket fields. Owner or admin only.",
            security: [{ apiKey: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, purpose: { type: "string" }, expiresIn: { type: "string" } } } } } },
            responses: { "200": { description: "Updated bucket" }, "403": { description: "Not the owner" } },
          },
          delete: {
            tags: ["Buckets"],
            summary: "Delete bucket",
            description: "Delete a bucket and all its files from disk and database. Owner or admin only.",
            security: [{ apiKey: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Deleted" }, "403": { description: "Not the owner" } },
          },
        },
        "/api/buckets/{id}/upload": {
          post: {
            tags: ["Files"],
            summary: "Upload files",
            description: "Upload one or more files via multipart form data. Re-uploading a file with the same name creates a new version.",
            security: [{ apiKey: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { files: { type: "array", items: { type: "string", format: "binary" } } } } } } },
            responses: { "201": { description: "Files uploaded with short codes and version numbers" } },
          },
        },
        "/api/buckets/{id}/files/{path}": {
          delete: {
            tags: ["Files"],
            summary: "Delete file",
            description: "Delete a file and all its versions. Owner or admin only.",
            security: [{ apiKey: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
              { name: "path", in: "path", required: true, schema: { type: "string" }, description: "File path within the bucket" },
            ],
            responses: { "200": { description: "Deleted" }, "404": { description: "File not found" } },
          },
        },
        "/api/buckets/{id}/files/{path}/versions": {
          get: {
            tags: ["Files"],
            summary: "List file versions",
            description: "Public. Returns the current version and all archived versions of a file.",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
              { name: "path", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { "200": { description: "Version list" }, "404": { description: "File not found" } },
          },
        },
        "/api/buckets/{id}/zip": {
          get: {
            tags: ["Files"],
            summary: "Download bucket as ZIP",
            description: "Public. Streams all files in the bucket as a ZIP archive.",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "ZIP file stream" } },
          },
        },
        "/api/buckets/{id}/summary": {
          get: {
            tags: ["Files"],
            summary: "Plain text summary",
            description: "Public. Returns an LLM-friendly plain text summary of the bucket and its files.",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Text summary" } },
          },
        },
        "/api/buckets/{id}/upload-link": {
          post: {
            tags: ["Upload Links"],
            summary: "Generate upload link",
            description: "Create a pre-signed upload URL. Anyone with the link can upload files without an API key.",
            security: [{ apiKey: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { expiresIn: { type: "string", description: "Duration: 1h, 24h, 7d. Default: 1h" } } } } } },
            responses: { "201": { description: "Upload URL and token" } },
          },
        },
        "/upload/{token}": {
          post: {
            tags: ["Upload Links"],
            summary: "Upload via token",
            description: "Upload files using a pre-signed token. No API key required.",
            parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
            requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { files: { type: "array", items: { type: "string", format: "binary" } } } } } } },
            responses: { "201": { description: "Files uploaded" }, "401": { description: "Token expired or invalid" } },
          },
          get: {
            tags: ["Upload Links"],
            summary: "Upload page",
            description: "Drag-and-drop upload page for use in a browser.",
            parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "HTML upload page" } },
          },
        },
        "/raw/{bucketId}/{path}": {
          get: {
            tags: ["Public"],
            summary: "Raw file download",
            description: "Serve the raw file with correct Content-Type. Supports Range requests for video seeking and ETag for caching.",
            parameters: [
              { name: "bucketId", in: "path", required: true, schema: { type: "string" } },
              { name: "path", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { "200": { description: "File content" }, "206": { description: "Partial content (Range request)" }, "304": { description: "Not modified (ETag match)" } },
          },
        },
        "/s/{code}": {
          get: {
            tags: ["Public"],
            summary: "Short URL redirect",
            description: "Redirect to the raw file. Use `curl -LJO` to download with the original filename.",
            parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
            responses: { "307": { description: "Redirect to raw file" }, "404": { description: "Code not found" } },
          },
        },
        "/health": {
          get: {
            tags: ["Public"],
            summary: "Health check",
            responses: { "200": { description: "OK" } },
          },
        },
      },
      components: {
        securitySchemes: {
          adminKey: {
            type: "http",
            scheme: "bearer",
            description: "Admin key set via ADMIN_KEY environment variable. Required for key management.",
          },
          apiKey: {
            type: "http",
            scheme: "bearer",
            description: "API key (format: cf4_<prefix>_<secret>). Generated via POST /api/keys. Admin key also works here.",
          },
        },
      },
    };

    return Response.json(spec, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });

  // Scalar API docs
  addRoute("GET", "/docs", async () => {
    const html = layout({
      title: "API Documentation",
      content: `<div id="scalar-docs"></div>`,
      head: `<style>.${layoutStyles.nav},.${layoutStyles.footer}{display:none}.${baseStyles.container}{max-width:100%;padding:0}</style>`,
      scripts: `
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
        <script>
          Scalar.createApiReference('#scalar-docs', {
            url: '/openapi.json',
            theme: 'alternate',
            darkMode: true,
          });
        </script>`,
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
}
