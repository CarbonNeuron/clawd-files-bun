interface PageData {
  bucketId: string;
  filePath: string;
  styles: {
    previewBtnActive: string;
  };
}

const data: PageData = JSON.parse(document.getElementById("pageData")!.textContent!);

// WebSocket for live updates
(function () {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(
    proto + "//" + location.host + "/ws/file/" + data.bucketId + "/" + encodeURIComponent(data.filePath)
  );
  ws.onmessage = function (e) {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "updated") {
        fetch("/" + data.bucketId + "/" + encodeURIComponent(data.filePath) + "?fragment=1")
          .then(function (r) { return r.text(); })
          .then(function (html) {
            const el = document.getElementById("preview-body");
            if (el) {
              el.replaceChildren();
              const template = document.createElement("template");
              template.innerHTML = html;
              el.appendChild(template.content);
            }
          });
      }
    } catch {}
  };
  ws.onclose = function () {
    setTimeout(function () { location.reload(); }, 3000);
  };
})();

// Source/Rendered toggle (replaces HTMX)
document.querySelectorAll("[data-action]").forEach(function (btn) {
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    const action = (btn as HTMLElement).dataset.action;
    var viewParam = action === "source" ? "?view=raw&fragment=1"
      : action === "code" ? "?view=code&fragment=1"
      : "?fragment=1";
    const url =
      "/" + data.bucketId + "/" + encodeURIComponent(data.filePath) + viewParam;

    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        const el = document.getElementById("preview-body");
        if (el) {
          el.replaceChildren();
          const template = document.createElement("template");
          template.innerHTML = html;
          el.appendChild(template.content);
        }
      });

    // Update active state
    document.querySelectorAll("[data-action]").forEach(function (b) {
      b.classList.toggle(data.styles.previewBtnActive, b === btn);
    });
  });
});

// CSV table viewer interactivity
(function () {
  var previewBody = document.getElementById("preview-body");
  if (!previewBody) return;

  function fetchTableContent(url: string): void {
    var target = document.getElementById("csv-table-body");
    if (!target) return;
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var el = document.getElementById("csv-table-body");
        if (el) el.innerHTML = html;
      });
  }

  // Auto-load: fetch initial table content for [data-csv-autoload] elements
  function initAutoload(): void {
    var el = previewBody!.querySelector("[data-csv-autoload]") as HTMLElement | null;
    if (el && el.dataset.csvAutoload) {
      fetchTableContent(el.dataset.csvAutoload);
    }
  }

  // Run autoload on initial page load
  initAutoload();

  // Observe #preview-body for content changes (WebSocket updates, source/rendered toggle)
  // so we can re-trigger autoload when new CSV content appears
  var observer = new MutationObserver(function () {
    initAutoload();
  });
  observer.observe(previewBody, { childList: true });

  // Event delegation for pagination and sort clicks
  previewBody.addEventListener("click", function (e) {
    var target = e.target as HTMLElement;

    // Pagination links
    var pageLink = target.closest("[data-csv-page]") as HTMLElement | null;
    if (pageLink && pageLink.dataset.csvPage) {
      e.preventDefault();
      fetchTableContent(pageLink.dataset.csvPage);
      return;
    }

    // Sort headers
    var sortHeader = target.closest("[data-csv-sort]") as HTMLElement | null;
    if (sortHeader && sortHeader.dataset.csvSort) {
      e.preventDefault();
      fetchTableContent(sortHeader.dataset.csvSort);
      return;
    }
  });

  // Debounced filter input
  var filterTimer: ReturnType<typeof setTimeout> | null = null;
  previewBody.addEventListener("input", function (e) {
    var target = e.target as HTMLElement;
    if (!target.hasAttribute("data-csv-filter")) return;

    var input = target as HTMLInputElement;
    var viewerUrl = input.dataset.csvViewer;
    if (!viewerUrl) return;

    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = setTimeout(function () {
      var filterValue = input.value;
      var url = viewerUrl + (filterValue ? "?filter=" + encodeURIComponent(filterValue) : "");
      fetchTableContent(url);
    }, 300);
  });
})();
