import { registerRenderer } from "./registry";

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

async function csvRenderer(content: Buffer, filename: string): Promise<string> {
  const text = content.toString("utf-8");
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return `<div class="lumen-csv"><p>Empty CSV file</p></div>`;
  }

  const [header, ...dataRows] = rows;
  const maxRows = 10000;

  if (dataRows.length > maxRows) {
    // Large CSV — show first N rows with a note
    const displayRows = dataRows.slice(0, maxRows);
    return buildTable(header, displayRows, dataRows.length);
  }

  return buildTable(header, dataRows);
}

function buildTable(header: string[], rows: string[][], totalRows?: number): string {
  let html = `<div class="lumen-csv"><table>`;
  html += `<thead><tr>`;
  for (const h of header) {
    html += `<th>${Bun.escapeHTML(h)}</th>`;
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

  if (totalRows && totalRows > rows.length) {
    html += `<p style="color:#94a3b8;padding:12px;">Showing ${rows.length.toLocaleString()} of ${totalRows.toLocaleString()} rows</p>`;
  }

  html += `</div>`;
  return html;
}

registerRenderer(["text/csv"], [".csv", ".tsv"], csvRenderer);
