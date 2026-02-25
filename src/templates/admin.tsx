import { Raw } from "../jsx/jsx-runtime";
import { layout } from "./layout.tsx";
import { escapeHtml, formatBytes, formatRelativeDate } from "../utils";
import { getClientJs } from "../client-bundle";
import adminStyles from "../styles/admin.module.css";
import bucketStyles from "../styles/bucket.module.css";
import layoutStyles from "../styles/layout.module.css";
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

export function adminPage(stats: AdminStats, keys: KeyInfo[], buckets: BucketRow[]): string {
  const content = (
    <>
      <h1 class={adminStyles.title}>Admin Dashboard</h1>
      <div class={adminStyles.statsGrid}>
        <div class={adminStyles.statCard}><div class={adminStyles.statValue}>{stats.totalBuckets}</div><div class={adminStyles.statLabel}>Buckets</div></div>
        <div class={adminStyles.statCard}><div class={adminStyles.statValue}>{stats.totalFiles}</div><div class={adminStyles.statLabel}>Files</div></div>
        <div class={adminStyles.statCard}><div class={adminStyles.statValue}>{formatBytes(stats.totalSize)}</div><div class={adminStyles.statLabel}>Total Storage</div></div>
        <div class={adminStyles.statCard}><div class={adminStyles.statValue}>{stats.keyCount}</div><div class={adminStyles.statLabel}>API Keys</div></div>
      </div>
      {keys.length > 0 ? (
        <>
          <h2 class={adminStyles.sectionTitle}>API Keys</h2>
          <div class={layoutStyles.card} style="overflow-x:auto;">
            <table class={bucketStyles.fileTable}>
              <thead><tr><th class={bucketStyles.fileTableHead}>Prefix</th><th class={bucketStyles.fileTableHead}>Name</th><th class={bucketStyles.fileTableHead}>Created</th><th class={bucketStyles.fileTableHead}>Last Used</th><th class={bucketStyles.fileTableHead}></th></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr class={bucketStyles.fileTableRow}>
                    <td class={bucketStyles.fileTableCell}><code>{escapeHtml(k.prefix)}</code></td>
                    <td class={bucketStyles.fileTableCell}>{escapeHtml(k.name)}</td>
                    <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileMeta}`}>{formatRelativeDate(k.created_at)}</td>
                    <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileMeta}`}>{k.last_used ? formatRelativeDate(k.last_used) : "never"}</td>
                    <td class={bucketStyles.fileTableCell}><button class={`${layoutStyles.btn} ${adminStyles.revokeBtn}`}
                        data-revoke={escapeHtml(k.prefix)}>Revoke</button></td>
                  </tr>
                )).join("")}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {buckets.length > 0 ? (
        <>
          <h2 class={adminStyles.sectionTitle}>All Buckets</h2>
          <div class={layoutStyles.card} style="overflow-x:auto;">
            <table class={bucketStyles.fileTable}>
              <thead><tr><th class={bucketStyles.fileTableHead}>ID</th><th class={bucketStyles.fileTableHead}>Name</th><th class={bucketStyles.fileTableHead}>Files</th><th class={bucketStyles.fileTableHead}>Size</th><th class={bucketStyles.fileTableHead}>Created</th><th class={bucketStyles.fileTableHead}>Expires</th></tr></thead>
              <tbody>
                {buckets.map((b) => (
                  <tr class={bucketStyles.fileTableRow}>
                    <td class={bucketStyles.fileTableCell}><a href={`/${b.id}`}><code>{b.id}</code></a></td>
                    <td class={bucketStyles.fileTableCell}>{escapeHtml(b.name)}</td>
                    <td class={bucketStyles.fileTableCell}>{b.file_count}</td>
                    <td class={bucketStyles.fileTableCell}>{formatBytes(b.total_size)}</td>
                    <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileMeta}`}>{formatRelativeDate(b.created_at)}</td>
                    <td class={`${bucketStyles.fileTableCell} ${bucketStyles.fileMeta}`}>{b.expires_at ? formatRelativeDate(b.expires_at) : "never"}</td>
                  </tr>
                )).join("")}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );

  const head = `<style>${adminStyles.cssText}${bucketStyles.cssText}</style>`;
  const scripts = `<script>${getClientJs("admin")}</script>`;

  return layout({ title: "Admin Dashboard", content, head, scripts });
}
