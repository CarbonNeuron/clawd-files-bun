import { Raw } from "../jsx/jsx-runtime";
import { layout } from "./layout.tsx";
import { escapeHtml, formatBytes, formatRelativeDate } from "../utils";
import { config } from "../config";
import type { BucketRow, FileRow, VersionRow } from "../db";

export function filePage(
  bucket: BucketRow,
  file: FileRow,
  renderedContent: string,
  versions: VersionRow[]
): string {
  const bucketName = escapeHtml(bucket.name);
  const fileName = escapeHtml(file.path);
  const rawUrl = `/raw/${bucket.id}/${escapeHtml(file.path)}`;
  const shortUrl = `${escapeHtml(config.baseUrl)}/s/${escapeHtml(file.short_code)}`;
  const mime = file.mime_type;
  const isMedia = mime.startsWith("video/") || mime.startsWith("audio/");
  const isDataView = mime === "text/csv";

  const mediaPlayer = mime.startsWith("video/")
    ? <video controls preload="metadata" style="width:100%;max-height:80vh;border-radius:8px;"><source src={rawUrl} type={escapeHtml(mime)} /></video>
    : mime.startsWith("audio/")
    ? <audio controls preload="metadata" style="width:100%;"><source src={rawUrl} type={escapeHtml(mime)} /></audio>
    : null;

  const versionList = versions.length > 0 ? (
    <details style="margin-top:16px;">
      <summary style="cursor:pointer;color:var(--text-muted);font-size:13px;">Version History ({versions.length + 1} versions)</summary>
      <div style="margin-top:8px;">
        <div style="padding:6px 0;font-size:13px;color:var(--accent);">v{file.version} (current) — {formatBytes(file.size)}</div>
        {versions.map((v) => (
          <div style="padding:6px 0;font-size:13px;border-top:1px solid var(--border);">
            <a href={`/raw/${bucket.id}/${escapeHtml(file.path)}?v=${v.version}`}>v{v.version}</a>
            {" — "}{formatBytes(v.size)}{" — "}{formatRelativeDate(v.created_at)}
          </div>
        )).join("")}
      </div>
    </details>
  ) : null;

  const curlCmd = `curl -LJO ${shortUrl}`;
  const copyCmd = <div class="copy-cmd"><code>{curlCmd}</code><button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">copy</button></div>;

  const escapedPath = escapeHtml(file.path);
  const preview = isMedia ? mediaPlayer : (
    <div class={`preview-container${isDataView ? " preview-wide" : ""}`}>
      <div class="preview-header">
        <span>Preview</span>
        <div>
          <a href={`/${bucket.id}/${escapedPath}?view=raw`} class="btn" style="padding:2px 8px;font-size:11px;"
             hx-get={`/${bucket.id}/${escapedPath}?view=raw&fragment=1`}
             hx-target="#preview-body" hx-swap="innerHTML">Source</a>
          <a href={`/${bucket.id}/${escapedPath}`} class="btn" style="padding:2px 8px;font-size:11px;"
             hx-get={`/${bucket.id}/${escapedPath}?fragment=1`}
             hx-target="#preview-body" hx-swap="innerHTML">Rendered</a>
        </div>
      </div>
      <div class="preview-body" id="preview-body">
        <Raw html={renderedContent} />
      </div>
    </div>
  );

  const content = (
    <>
      <div class="breadcrumbs">
        <a href="/">home</a><span class="sep">/</span>
        <a href={`/${bucket.id}`}><Raw html={bucketName} /></a><span class="sep">/</span>
        <span><Raw html={fileName} /></span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h2><Raw html={fileName} /></h2>
        <div style="display:flex;gap:8px;">
          <a href={rawUrl} class="btn" download>Download</a>
          <a href={rawUrl} class="btn btn-primary" target="_blank">Raw</a>
        </div>
      </div>
      <div class="metadata">
        <span class="badge badge-accent">{escapeHtml(mime)}</span>
        <span class="badge">{formatBytes(file.size)}</span>
        <span class="badge">v{file.version}</span>
        <span class="badge">{formatRelativeDate(file.uploaded_at)}</span>
      </div>
      {copyCmd}
      {preview}
      {versionList}
    </>
  );

  const scripts = `
<script>
(function() {
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var ws = new WebSocket(proto + '//' + location.host + '/ws/file/${bucket.id}/${encodeURIComponent(file.path)}');
  ws.onmessage = function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'updated') {
        // Fetch updated preview fragment
        fetch('/${bucket.id}/${encodeURIComponent(file.path)}?fragment=1')
          .then(function(r) { return r.text(); })
          .then(function(html) {
            var el = document.getElementById('preview-body');
            if (el) el.innerHTML = html;
          });
      }
    } catch(err) {}
  };
  ws.onclose = function() { setTimeout(function() { location.reload(); }, 3000); };
})();
</script>`;

  return layout({ title: `${file.path} — ${bucket.name}`, content, scripts });
}
