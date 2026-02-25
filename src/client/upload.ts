interface PageData {
  token: string;
  baseUrl: string;
  styles: Record<string, string>;
}

const data: PageData = JSON.parse(document.getElementById("pageData")!.textContent!);
const s = data.styles;

const dropZone = document.getElementById("dropZone")!;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const browseBtn = document.getElementById("browseBtn")!;
const fileListEl = document.getElementById("fileList")!;

// Browse button opens file picker (stop propagation to avoid dropZone click)
browseBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  fileInput.click();
});
dropZone.addEventListener("click", function () {
  fileInput.click();
});

// Drag events
dropZone.addEventListener("dragover", function (e) {
  e.preventDefault();
  dropZone.classList.add(s.dropZoneActive);
});
dropZone.addEventListener("dragleave", function () {
  dropZone.classList.remove(s.dropZoneActive);
});
dropZone.addEventListener("drop", function (e) {
  e.preventDefault();
  dropZone.classList.remove(s.dropZoneActive);
  if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", function () {
  if (fileInput.files?.length) uploadFiles(fileInput.files);
  fileInput.value = "";
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function uploadFiles(files: FileList) {
  for (const file of Array.from(files)) {
    uploadSingleFile(file);
  }
}

function uploadSingleFile(file: File) {
  // Build file item using safe DOM APIs
  const item = document.createElement("div");
  item.className = s.fileItem;

  const header = document.createElement("div");
  header.className = s.fileHeader;

  const nameEl = document.createElement("span");
  nameEl.className = s.fileName;
  nameEl.textContent = file.name;

  const sizeEl = document.createElement("span");
  sizeEl.className = s.fileSize;
  sizeEl.textContent = formatBytes(file.size);

  const statusEl = document.createElement("span");
  statusEl.className = s.fileStatus + " " + s.statusPending;
  statusEl.textContent = "Pending";

  header.append(nameEl, sizeEl, statusEl);

  const track = document.createElement("div");
  track.className = s.progressTrack;
  const bar = document.createElement("div");
  bar.className = s.progressBar;
  track.appendChild(bar);

  item.append(header, track);
  fileListEl.appendChild(item);

  // XHR upload
  const fd = new FormData();
  fd.append("files", file);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload/" + data.token);

  statusEl.textContent = "0%";
  statusEl.className = s.fileStatus + " " + s.statusUploading;

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      bar.style.width = pct + "%";
      statusEl.textContent = pct + "%";
    }
  };

  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      const resp = JSON.parse(xhr.responseText);
      statusEl.textContent = "Complete";
      statusEl.className = s.fileStatus + " " + s.statusComplete;
      bar.style.width = "100%";

      // Show short URL if available
      if (resp.uploaded && resp.uploaded[0] && resp.uploaded[0].shortCode) {
        const shortUrl = data.baseUrl + "/s/" + resp.uploaded[0].shortCode;
        const urlRow = document.createElement("div");
        urlRow.className = s.fileUrl;

        const link = document.createElement("a");
        link.href = shortUrl;
        link.className = s.fileUrlText;
        link.target = "_blank";
        link.textContent = shortUrl;

        const copyBtn = document.createElement("button");
        copyBtn.className = s.copyBtn;
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", function () {
          navigator.clipboard.writeText(shortUrl);
          copyBtn.textContent = "Copied!";
          setTimeout(function () {
            copyBtn.textContent = "Copy";
          }, 1500);
        });

        urlRow.append(link, copyBtn);
        item.appendChild(urlRow);
      }
    } else {
      var errMsg = "Upload failed";
      try {
        errMsg = JSON.parse(xhr.responseText).error || errMsg;
      } catch {}
      statusEl.textContent = "Error";
      statusEl.className = s.fileStatus + " " + s.statusError;
      const errEl = document.createElement("div");
      errEl.className = s.errorMsg;
      errEl.textContent = errMsg;
      item.appendChild(errEl);
    }
  };

  xhr.onerror = function () {
    statusEl.textContent = "Error";
    statusEl.className = s.fileStatus + " " + s.statusError;
    const errEl = document.createElement("div");
    errEl.className = s.errorMsg;
    errEl.textContent = "Network error";
    item.appendChild(errEl);
  };

  xhr.send(fd);
}
