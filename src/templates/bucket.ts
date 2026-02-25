import { layout } from "./layout";
import { escapeHtml, formatBytes, formatRelativeDate } from "../utils";
import { config } from "../config";
import type { BucketRow, FileRow } from "../db";

function fileIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📄";
  if (mime === "application/json") return "📋";
  if (mime === "text/markdown") return "📝";
  if (mime === "text/csv") return "📊";
  if (mime.startsWith("text/")) return "📃";
  return "📁";
}

export function bucketPage(bucket: BucketRow, files: FileRow[], readmeHtml?: string): string {
  const name = escapeHtml(bucket.name);
  const desc = bucket.description ? `<p style="color:var(--text-muted);margin-bottom:16px;">${escapeHtml(bucket.description)}</p>` : "";

  const expiryBadge = bucket.expires_at
    ? `<span class="badge badge-warning">${bucket.expires_at < Date.now() / 1000 ? "expired" : `expires ${formatRelativeDate(bucket.expires_at)}`}</span>`
    : `<span class="badge badge-success">no expiry</span>`;

  const metadata = `
    <div class="metadata">
      <span class="badge badge-accent">${files.length} file${files.length !== 1 ? "s" : ""}</span>
      <span class="badge">${formatBytes(bucket.total_size)}</span>
      ${expiryBadge}
    </div>`;

  let fileTable = "";
  if (files.length > 0) {
    const rows = files.map((f) => `
      <tr>
        <td class="file-icon">${fileIcon(f.mime_type)}</td>
        <td class="file-name"><a href="/${bucket.id}/${escapeHtml(f.path)}">${escapeHtml(f.path)}</a></td>
        <td class="file-meta">${formatBytes(f.size)}</td>
        <td class="file-meta">${formatRelativeDate(f.uploaded_at)}</td>
        <td class="file-meta"><a href="/s/${escapeHtml(f.short_code)}" title="Short URL">s/${escapeHtml(f.short_code)}</a></td>
      </tr>`).join("");

    fileTable = `
    <div class="card" style="padding:0;overflow:hidden;">
      <table class="file-table">
        <thead><tr>
          <th style="width:32px;"></th><th>Name</th><th>Size</th><th>Uploaded</th><th>Short URL</th>
        </tr></thead>
        <tbody id="file-list">${rows}</tbody>
      </table>
    </div>`;
  } else {
    fileTable = `<div class="card" style="text-align:center;color:var(--text-muted);">No files in this bucket yet.</div>`;
  }

  const zipCmd = files.length > 0
    ? `<div class="copy-cmd"><code>curl -LJO ${escapeHtml(config.baseUrl)}/api/buckets/${bucket.id}/zip</code><button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">copy</button></div>`
    : "";

  const actions = `
    <div style="display:flex;gap:8px;margin:16px 0;">
      ${files.length > 0 ? `<a href="/api/buckets/${bucket.id}/zip" class="btn btn-primary">Download ZIP</a>` : ""}
      <a href="/api/buckets/${bucket.id}/summary" class="btn">Plain Text Summary</a>
    </div>`;

  const readme = readmeHtml ? `<div class="card" style="margin-top:24px;">${readmeHtml}</div>` : "";

  const wsScript = `
<script>
(function() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws/bucket/${bucket.id}');
  ws.onmessage = function(e) {
    const list = document.getElementById('file-list');
    if (list) { list.innerHTML = e.data; }
  };
  ws.onclose = function() { setTimeout(function() { location.reload(); }, 3000); };
})();
</script>`;

  return layout({
    title: name,
    content: `
      <div class="breadcrumbs">
        <a href="/">home</a><span class="sep">/</span><span>${name}</span>
      </div>
      <h1 style="margin-bottom:8px;">${name}</h1>
      ${desc}
      ${metadata}
      ${actions}
      ${zipCmd}
      ${fileTable}
      ${readme}
    `,
    scripts: wsScript,
  });
}
