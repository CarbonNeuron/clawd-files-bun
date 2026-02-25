import { addRoute } from "../router";
import { config } from "../config";
import { layout } from "../templates/layout";

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
      paths: {
        "/api/keys": {
          post: {
            summary: "Create API key",
            security: [{ bearerAuth: [] }],
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } } },
            responses: { "201": { description: "Key created" } },
          },
          get: {
            summary: "List API keys",
            security: [{ bearerAuth: [] }],
            responses: { "200": { description: "Key list" } },
          },
        },
        "/api/keys/{prefix}": {
          delete: {
            summary: "Revoke API key",
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "prefix", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "Key deleted" } },
          },
        },
        "/api/buckets": {
          post: {
            summary: "Create bucket",
            security: [{ bearerAuth: [] }],
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, purpose: { type: "string" }, expiresIn: { type: "string" } }, required: ["name"] } } } },
            responses: { "201": { description: "Bucket created" } },
          },
          get: {
            summary: "List buckets",
            security: [{ bearerAuth: [] }],
            responses: { "200": { description: "Bucket list" } },
          },
        },
        "/api/buckets/{id}": {
          get: { summary: "Get bucket detail", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Bucket with files" } } },
          patch: { summary: "Update bucket", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated bucket" } } },
          delete: { summary: "Delete bucket", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
        },
        "/api/buckets/{id}/upload": {
          post: {
            summary: "Upload files",
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { files: { type: "array", items: { type: "string", format: "binary" } } } } } } },
            responses: { "201": { description: "Files uploaded" } },
          },
        },
        "/api/buckets/{id}/zip": {
          get: { summary: "Download bucket as ZIP", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "ZIP file" } } },
        },
        "/api/buckets/{id}/summary": {
          get: { summary: "Plain text summary", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Text summary" } } },
        },
        "/api/buckets/{id}/upload-link": {
          post: { summary: "Generate upload link", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Upload URL" } } },
        },
        "/raw/{bucketId}/{path}": {
          get: { summary: "Raw file download", parameters: [{ name: "bucketId", in: "path", required: true, schema: { type: "string" } }, { name: "path", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "File content" } } },
        },
        "/s/{code}": {
          get: { summary: "Short URL redirect", parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }], responses: { "307": { description: "Redirect to raw file" } } },
        },
        "/health": {
          get: { summary: "Health check", responses: { "200": { description: "OK" } } },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
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
      head: `<style>.nav,.footer{display:none}.container{max-width:100%;padding:0}</style>`,
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
