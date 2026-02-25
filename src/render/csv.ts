import { registerRenderer } from "./registry";
import type { RenderContext } from "./registry";

// Native CSV parser handling quoted fields
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\n" || ch === "\r") {
        row.push(field);
        field = "";
        if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") i++;
        if (row.some((f) => f.length > 0)) rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.length > 0)) rows.push(row);
  }

  return rows;
}

// In-memory CSV store for interactive viewing
const csvStore = new Map<string, { header: string[]; rows: string[][] }>();
const csvStoreTimestamps = new Map<string, number>();

export function storeCsv(id: string, header: string[], rows: string[][]): void {
  csvStore.set(id, { header, rows });
  csvStoreTimestamps.set(id, Date.now());
}

export function getCsvData(id: string): { header: string[]; rows: string[][] } | null {
  const data = csvStore.get(id);
  if (data) csvStoreTimestamps.set(id, Date.now());
  return data ?? null;
}

export function evictStaleCsvData(maxAgeMs = 3600000): void {
  const now = Date.now();
  for (const [id, ts] of csvStoreTimestamps) {
    if (now - ts > maxAgeMs) {
      csvStore.delete(id);
      csvStoreTimestamps.delete(id);
    }
  }
}

export function queryCsv(
  id: string,
  opts: { page?: number; perPage?: number; sort?: string; dir?: string; filter?: string }
): { header: string[]; rows: string[][]; total: number; page: number; perPage: number; totalPages: number } | null {
  const data = getCsvData(id);
  if (!data) return null;

  const { header, rows } = data;
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(500, Math.max(1, opts.perPage ?? 100));

  // Filter
  let filtered = rows;
  if (opts.filter) {
    const q = opts.filter.toLowerCase();
    filtered = rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }

  // Sort
  if (opts.sort) {
    const colIdx = header.findIndex((h) => h === opts.sort);
    if (colIdx >= 0) {
      const dir = opts.dir === "desc" ? -1 : 1;
      filtered = [...filtered].sort((a, b) => {
        const va = a[colIdx] ?? "";
        const vb = b[colIdx] ?? "";
        // Try numeric comparison
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        return va.localeCompare(vb) * dir;
      });
    }
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * perPage;
  const pageRows = filtered.slice(start, start + perPage);

  return { header, rows: pageRows, total, page: clampedPage, perPage, totalPages };
}

async function csvRenderer(content: Buffer, filename: string, context?: RenderContext): Promise<string> {
  const text = content.toString("utf-8");
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return `<div class="lumen-csv"><p>Empty CSV file</p></div>`;
  }

  const [header, ...dataRows] = rows;

  // Store for interactive querying
  const bucketId = context?.bucketId ?? "unknown";
  const csvId = `${bucketId}:${filename}`;
  storeCsv(csvId, header, dataRows);

  const encodedId = encodeURIComponent(csvId);
  const viewerUrl = `/view/table/${encodedId}`;

  // Render the interactive shell
  return `<div class="lumen-csv lumen-table-viewer">
  <div class="csv-toolbar">
    <input type="text" class="csv-filter" placeholder="Filter rows..."
      hx-get="${viewerUrl}" hx-trigger="keyup changed delay:300ms" hx-target="#csv-table-body"
      hx-include="this" name="filter">
    <span class="csv-count">${dataRows.length.toLocaleString()} rows</span>
  </div>
  <div id="csv-table-body" hx-get="${viewerUrl}" hx-trigger="load" hx-swap="innerHTML">
  </div>
</div>`;
}

export function renderTableFragment(
  header: string[],
  rows: string[][],
  total: number,
  page: number,
  perPage: number,
  totalPages: number,
  viewerUrl: string,
  currentSort?: string,
  currentDir?: string,
  currentFilter?: string
): string {
  const filterParam = currentFilter ? `&filter=${encodeURIComponent(currentFilter)}` : "";

  let html = `<table><thead><tr>`;
  for (const h of header) {
    const isActive = currentSort === h;
    const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
    const arrow = isActive ? (currentDir === "desc" ? " ↓" : " ↑") : "";
    html += `<th class="sortable${isActive ? " sorted" : ""}"
      hx-get="${viewerUrl}?sort=${encodeURIComponent(h)}&dir=${nextDir}&page=1${filterParam}"
      hx-target="#csv-table-body" hx-swap="innerHTML"
      style="cursor:pointer">${Bun.escapeHTML(h)}${arrow}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const row of rows) {
    html += `<tr>`;
    for (let i = 0; i < header.length; i++) {
      html += `<td>${Bun.escapeHTML(row[i] ?? "")}</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>`;

  // Pagination
  if (totalPages > 1) {
    const sortParam = currentSort ? `&sort=${encodeURIComponent(currentSort)}&dir=${currentDir ?? "asc"}` : "";
    html += `<div class="pagination">`;
    if (page > 1) {
      html += `<a hx-get="${viewerUrl}?page=${page - 1}${sortParam}${filterParam}" hx-target="#csv-table-body" hx-swap="innerHTML">← Prev</a>`;
    }
    html += `<span>Page ${page} of ${totalPages} (${total.toLocaleString()} rows)</span>`;
    if (page < totalPages) {
      html += `<a hx-get="${viewerUrl}?page=${page + 1}${sortParam}${filterParam}" hx-target="#csv-table-body" hx-swap="innerHTML">Next →</a>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="pagination"><span>${total.toLocaleString()} rows</span></div>`;
  }

  return html;
}

registerRenderer(["text/csv"], [".csv", ".tsv"], csvRenderer);
