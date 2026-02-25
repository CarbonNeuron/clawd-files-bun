import type { Server } from "bun";
import { escapeHtml, formatBytes, formatRelativeDate } from "./utils";
import { listFiles, getDb } from "./db";
import type { FileRow } from "./db";

let _server: Server | null = null;

export function setServer(server: Server) {
  _server = server;
}

export function notifyBucketChange(bucketId: string): void {
  if (!_server) return;
  const db = getDb();
  const files = listFiles(db, bucketId);
  const html = files.map((f) => fileRowHtml(bucketId, f)).join("");
  _server.publish(`bucket:${bucketId}`, html);
}

function fileRowHtml(bucketId: string, f: FileRow): string {
  const icon = getFileIcon(f.mime_type);
  return `<tr>
    <td class="file-icon">${icon}</td>
    <td class="file-name"><a href="/${bucketId}/${escapeHtml(f.path)}">${escapeHtml(f.path)}</a></td>
    <td class="file-meta">${formatBytes(f.size)}</td>
    <td class="file-meta">${formatRelativeDate(f.uploaded_at)}</td>
    <td class="file-meta"><a href="/raw/${bucketId}/${escapeHtml(f.path)}" download class="btn" style="padding:2px 10px;font-size:11px;">Download</a></td>
  </tr>`;
}

function getFileIcon(mime: string): string {
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
