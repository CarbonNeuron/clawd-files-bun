import { addRoute } from "../router";
import { validateRequest, generateUploadToken, validateUploadToken } from "../auth";
import { getDb, getBucket, getFile, upsertFile, updateBucketStats, insertFileVersion } from "../db";
import { writeFile as writeStorageFile, archiveVersion, hashFile } from "../storage";
import { generateShortCode, getMimeType } from "../utils";
import { config } from "../config";

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
    const url = `${config.baseUrl}/upload/${token}`;

    return Response.json({ url, token, expiresAt }, { status: 201 });
  });

  // Upload via token (POST)
  addRoute("POST", "/upload/:token", async (req, params) => {
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
      const blob = value as Blob;
      const sha256 = await hashFile(blob);
      const mimeType = getMimeType(fileName);

      const existing = getFile(db, result.bucketId, fileName);
      if (existing) {
        await archiveVersion(result.bucketId, fileName, existing.version);
        insertFileVersion(db, existing.id, existing.version, existing.size, existing.sha256);
      }

      await writeStorageFile(result.bucketId, fileName, blob);
      const shortCode = existing?.short_code ?? generateShortCode();
      upsertFile(db, result.bucketId, fileName, blob.size, mimeType, shortCode, sha256);

      uploadedFiles.push({ path: fileName, size: blob.size, shortCode });
    }

    if (uploadedFiles.length === 0) {
      return Response.json({ error: "No files in upload" }, { status: 400 });
    }

    updateBucketStats(db, result.bucketId);
    return Response.json({ uploaded: uploadedFiles }, { status: 201 });
  });

  // Upload page (GET) — simple drag-and-drop HTML
  addRoute("GET", "/upload/:token", async (_req, params) => {
    const result = validateUploadToken(params.token);
    if (!result.valid) {
      return new Response("Upload link expired or invalid", { status: 401 });
    }

    // Return upload page HTML (will be replaced by template in Phase 3)
    const html = `<!DOCTYPE html>
<html><head><title>Upload Files</title>
<style>
body { font-family: system-ui; background: #06090f; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
.drop-zone { border: 2px dashed #22d3ee; border-radius: 12px; padding: 60px; text-align: center; cursor: pointer; transition: background 0.2s; max-width: 500px; }
.drop-zone.active { background: rgba(34, 211, 238, 0.1); }
.drop-zone h2 { color: #22d3ee; margin: 0 0 10px; }
input[type=file] { display: none; }
.status { margin-top: 20px; min-height: 40px; }
.success { color: #4ade80; }
.error { color: #f87171; }
</style></head>
<body>
<div class="drop-zone" id="dropZone">
  <h2>Drop files here</h2>
  <p>or click to select</p>
  <input type="file" id="fileInput" multiple>
  <div class="status" id="status"></div>
</div>
<script>
const zone = document.getElementById('dropZone');
const input = document.getElementById('fileInput');
const status = document.getElementById('status');
const token = '${Bun.escapeHTML(params.token)}';
zone.onclick = () => input.click();
zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('active'); };
zone.ondragleave = () => zone.classList.remove('active');
zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('active'); upload(e.dataTransfer.files); };
input.onchange = () => upload(input.files);
async function upload(files) {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  status.textContent = 'Uploading...';
  try {
    const res = await fetch('/upload/' + token, { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) {
      status.innerHTML = '<span class="success">Uploaded ' + data.uploaded.length + ' file(s)</span>';
    } else {
      status.innerHTML = '<span class="error">' + (data.error || 'Upload failed') + '</span>';
    }
  } catch(e) {
    status.innerHTML = '<span class="error">Upload failed</span>';
  }
}
</script></body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  });
}
