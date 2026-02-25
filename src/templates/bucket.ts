import { layout } from "./layout";
import { escapeHtml, formatBytes, formatRelativeDate } from "../utils";
import { config } from "../config";
import { isImageFile } from "../thumbnails";
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

function listViewRows(bucketId: string, files: FileRow[]): string {
  return files.map((f) => `
    <tr>
      <td class="file-icon">${fileIcon(f.mime_type)}</td>
      <td class="file-name"><a href="/${bucketId}/${escapeHtml(f.path)}">${escapeHtml(f.path)}</a></td>
      <td class="file-meta">${formatBytes(f.size)}</td>
      <td class="file-meta">${formatRelativeDate(f.uploaded_at)}</td>
      <td class="file-meta"><a href="/s/${escapeHtml(f.short_code)}" title="Short URL">s/${escapeHtml(f.short_code)}</a></td>
    </tr>`).join("");
}

function gridViewCards(bucketId: string, files: FileRow[]): string {
  return files.map((f) => {
    const isImage = isImageFile(f.path);
    const thumbUrl = `/api/buckets/${bucketId}/thumb/${escapeHtml(f.path)}`;
    const rawUrl = `/raw/${bucketId}/${escapeHtml(f.path)}`;
    const icon = fileIcon(f.mime_type);

    const preview = isImage
      ? `<img src="${thumbUrl}" alt="${escapeHtml(f.path)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : "";
    const fallback = `<div class="grid-icon" ${isImage ? 'style="display:none"' : ""}>${icon}</div>`;

    return `
    <a href="/${bucketId}/${escapeHtml(f.path)}" class="file-grid-item">
      <div class="grid-preview">${preview}${fallback}</div>
      <div class="grid-info">
        <div class="grid-name">${escapeHtml(f.path)}</div>
        <div class="grid-meta">${formatBytes(f.size)}</div>
      </div>
    </a>`;
  }).join("");
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

  let fileSection = "";
  if (files.length > 0) {
    const listRows = listViewRows(bucket.id, files);
    const gridCards = gridViewCards(bucket.id, files);

    fileSection = `
    <div class="view-toggle">
      <button class="btn view-btn active" data-view="list" onclick="setView('list')">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v1.5H2V3zm0 4h12v1.5H2V7zm0 4h12v1.5H2V11z"/></svg>
        List
      </button>
      <button class="btn view-btn" data-view="grid" onclick="setView('grid')">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/></svg>
        Grid
      </button>
    </div>

    <div style="margin-bottom:12px;">
      <input type="text" class="csv-filter" id="file-filter" placeholder="Filter files..." oninput="filterFiles(this.value)" style="width:100%;max-width:320px;">
    </div>

    <div id="file-view-list" class="file-view">
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="file-table" id="file-table">
          <thead><tr>
            <th style="width:32px;"></th>
            <th class="sortable" onclick="sortFiles('name')">Name <span id="sort-name"></span></th>
            <th class="sortable" onclick="sortFiles('size')">Size <span id="sort-size"></span></th>
            <th class="sortable" onclick="sortFiles('date')">Uploaded <span id="sort-date"></span></th>
            <th>Short URL</th>
          </tr></thead>
          <tbody id="file-list">${listRows}</tbody>
        </table>
      </div>
    </div>

    <div id="file-view-grid" class="file-view" style="display:none;">
      <div class="file-grid" id="file-grid">${gridCards}</div>
    </div>`;
  } else {
    fileSection = `<div class="card" style="text-align:center;color:var(--text-muted);">No files in this bucket yet.</div>`;
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

  const scripts = `
<script>
(function() {
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var ws = new WebSocket(proto + '//' + location.host + '/ws/bucket/${bucket.id}');
  ws.onmessage = function(e) {
    var list = document.getElementById('file-list');
    if (list) { list.innerHTML = e.data; }
  };
  ws.onclose = function() { setTimeout(function() { location.reload(); }, 3000); };
})();

function setView(view) {
  document.getElementById('file-view-list').style.display = view === 'list' ? '' : 'none';
  document.getElementById('file-view-grid').style.display = view === 'grid' ? '' : 'none';
  document.querySelectorAll('.view-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === view);
  });
  localStorage.setItem('cf4-view', view);
}

var _sortCol = null, _sortDir = 'asc';

function sortFiles(col) {
  if (_sortCol === col) { _sortDir = _sortDir === 'asc' ? 'desc' : 'asc'; }
  else { _sortCol = col; _sortDir = 'asc'; }
  document.querySelectorAll('.file-table th span').forEach(function(s) { s.textContent = ''; });
  var el = document.getElementById('sort-' + col);
  if (el) el.textContent = _sortDir === 'asc' ? ' ↑' : ' ↓';
  var tbody = document.getElementById('file-list');
  var rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort(function(a, b) {
    var cells = { name: 1, size: 2, date: 3 };
    var idx = cells[col] || 1;
    var va = a.cells[idx].textContent.trim();
    var vb = b.cells[idx].textContent.trim();
    if (col === 'size') {
      va = parseSize(va); vb = parseSize(vb);
      return _sortDir === 'asc' ? va - vb : vb - va;
    }
    if (col === 'date') {
      va = parseAge(va); vb = parseAge(vb);
      return _sortDir === 'asc' ? va - vb : vb - va;
    }
    var cmp = va.localeCompare(vb);
    return _sortDir === 'asc' ? cmp : -cmp;
  });
  rows.forEach(function(r) { tbody.appendChild(r); });
  applyGridSort();
}

function parseSize(s) {
  var m = s.match(/([\\d.]+)\\s*(B|KB|MB|GB|TB)/);
  if (!m) return 0;
  var units = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 };
  return parseFloat(m[1]) * (units[m[2]] || 1);
}

function parseAge(s) {
  if (s === 'just now') return 0;
  var m = s.match(/(\\d+)(m|h|d|mo|y)/);
  if (!m) return 0;
  var units = { m: 60, h: 3600, d: 86400, mo: 2592000, y: 31536000 };
  return parseInt(m[1]) * (units[m[2]] || 1);
}

function filterFiles(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#file-list tr').forEach(function(row) {
    var name = row.cells[1].textContent.toLowerCase();
    row.style.display = name.includes(q) ? '' : 'none';
  });
  document.querySelectorAll('#file-grid .file-grid-item').forEach(function(card) {
    var name = card.querySelector('.grid-name').textContent.toLowerCase();
    card.style.display = name.includes(q) ? '' : 'none';
  });
}

function applyGridSort() {
  var grid = document.getElementById('file-grid');
  if (!grid) return;
  var items = Array.from(grid.querySelectorAll('.file-grid-item'));
  var tbody = document.getElementById('file-list');
  var order = Array.from(tbody.querySelectorAll('tr')).map(function(r) { return r.cells[1].textContent.trim(); });
  items.sort(function(a, b) {
    return order.indexOf(a.querySelector('.grid-name').textContent) - order.indexOf(b.querySelector('.grid-name').textContent);
  });
  items.forEach(function(it) { grid.appendChild(it); });
}

(function() {
  var saved = localStorage.getItem('cf4-view');
  if (saved === 'grid') setView('grid');
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
      ${fileSection}
      ${readme}
    `,
    scripts,
  });
}
