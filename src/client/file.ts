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
    const isSource = action === "source";
    const url =
      "/" + data.bucketId + "/" + encodeURIComponent(data.filePath) +
      (isSource ? "?view=raw&fragment=1" : "?fragment=1");

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
