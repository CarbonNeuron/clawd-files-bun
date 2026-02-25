import { addRoute } from "../router";
import { validateRequest } from "../auth";
import {
  getDb,
  createBucket,
  getBucket,
  listBucketsByOwner,
  listAllBuckets,
  updateBucket,
  deleteBucket,
  listFiles,
  updateBucketStats,
  getFile,
  upsertFile,
  insertFileVersion,
  incrementDailyUploads,
} from "../db";
import { deleteBucketDir, writeFile, archiveVersion, hashFile } from "../storage";
import { generateBucketId, parseExpiresIn, wantsJson, generateShortCode, getMimeType } from "../utils";
import { notifyBucketChange, notifyFileChange } from "../websocket";
import { config } from "../config";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

// Store for tracking active chunked uploads
const chunkedUploads = new Map<string, { totalChunks: number; receivedChunks: Set<number>; filename: string; bucketId: string }>();

// Get temp directory for chunked uploads
function getTempChunkDir(uploadId: string): string {
  return join(config.dataDir, "chunks", uploadId);
}

export function registerBucketRoutes() {
  // Chunked upload endpoint
  addRoute("POST", "/api/buckets/:id/upload/chunk", async (req, params) => {
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

    // Read chunk headers
    const chunkIndex = parseInt(req.headers.get("X-Chunk-Index") || "0", 10);
    const totalChunks = parseInt(req.headers.get("X-Total-Chunks") || "0", 10);
    const uploadId = req.headers.get("X-Upload-Id") || "";
    const filename = req.headers.get("X-Filename") || "";

    if (!uploadId || !filename || totalChunks < 1 || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return Response.json({ error: "Invalid chunk headers" }, { status: 400 });
    }

    // Save chunk to temp directory
    const tempDir = getTempChunkDir(uploadId);
    await mkdir(tempDir, { recursive: true });
    const chunkPath = join(tempDir, `chunk_${chunkIndex}`);
    
    // Write chunk - use arrayBuffer for better performance with large chunks
    try {
      const buffer = await req.arrayBuffer();
      await Bun.write(chunkPath, buffer);
    } catch (err) {
      // Cleanup on error
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      chunkedUploads.delete(uploadId);
      throw err;
    }

    // Track upload progress
    if (!chunkedUploads.has(uploadId)) {
      chunkedUploads.set(uploadId, {
        totalChunks,
        receivedChunks: new Set(),
        filename,
        bucketId: params.id,
      });
    }
    const upload = chunkedUploads.get(uploadId)!;
    upload.receivedChunks.add(chunkIndex);

    // Check if all chunks received
    if (upload.receivedChunks.size === totalChunks) {
      // Reassemble chunks - read all chunks into buffers first
      const buffers: Uint8Array[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const cp = join(tempDir, `chunk_${i}`);
        const chunkFile = Bun.file(cp);
        buffers.push(new Uint8Array(await chunkFile.arrayBuffer()));
      }
      
      // Concatenate all buffers
      const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of buffers) {
        combined.set(buf, offset);
        offset += buf.length;
      }
      const completeFile = new Blob([combined]);

      // Process as normal upload
      const sha256 = await hashFile(completeFile);
      const mimeType = getMimeType(filename);

      // Check for existing file (version handling)
      const existing = getFile(db, params.id, filename);
      if (existing) {
        await archiveVersion(params.id, filename, existing.version);
        insertFileVersion(db, existing.id, existing.version, existing.size, existing.sha256);
      }

      // Write to storage
      await writeFile(params.id, filename, completeFile);

      // Upsert in DB
      const shortCode = existing?.short_code ?? generateShortCode();
      upsertFile(db, params.id, filename, completeFile.size, mimeType, shortCode, sha256);

      const file = getFile(db, params.id, filename);
      
      // Cleanup temp directory
      await rm(tempDir, { recursive: true, force: true });
      chunkedUploads.delete(uploadId);

      // Update stats and notify
      updateBucketStats(db, params.id);
      notifyBucketChange(params.id);
      notifyFileChange(params.id, filename);
      incrementDailyUploads(db, 1, completeFile.size);

      return Response.json({
        complete: true,
        file: {
          path: filename,
          size: completeFile.size,
          mimeType,
          version: file?.version ?? 1,
          url: `${config.baseUrl}/${params.id}/${filename}`,
          rawUrl: `${config.baseUrl}/raw/${params.id}/${filename}`,
          shortUrl: `${config.baseUrl}/s/${shortCode}`,
        },
      }, { status: 201 });
    }

    // Chunk received but upload not complete
    return Response.json({
      complete: false,
      received: upload.receivedChunks.size,
      total: totalChunks,
    });
  });

  // Create bucket
  addRoute("POST", "/api/buckets", async (req) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    let body: { name?: string; description?: string; purpose?: string; expiresIn?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const id = generateBucketId();
    const expiresAt = body.expiresIn ? parseExpiresIn(body.expiresIn) : null;

    createBucket(db, id, body.name, auth.keyHash, body.description, body.purpose, expiresAt);

    const bucket = getBucket(db, id);
    return Response.json({ bucket }, { status: 201 });
  });

  // List buckets
  addRoute("GET", "/api/buckets", async (req) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const buckets = auth.isAdmin
      ? listAllBuckets(db)
      : listBucketsByOwner(db, auth.keyHash);

    return Response.json({ buckets });
  });

  // Get bucket detail
  addRoute("GET", "/api/buckets/:id", async (req, params) => {
    const db = getDb();
    const bucket = getBucket(db, params.id);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    const files = listFiles(db, params.id);

    if (wantsJson(req)) {
      return Response.json({ bucket, files });
    }

    // HTML response will be handled by page routes (Phase 3)
    return Response.json({ bucket, files });
  });

  // Update bucket
  addRoute("PATCH", "/api/buckets/:id", async (req, params) => {
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

    let body: { name?: string; description?: string; purpose?: string; expiresIn?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const fields: Record<string, string | number | null> = {};
    if (body.name) fields.name = body.name;
    if (body.description !== undefined) fields.description = body.description;
    if (body.purpose !== undefined) fields.purpose = body.purpose;
    if (body.expiresIn !== undefined) {
      fields.expires_at = body.expiresIn ? parseExpiresIn(body.expiresIn) : null;
    }

    updateBucket(db, params.id, fields);
    const updated = getBucket(db, params.id);
    return Response.json({ bucket: updated });
  });

  // Delete bucket
  addRoute("DELETE", "/api/buckets/:id", async (req, params) => {
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

    // Delete from disk and DB (CASCADE handles files)
    await deleteBucketDir(params.id);
    deleteBucket(db, params.id);

    return Response.json({ deleted: true });
  });
}
