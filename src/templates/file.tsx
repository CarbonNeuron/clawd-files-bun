import { Raw } from "../jsx/jsx-runtime";
import { layout } from "./layout.tsx";
import { escapeHtml, encodeFilePath, formatBytes, formatRelativeDate } from "../utils";
import { config } from "../config";
import { getClientJs } from "../client-bundle";
import { cssText } from "../css-text";
import fileStyles from "../styles/file.module.css";
import layoutStyles from "../styles/layout.module.css";
import renderStyles from "../styles/render.module.css";
import type { BucketRow, FileRow, VersionRow } from "../db";

export function filePage(
  bucket: BucketRow,
  file: FileRow,
  renderedContent: string,
  versions: VersionRow[]
): string {
  const bucketName = escapeHtml(bucket.name);
  const fileName = escapeHtml(file.path);
  const rawUrl = `/raw/${bucket.id}/${encodeFilePath(file.path)}`;
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
    <details class={fileStyles.versionDetails}>
      <summary class={fileStyles.versionSummary}>Version History ({versions.length + 1} versions)</summary>
      <div style="margin-top:8px;">
        <div class={fileStyles.versionCurrent}>v{file.version} (current) — {formatBytes(file.size)}</div>
        {versions.map((v) => (
          <div class={fileStyles.versionItem}>
            <a href={`/raw/${bucket.id}/${encodeFilePath(file.path)}?v=${v.version}`}>v{v.version}</a>
            {" — "}{formatBytes(v.size)}{" — "}{formatRelativeDate(v.created_at)}
          </div>
        )).join("")}
      </div>
    </details>
  ) : null;

  const curlCmd = `curl -LJO ${shortUrl}`;
  const copyCmd = <div class={layoutStyles.copyCmd}><code>{curlCmd}</code><button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">copy</button></div>;

  const escapedPath = encodeFilePath(file.path);
  const preview = isMedia ? mediaPlayer : (
    <div class={isDataView ? `${fileStyles.previewContainer} ${fileStyles.previewWide}` : fileStyles.previewContainer}>
      <div class={fileStyles.previewHeader}>
        <span>Preview</span>
        <div class={fileStyles.previewActions}>
          <button class={`${layoutStyles.btn} ${fileStyles.previewBtn}`}
            data-action="source">Source</button>
          <button class={`${layoutStyles.btn} ${fileStyles.previewBtn} ${fileStyles.previewBtnActive}`}
            data-action="rendered">Rendered</button>
        </div>
      </div>
      <div class={fileStyles.previewBody} id="preview-body">
        <Raw html={renderedContent} />
      </div>
    </div>
  );

  const pageData = JSON.stringify({
    bucketId: bucket.id,
    filePath: file.path,
    styles: {
      previewBtnActive: fileStyles.previewBtnActive,
    },
  });

  const head = `<style>${cssText(fileStyles, "file")}${cssText(renderStyles, "render")}</style><script type="application/json" id="pageData">${pageData}</script>`;
  const scripts = `<script>${getClientJs("file")}</script>`;

  const content = (
    <>
      <div class={layoutStyles.breadcrumbs}>
        <a href="/" class={layoutStyles.breadcrumbLink}>home</a><span class={layoutStyles.breadcrumbSep}>/</span>
        <a href={`/${bucket.id}`} class={layoutStyles.breadcrumbLink}><Raw html={bucketName} /></a><span class={layoutStyles.breadcrumbSep}>/</span>
        <span><Raw html={fileName} /></span>
      </div>
      <div class={fileStyles.headerRow}>
        <h2><Raw html={fileName} /></h2>
        <div class={fileStyles.headerActions}>
          <a href={rawUrl} class={layoutStyles.btn} download>Download</a>
          <a href={rawUrl} class={`${layoutStyles.btn} ${layoutStyles.btnPrimary}`} target="_blank">Raw</a>
        </div>
      </div>
      <div class={layoutStyles.metadata}>
        <span class={`${layoutStyles.badge} ${layoutStyles.badgeAccent}`}>{escapeHtml(mime)}</span>
        <span class={layoutStyles.badge}>{formatBytes(file.size)}</span>
        <span class={layoutStyles.badge}>v{file.version}</span>
        <span class={layoutStyles.badge}>{formatRelativeDate(file.uploaded_at)}</span>
      </div>
      {copyCmd}
      {preview}
      {versionList}
    </>
  );

  return layout({ title: `${file.path} — ${bucket.name}`, content, head, scripts });
}
