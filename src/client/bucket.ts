interface PageData {
  bucketId: string;
  styles: {
    viewBtnActive: string;
  };
}

const data: PageData = JSON.parse(document.getElementById("pageData")!.textContent!);

// WebSocket for live updates
(function () {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(proto + "//" + location.host + "/ws/bucket/" + data.bucketId);
  ws.onmessage = function (e) {
    const list = document.getElementById("file-list");
    if (list) {
      list.replaceChildren();
      const template = document.createElement("template");
      template.innerHTML = e.data;
      list.appendChild(template.content);
    }
  };
  ws.onclose = function () {
    setTimeout(function () {
      location.reload();
    }, 3000);
  };
})();

// View toggle
function setView(view: string) {
  document.getElementById("file-view-list")!.style.display = view === "list" ? "" : "none";
  document.getElementById("file-view-grid")!.style.display = view === "grid" ? "" : "none";
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.classList.toggle(data.styles.viewBtnActive, (b as HTMLElement).dataset.view === view);
  });
  localStorage.setItem("cf4-view", view);
}

// Sorting
let _sortCol: string | null = null;
let _sortDir = "asc";
function sortFiles(col: string) {
  if (_sortCol === col) {
    _sortDir = _sortDir === "asc" ? "desc" : "asc";
  } else {
    _sortCol = col;
    _sortDir = "asc";
  }
  document.querySelectorAll("#file-table thead th span").forEach(function (s) {
    s.textContent = "";
  });
  const el = document.getElementById("sort-" + col);
  if (el) el.textContent = _sortDir === "asc" ? " \u2191" : " \u2193";
  const tbody = document.getElementById("file-list")!;
  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.sort(function (a, b) {
    const cells: Record<string, number> = { name: 1, size: 2, date: 3 };
    const idx = cells[col] || 1;
    const va = a.cells[idx]?.textContent?.trim() ?? "";
    const vb = b.cells[idx]?.textContent?.trim() ?? "";
    if (col === "size") {
      return _sortDir === "asc" ? parseSize(va) - parseSize(vb) : parseSize(vb) - parseSize(va);
    }
    if (col === "date") {
      return _sortDir === "asc" ? parseAge(va) - parseAge(vb) : parseAge(vb) - parseAge(va);
    }
    const cmp = va.localeCompare(vb);
    return _sortDir === "asc" ? cmp : -cmp;
  });
  rows.forEach(function (r) {
    tbody.appendChild(r);
  });
  applyGridSort();
}

function parseSize(s: string): number {
  const m = s.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/);
  if (!m) return 0;
  const u: Record<string, number> = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 };
  return parseFloat(m[1]) * (u[m[2]] || 1);
}

function parseAge(s: string): number {
  if (s === "just now") return 0;
  const m = s.match(/(\d+)(m|h|d|mo|y)/);
  if (!m) return 0;
  const u: Record<string, number> = { m: 60, h: 3600, d: 86400, mo: 2592000, y: 31536000 };
  return parseInt(m[1]) * (u[m[2]] || 1);
}

function filterFiles(q: string) {
  q = q.toLowerCase();
  document.querySelectorAll("#file-list tr").forEach(function (row) {
    (row as HTMLElement).style.display = (row as HTMLTableRowElement).cells[1]?.textContent?.toLowerCase().includes(q) ? "" : "none";
  });
  document.querySelectorAll("#file-grid [data-grid-item]").forEach(function (item) {
    const nameEl = (item as HTMLElement).querySelector("[data-grid-name]");
    if (nameEl) {
      (item as HTMLElement).style.display = nameEl.textContent?.toLowerCase().includes(q) ? "" : "none";
    }
  });
}

function applyGridSort() {
  const grid = document.getElementById("file-grid");
  if (!grid) return;
  const items = Array.from(grid.children) as HTMLElement[];
  const order = Array.from(document.getElementById("file-list")!.querySelectorAll("tr")).map(function (r) {
    return (r as HTMLTableRowElement).cells[1]?.textContent?.trim();
  });
  items.sort(function (a, b) {
    const aName = a.querySelector("[data-grid-name]")?.textContent ?? "";
    const bName = b.querySelector("[data-grid-name]")?.textContent ?? "";
    return order.indexOf(aName) - order.indexOf(bName);
  });
  items.forEach(function (it) {
    grid.appendChild(it);
  });
}

// Restore view preference
const saved = localStorage.getItem("cf4-view");
if (saved === "grid") setView("grid");

// Expose to onclick handlers in template HTML
(window as any).setView = setView;
(window as any).sortFiles = sortFiles;
(window as any).filterFiles = filterFiles;
