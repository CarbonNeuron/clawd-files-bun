import { addRoute } from "../router";
import { validateRequest } from "../auth";
import {
  getDb,
  getBucket,
  getFile,
  upsertFile,
  deleteFile,
  listFiles,
  updateBucketStats,
  insertFileVersion,
  getFileVersions,
} from "../db";
import {
  writeFile as writeStorageFile,
  readFile,
  deleteStoredFile,
  archiveVersion,
  readVersion,
  hashFile,
  getFilePath,
} from "../storage";
import { generateShortCode, getMimeType, formatBytes } from "../utils";
import yazl from "yazl";

export function registerFileRoutes() {
  // Upload files
  addRoute("POST", "/api/buckets/:id/upload", async (req, params) => {
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

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Invalid multipart data" }, { status: 400 });
    }

    const uploadedFiles: Array<{ path: string; size: number; shortCode: string; version: number }> = [];

    for (const [_key, value] of formData.entries()) {
      if (!(value instanceof File)) continue;
      const fileName = value.name;
      const blob = value as Blob;
      const sha256 = await hashFile(blob);
      const mimeType = getMimeType(fileName);

      // Check for existing file (version handling)
      const existing = getFile(db, params.id, fileName);
      if (existing) {
        // Archive old version
        await archiveVersion(params.id, fileName, existing.version);
        insertFileVersion(db, existing.id, existing.version, existing.size, existing.sha256);
      }

      // Write to disk
      await writeStorageFile(params.id, fileName, blob);

      // Upsert in DB
      const shortCode = existing?.short_code ?? generateShortCode();
      upsertFile(db, params.id, fileName, blob.size, mimeType, shortCode, sha256);

      const file = getFile(db, params.id, fileName);
      uploadedFiles.push({
        path: fileName,
        size: blob.size,
        shortCode: file?.short_code ?? shortCode,
        version: file?.version ?? 1,
      });
    }

    if (uploadedFiles.length === 0) {
      return Response.json({ error: "No files in upload" }, { status: 400 });
    }

    updateBucketStats(db, params.id);
    return Response.json({ uploaded: uploadedFiles }, { status: 201 });
  });

  // Delete file
  addRoute("DELETE", "/api/buckets/:id/files/:path+", async (req, params) => {
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

    const file = getFile(db, params.id, params.path);
    if (!file) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    await deleteStoredFile(params.id, params.path);
    deleteFile(db, params.id, params.path);
    updateBucketStats(db, params.id);

    return Response.json({ deleted: true });
  });

  // File versions
  addRoute("GET", "/api/buckets/:id/files/:path+/versions", async (_req, params) => {
    const db = getDb();
    const file = getFile(db, params.id, params.path);
    if (!file) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    const versions = getFileVersions(db, file.id);
    return Response.json({ current: file.version, versions });
  });

  // Raw file serving
  addRoute("GET", "/raw/:bucketId/:path+", async (req, params) => {
    const bunFile = readFile(params.bucketId, params.path);
    const exists = await bunFile.exists();
    if (!exists) {
      return new Response("Not Found", { status: 404 });
    }

    const mimeType = getMimeType(params.path);
    const stat = bunFile;
    const size = stat.size;
    const etag = `"${Bun.hash(params.bucketId + params.path + size).toString(16)}"`;

    // Check If-None-Match
    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304 });
    }

    // Range request support
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : size - 1;
        const chunkSize = end - start + 1;

        return new Response(bunFile.slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Content-Length": String(chunkSize),
            "Accept-Ranges": "bytes",
            ETag: etag,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // Determine Content-Disposition
    const isInline = mimeType.startsWith("image/") || mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/") || mimeType === "application/pdf" ||
      mimeType.startsWith("text/");
    const disposition = isInline ? "inline" : `attachment; filename="${params.path.split("/").pop()}"`;

    return new Response(bunFile, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(size),
        "Content-Disposition": disposition,
        "Accept-Ranges": "bytes",
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });

  // Raw version serving
  addRoute("GET", "/raw/:bucketId/:path+/v/:version", async (req, params) => {
    const version = parseInt(params.version, 10);
    const bunFile = readVersion(params.bucketId, params.path, version);
    const exists = await bunFile.exists();
    if (!exists) {
      return new Response("Version not found", { status: 404 });
    }

    const mimeType = getMimeType(params.path);
    return new Response(bunFile, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${params.path.split("/").pop()}"`,
      },
    });
  });

  // Bucket summary (LLM-friendly)
  addRoute("GET", "/api/buckets/:id/summary", async (_req, params) => {
    const db = getDb();
    const bucket = getBucket(db, params.id);
    if (!bucket) {
      return new Response("Bucket not found", { status: 404 });
    }

    const files = listFiles(db, params.id);
    let summary = `Bucket: ${bucket.name}\n`;
    if (bucket.description) summary += `Description: ${bucket.description}\n`;
    if (bucket.purpose) summary += `Purpose: ${bucket.purpose}\n`;
    summary += `Files: ${files.length}\n`;
    summary += `Total size: ${formatBytes(bucket.total_size)}\n\n`;
    summary += `File listing:\n`;
    for (const file of files) {
      summary += `  ${file.path} (${formatBytes(file.size)}, ${file.mime_type})\n`;
    }

    return new Response(summary, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });

  // ZIP download
  addRoute("GET", "/api/buckets/:id/zip", async (_req, params) => {
    const db = getDb();
    const bucket = getBucket(db, params.id);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    const files = listFiles(db, params.id);
    if (files.length === 0) {
      return Response.json({ error: "Bucket has no files" }, { status: 404 });
    }

    const zipfile = new yazl.ZipFile();
    for (const file of files) {
      const absPath = getFilePath(params.id, file.path);
      zipfile.addFile(absPath, file.path);
    }
    zipfile.end();

    const safeName = bucket.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    return new Response(zipfile.outputStream as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}.zip"`,
      },
    });
  });
}
