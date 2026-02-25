import { addRoute } from "../router";
import { validateRequest, generateUploadToken, validateUploadToken } from "../auth";
import { getDb, getBucket, getFile, upsertFile, updateBucketStats, insertFileVersion } from "../db";
import { writeFile as writeStorageFile, archiveVersion, hashFile } from "../storage";
import { generateShortCode, getMimeType } from "../utils";
import { notifyBucketChange, notifyFileChange } from "../websocket";
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
    notifyBucketChange(result.bucketId);
    for (const f of uploadedFiles) notifyFileChange(result.bucketId, f.path);
    return Response.json({ uploaded: uploadedFiles }, { status: 201 });
  });

  // Upload page (GET) — simple drag-and-drop HTML with chunked upload support
  addRoute("GET", "/api/upload/:token", async (_req, params) => {
    const result = validateUploadToken(params.token);
    if (!result.valid) {
      return new Response("Upload link expired or invalid", { status: 401 });
    }

    // Return upload page HTML with chunked upload support
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
.progress-container { width: 100%; background: #1e293b; border-radius: 4px; height: 24px; margin-top: 12px; overflow: hidden; display: none; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #22d3ee, #6366f1); transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
.file-list { margin-top: 20px; text-align: left; max-height: 300px; overflow-y: auto; }
.file-item { padding: 8px; margin: 4px 0; background: #1e293b; border-radius: 4px; font-size: 14px; }
.file-item.uploading { opacity: 0.7; }
.file-item.complete { color: #4ade80; }
</style></head>
<body>
<div class="drop-zone" id="dropZone">
  <h2>Drop files here</h2>
  <p>or click to select</p>
  <input type="file" id="fileInput" multiple>
  <div class="progress-container" id="progressContainer">
    <div class="progress-bar" id="progressBar">0%</div>
  </div>
  <div class="status" id="status"></div>
  <div class="file-list" id="fileList"></div>
</div>
<script>
const zone = document.getElementById('dropZone');
const input = document.getElementById('fileInput');
const status = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const fileList = document.getElementById('fileList');
const bucketId = ${JSON.stringify(result.bucketId)};

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

zone.onclick = () => input.click();
zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('active'); };
zone.ondragleave = () => zone.classList.remove('active');
zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('active'); upload(e.dataTransfer.files); };
input.onchange = () => upload(input.files);

function generateUploadId() {
  return 'upload-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

function updateProgress(percent) {
  progressBar.style.width = percent + '%';
  progressBar.textContent = Math.round(percent) + '%';
}

function addFileToList(filename, statusText = 'uploading') {
  const item = document.createElement('div');
  item.className = 'file-item ' + statusText;
  item.id = 'file-' + filename.replace(/[^a-zA-Z0-9]/g, '_');
  item.textContent = filename + ' - ' + statusText;
  fileList.appendChild(item);
  return item;
}

function updateFileStatus(filename, statusText, className = '') {
  const item = document.getElementById('file-' + filename.replace(/[^a-zA-Z0-9]/g, '_'));
  if (item) {
    item.textContent = filename + ' - ' + statusText;
    item.className = 'file-item ' + className;
  }
}

async function uploadChunked(file) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = generateUploadId();
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const res = await fetch('/api/buckets/' + bucketId + '/upload/chunk', {
      method: 'POST',
      headers: {
        'X-Chunk-Index': chunkIndex.toString(),
        'X-Total-Chunks': totalChunks.toString(),
        'X-Upload-Id': uploadId,
        'X-Filename': file.name,
      },
      body: chunk,
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Chunk upload failed');
    }
    
    const data = await res.json();
    const progress = ((chunkIndex + 1) / totalChunks) * 100;
    updateProgress(progress);
    
    if (data.complete) {
      return data.file;
    }
  }
}

async function uploadDirect(file) {
  const fd = new FormData();
  fd.append('files', file);
  const res = await fetch('/api/upload/' + ${JSON.stringify(params.token)}, {
    method: 'POST',
    body: fd,
  });
  
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Upload failed');
  }
  
  const data = await res.json();
  return data.uploaded[0];
}

async function upload(files) {
  if (files.length === 0) return;
  
  progressContainer.style.display = 'block';
  fileList.innerHTML = '';
  status.textContent = 'Uploading ' + files.length + ' file(s)...';
  
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    addFileToList(file.name, 'uploading');
    
    try {
      let result;
      if (file.size > CHUNK_SIZE) {
        // Use chunked upload for files > 5MB
        result = await uploadChunked(file);
      } else {
        // Use direct upload for small files
        updateProgress((i / files.length) * 100);
        result = await uploadDirect(file);
        updateProgress(((i + 1) / files.length) * 100);
      }
      
      updateFileStatus(file.name, 'complete ✓', 'complete');
      results.push(result);
      successCount++;
    } catch (e) {
      updateFileStatus(file.name, 'error: ' + e.message, 'error');
      errorCount++;
    }
  }
  
  if (errorCount === 0) {
    status.innerHTML = '<span class="success">Uploaded ' + successCount + ' file(s) successfully</span>';
  } else {
    status.innerHTML = '<span class="error">Uploaded ' + successCount + ' file(s), ' + errorCount + ' failed</span>';
  }
  
  setTimeout(() => {
    progressContainer.style.display = 'none';
    updateProgress(0);
  }, 2000);
}
</script></body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  });
}
