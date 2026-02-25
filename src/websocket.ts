import type { Server } from "bun";
import { escapeHtml, formatBytes, formatRelativeDate } from "./utils";
import type { FileRow } from "./db";

export function notifyBucketChange(
  server: Server,
  bucketId: string,
  files: FileRow[]
): void {
  // Publish updated file list HTML to all subscribers
  const html = files.map((f) => fileRowHtml(bucketId, f)).join("");
  server.publish(`bucket:${bucketId}`, html);
}

function fileRowHtml(bucketId: string, f: FileRow): string {
  const icon = getFileIcon(f.mime_type);
  return `<tr>
    <td class="file-icon">${icon}</td>
    <td class="file-name"><a href="/${bucketId}/${escapeHtml(f.path)}">${escapeHtml(f.path)}</a></td>
    <td class="file-meta">${formatBytes(f.size)}</td>
    <td class="file-meta">${formatRelativeDate(f.uploaded_at)}</td>
    <td class="file-meta"><a href="/s/${escapeHtml(f.short_code)}">s/${escapeHtml(f.short_code)}</a></td>
  </tr>`;
}

function getFileIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📄";
  if (mime === "application/json") return "{ }";
  if (mime === "text/markdown") return "📝";
  if (mime === "text/csv") return "📊";
  if (mime.startsWith("text/")) return "📃";
  return "📁";
}
