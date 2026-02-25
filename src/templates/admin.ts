import { layout } from "./layout";
import { escapeHtml, formatBytes, formatRelativeDate } from "../utils";
import type { BucketRow } from "../db";

type AdminStats = {
  totalBuckets: number;
  totalFiles: number;
  totalSize: number;
  keyCount: number;
};

type KeyInfo = {
  prefix: string;
  name: string;
  created_at: number;
  last_used: number | null;
};

export function adminPage(
  stats: AdminStats,
  keys: KeyInfo[],
  buckets: BucketRow[]
): string {
  const statsGrid = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalBuckets}</div>
        <div class="stat-label">Buckets</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalFiles}</div>
        <div class="stat-label">Files</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatBytes(stats.totalSize)}</div>
        <div class="stat-label">Total Storage</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.keyCount}</div>
        <div class="stat-label">API Keys</div>
      </div>
    </div>`;

  const keysTable = keys.length > 0 ? `
    <h2 style="margin-bottom:16px;">API Keys</h2>
    <div class="card" style="overflow-x:auto;">
      <table class="file-table">
        <thead><tr>
          <th>Prefix</th><th>Name</th><th>Created</th><th>Last Used</th><th></th>
        </tr></thead>
        <tbody>
          ${keys.map((k) => `
          <tr>
            <td><code>${escapeHtml(k.prefix)}</code></td>
            <td>${escapeHtml(k.name)}</td>
            <td class="file-meta">${formatRelativeDate(k.created_at)}</td>
            <td class="file-meta">${k.last_used ? formatRelativeDate(k.last_used) : "never"}</td>
            <td><button class="btn" style="padding:2px 8px;font-size:11px;color:var(--error);"
                hx-delete="/api/keys/${escapeHtml(k.prefix)}"
                hx-confirm="Revoke key ${escapeHtml(k.prefix)}?"
                hx-target="closest tr" hx-swap="outerHTML">Revoke</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  const bucketsTable = buckets.length > 0 ? `
    <h2 style="margin:32px 0 16px;">All Buckets</h2>
    <div class="card" style="overflow-x:auto;">
      <table class="file-table">
        <thead><tr>
          <th>ID</th><th>Name</th><th>Files</th><th>Size</th><th>Created</th><th>Expires</th>
        </tr></thead>
        <tbody>
          ${buckets.map((b) => `
          <tr>
            <td><a href="/${b.id}"><code>${b.id}</code></a></td>
            <td>${escapeHtml(b.name)}</td>
            <td>${b.file_count}</td>
            <td>${formatBytes(b.total_size)}</td>
            <td class="file-meta">${formatRelativeDate(b.created_at)}</td>
            <td class="file-meta">${b.expires_at ? formatRelativeDate(b.expires_at) : "never"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "" ;

  return layout({
    title: "Admin Dashboard",
    content: `
      <h1 style="margin-bottom:24px;">Admin Dashboard</h1>
      ${statsGrid}
      ${keysTable}
      ${bucketsTable}
    `,
  });
}
