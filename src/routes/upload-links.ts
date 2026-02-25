import { addRoute } from "../router";
import { validateRequest, generateUploadToken, validateUploadToken } from "../auth";
import { getDb, getBucket, getFile, upsertFile, updateBucketStats, insertFileVersion, incrementDailyUploads } from "../db";
import { streamWriteFile, streamWriteFromBody, archiveVersion } from "../storage";
import { generateShortCode, getMimeType } from "../utils";
import { notifyBucketChange, notifyFileChange } from "../websocket";
import { config } from "../config";
import { uploadPage } from "../templates/upload";

export function registerUploadLinkRoutes() {
  // Generate upload link
  addRoute("POST", "/api/buckets/:id/upload-link", async (req, params) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const bucket = getBucket(db, params.id);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    if (!auth.isAdmin && bucket.owner_key_hash !== auth.keyHash) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { expiresIn?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Use defaults
    }

    const expiresIn = body.expiresIn ?? "1h";
    const multipliers: Record<string, number> = { h: 3600, d: 86400, w: 604800 };
    const match = expiresIn.match(/^(\d+)([hdw])$/);
    const seconds = match
      ? parseInt(match[1], 10) * multipliers[match[2]]
      : 3600;
    const expiresAt = Math.floor(Date.now() / 1000) + seconds;

    const token = generateUploadToken(params.id, expiresAt);
    const url = `${config.baseUrl}/api/upload/${token}`;

    return Response.json({ url, token, expiresAt }, { status: 201 });
  });

  // Upload via token (POST)
  addRoute("POST", "/api/upload/:token", async (req, params) => {
    const result = validateUploadToken(params.token);
    if (!result.valid) {
      return Response.json({ error: result.error }, { status: 401 });
    }

    const db = getDb();
    const bucket = getBucket(db, result.bucketId);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Invalid multipart data" }, { status: 400 });
    }

    const uploadedFiles: Array<{ path: string; size: number; shortCode: string }> = [];

    for (const [_key, value] of formData.entries()) {
      if (!(value instanceof File)) continue;
      const fileName = value.name;
      const { sha256, size } = await streamWriteFile(result.bucketId, fileName, value);
      const mimeType = getMimeType(fileName);

      const existing = getFile(db, result.bucketId, fileName);
      if (existing) {
        await archiveVersion(result.bucketId, fileName, existing.version);
        insertFileVersion(db, existing.id, existing.version, existing.size, existing.sha256);
      }

      const shortCode = existing?.short_code ?? generateShortCode();
      upsertFile(db, result.bucketId, fileName, size, mimeType, shortCode, sha256);

      uploadedFiles.push({ path: fileName, size, shortCode });
    }

    if (uploadedFiles.length === 0) {
      return Response.json({ error: "No files in upload" }, { status: 400 });
    }

    updateBucketStats(db, result.bucketId);
    notifyBucketChange(result.bucketId);
    for (const f of uploadedFiles) notifyFileChange(result.bucketId, f.path);
    return Response.json({ uploaded: uploadedFiles }, { status: 201 });
  });

  // Streaming single-file upload via token — bypasses formData() buffering.
  addRoute("PUT", "/api/upload/:token/:filename+", async (req, params) => {
    const result = validateUploadToken(params.token);
    if (!result.valid) {
      return Response.json({ error: result.error }, { status: 401 });
    }

    const db = getDb();
    const bucket = getBucket(db, result.bucketId);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    const fileName = params.filename;
    if (!fileName) {
      return Response.json({ error: "Filename required in URL" }, { status: 400 });
    }

    if (!req.body) {
      return Response.json({ error: "Empty body" }, { status: 400 });
    }

    const { sha256, size } = await streamWriteFromBody(result.bucketId, fileName, req.body);
    const mimeType = getMimeType(fileName);

    const existing = getFile(db, result.bucketId, fileName);
    if (existing) {
      await archiveVersion(result.bucketId, fileName, existing.version);
      insertFileVersion(db, existing.id, existing.version, existing.size, existing.sha256);
    }

    const shortCode = existing?.short_code ?? generateShortCode();
    upsertFile(db, result.bucketId, fileName, size, mimeType, shortCode, sha256);

    updateBucketStats(db, result.bucketId);
    notifyBucketChange(result.bucketId);
    notifyFileChange(result.bucketId, fileName);

    return Response.json({ uploaded: [{ path: fileName, size, shortCode }] }, { status: 201 });
  });

  // Upload page (GET) — drag-and-drop HTML upload
  addRoute("GET", "/api/upload/:token", async (_req, params) => {
    const result = validateUploadToken(params.token);
    if (!result.valid) {
      return new Response("Upload link expired or invalid", { status: 401 });
    }

    const html = uploadPage({ token: params.token, baseUrl: config.baseUrl });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
}
