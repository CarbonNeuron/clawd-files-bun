import { Raw } from "../jsx/jsx-runtime";
import { layout } from "./layout.tsx";
import { escapeHtml, encodeFilePath, formatBytes, formatRelativeDate } from "../utils";
import { config } from "../config";
import { isImageFile } from "../thumbnails";
import { getClientJs } from "../client-bundle";
import { cssText } from "../css-text";
import bucketStyles from "../styles/bucket.module.css";
import layoutStyles from "../styles/layout.module.css";
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
  return "📄";
}

function FileRow({ bucketId, f }: { bucketId: string; f: FileRow; children?: unknown }) {
  return (
    <tr class={bucketStyles.fileTableRow}>
      <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileIcon}`}>{fileIcon(f.mime_type)}</td>
      <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileName}`}><a href={`/${bucketId}/${encodeFilePath(f.path)}`} class={bucketStyles.fileNameLink}>{escapeHtml(f.path)}</a></td>
      <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileMeta}`}>{formatBytes(f.size)}</td>
      <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileMeta}`}>{formatRelativeDate(f.uploaded_at)}</td>
      <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileMeta}`}><a href={`/raw/${bucketId}/${encodeFilePath(f.path)}`} download class={layoutStyles.btn} style="padding:2px 10px;font-size:11px;">Download</a></td>
    </tr>
  );
}

// Preview HTML is server-generated from trusted content: Shiki codeToHtml output
// (which escapes code internally), escapeHtml-escaped URLs, and static HTML tags.
// No user-supplied HTML is injected — all content comes from local files on disk.
function GridCard({ bucketId, f, snippet }: { bucketId: string; f: FileRow; snippet?: string; children?: unknown }) {
  const isImage = isImageFile(f.path);
  const isVideo = f.mime_type.startsWith("video/");
  const thumbUrl = `/api/buckets/${bucketId}/thumb/${encodeFilePath(f.path)}`;
  const rawUrl = `/raw/${bucketId}/${encodeFilePath(f.path)}`;
  const icon = fileIcon(f.mime_type);

  let previewHtml: string;
  if (isImage) {
    const img = `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(f.path)}" loading="lazy" class="${bucketStyles.gridPreviewImg}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`;
    const fallback = `<div class="${bucketStyles.gridIcon}" style="display:none">${icon}</div>`;
    previewHtml = img + fallback;
  } else if (isVideo) {
    previewHtml = `<video src="${escapeHtml(rawUrl)}" preload="metadata" muted playsinline class="${bucketStyles.gridVideoPreview}"></video>`;
  } else if (snippet) {
    previewHtml = `<div class="${bucketStyles.gridCodePreview}">${snippet}<div class="${bucketStyles.gridCodeFade}"></div></div>`;
  } else {
    previewHtml = `<div class="${bucketStyles.gridIcon}">${icon}</div>`;
  }

  return (
    <div class={bucketStyles.gridItem} data-grid-item>
      <a href={`/${bucketId}/${encodeFilePath(f.path)}`} class={bucketStyles.gridPreviewLink}>
        <div class={bucketStyles.gridPreview} dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </a>
      <div class={bucketStyles.gridInfo}>
        <a href={`/${bucketId}/${encodeFilePath(f.path)}`} class={bucketStyles.gridName} data-grid-name>{escapeHtml(f.path)}</a>
        <div class={bucketStyles.gridMetaRow}>
          <span class={bucketStyles.gridMeta}>{formatBytes(f.size)}</span>
          <a href={rawUrl} download class={bucketStyles.gridDownload} title="Download">↓</a>
        </div>
      </div>
    </div>
  );
}

export function bucketPage(bucket: BucketRow, files: FileRow[], readmeHtml?: string, snippets?: Map<string, string>): string {
  const name = escapeHtml(bucket.name);
  const purpose = bucket.purpose
    ? <p class={bucketStyles.purpose}>{escapeHtml(bucket.purpose)}</p>
    : null;
  const desc = bucket.description
    ? <p class={bucketStyles.description}>{escapeHtml(bucket.description)}</p>
    : null;

  const expiryBadge = bucket.expires_at
    ? <span class={`${layoutStyles.badge} ${layoutStyles.badgeWarning}`}>{bucket.expires_at < Date.now() / 1000 ? "expired" : `expires ${formatRelativeDate(bucket.expires_at)}`}</span>
    : <span class={`${layoutStyles.badge} ${layoutStyles.badgeSuccess}`}>no expiry</span>;

  const headerActions = (
    <div class={bucketStyles.headerActions}>
      {files.length > 0 ? <a href={`/api/buckets/${bucket.id}/zip`} class={`${layoutStyles.btn} ${layoutStyles.btnPrimary}`}>Download ZIP</a> : null}
      <a href={`/api/buckets/${bucket.id}/summary`} class={layoutStyles.btn}>Summary</a>
    </div>
  );

  const zipCmd = files.length > 0
    ? <div class={layoutStyles.copyCmd}><code>curl -LJO {escapeHtml(config.baseUrl)}/api/buckets/{bucket.id}/zip</code><button class={layoutStyles.copyCmdBtn} onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">copy</button></div>
    : null;

  let fileSection: string;
  if (files.length > 0) {
    const listRows = files.map((f) => <FileRow bucketId={bucket.id} f={f} />).join("");
    const gridCards = files.map((f) => <GridCard bucketId={bucket.id} f={f} snippet={snippets?.get(f.path)} />).join("");

    fileSection = (
      <>
        <div class={bucketStyles.toolbar}>
          <input type="text" class={bucketStyles.filterInput} id="file-filter" placeholder="Filter files..." oninput="filterFiles(this.value)" />
          <div class={bucketStyles.viewToggle}>
            <button class={`${layoutStyles.btn} ${bucketStyles.viewBtn} ${bucketStyles.viewBtnActive}`} data-view="list" onclick="setView('list')">
              <Raw html={`<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v1.5H2V3zm0 4h12v1.5H2V7zm0 4h12v1.5H2V11z"/></svg>`} /> List
            </button>
            <button class={`${layoutStyles.btn} ${bucketStyles.viewBtn}`} data-view="grid" onclick="setView('grid')">
              <Raw html={`<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/></svg>`} /> Grid
            </button>
          </div>
        </div>
        <div id="file-view-list">
          <div class={layoutStyles.card} style="padding:0;overflow:hidden;">
            <table class={bucketStyles.fileTable} id="file-table">
              <thead><tr>
                <th class={bucketStyles.fileTableHead} style="width:32px;"></th>
                <th class={`${bucketStyles.fileTableHead} ${bucketStyles.sortable}`} onclick="sortFiles('name')">Name <span id="sort-name"></span></th>
                <th class={`${bucketStyles.fileTableHead} ${bucketStyles.sortable}`} onclick="sortFiles('size')">Size <span id="sort-size"></span></th>
                <th class={`${bucketStyles.fileTableHead} ${bucketStyles.sortable}`} onclick="sortFiles('date')">Uploaded <span id="sort-date"></span></th>
                <th class={bucketStyles.fileTableHead}></th>
              </tr></thead>
              <tbody id="file-list"><Raw html={listRows} /></tbody>
            </table>
          </div>
        </div>
        <div id="file-view-grid" style="display:none;">
          <div class={bucketStyles.fileGrid} id="file-grid"><Raw html={gridCards} /></div>
        </div>
      </>
    );
  } else {
    fileSection = <div class={layoutStyles.card} style="text-align:center;color:var(--text-muted);">No files in this bucket yet.</div>;
  }

  const readme = readmeHtml ? <div class={layoutStyles.card} style="margin-top:24px;"><Raw html={readmeHtml} /></div> : null;

  const pageData = JSON.stringify({
    bucketId: bucket.id,
    styles: {
      viewBtnActive: bucketStyles.viewBtnActive,
    },
  });

  const head = `<style>${cssText(bucketStyles, "bucket")}</style><script type="application/json" id="pageData">${pageData}</script>`;
  const scripts = `<script>${getClientJs("bucket")}</script>`;

  const content = (
    <>
      <div class={layoutStyles.breadcrumbs}>
        <a href="/" class={layoutStyles.breadcrumbLink}>home</a><span class={layoutStyles.breadcrumbSep}>/</span><span><Raw html={name} /></span>
      </div>
      <div class={bucketStyles.headerRow}>
        <div>
          <h1><Raw html={name} /></h1>
          {purpose}
        </div>
        {headerActions}
      </div>
      {desc}
      <div class={layoutStyles.metadata}>
        <span class={`${layoutStyles.badge} ${layoutStyles.badgeAccent}`}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
        <span class={layoutStyles.badge}>{formatBytes(bucket.total_size)}</span>
        {expiryBadge}
      </div>
      {zipCmd}
      <Raw html={fileSection} />
      {readme}
    </>
  );

  return layout({ title: bucket.name, content, head, scripts });
}
