import { addRoute } from "../router";
import { getDb, getBucket, getFile, listFiles, getFileVersions } from "../db";
import { readFile } from "../storage";
import { render } from "../render/index";
import { config } from "../config";
import { wantsJson, getMimeType, encodeFilePath } from "../utils";
import { homePage } from "../templates/home";
import { bucketPage } from "../templates/bucket";
import { filePage } from "../templates/file";

export function registerPageRoutes() {
  // Home page
  addRoute("GET", "/", async () => {
    return new Response(homePage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  // Bucket page (HTML) or bucket JSON
  addRoute("GET", "/:bucketId", async (req, params) => {
    const db = getDb();
    const bucket = getBucket(db, params.bucketId);
    if (!bucket) {
      return new Response("Not Found", { status: 404 });
    }

    const files = listFiles(db, params.bucketId);

    if (wantsJson(req)) {
      return Response.json({ bucket, files });
    }

    // Render README.md if present
    let readmeHtml: string | undefined;
    const readmeFile = files.find((f) => f.path.toLowerCase() === "readme.md");
    if (readmeFile) {
      const bunFile = readFile(params.bucketId, readmeFile.path);
      if (await bunFile.exists()) {
        const content = Buffer.from(await bunFile.arrayBuffer());
        readmeHtml = await render(content, readmeFile.path, "text/markdown", { bucketId: params.bucketId });
      }
    }

    return new Response(bucketPage(bucket, files, readmeHtml), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  // File page (HTML with rendered preview) or file JSON
  addRoute("GET", "/:bucketId/:path+", async (req, params) => {
    const db = getDb();
    const bucket = getBucket(db, params.bucketId);
    if (!bucket) {
      return new Response("Not Found", { status: 404 });
    }

    const file = getFile(db, params.bucketId, params.path);
    if (!file) {
      return new Response("Not Found", { status: 404 });
    }

    if (wantsJson(req)) {
      const versions = getFileVersions(db, file.id);
      return Response.json({ bucket, file, versions });
    }

    const url = new URL(req.url);
    const viewRaw = url.searchParams.get("view") === "raw";
    const isFragment = url.searchParams.get("fragment") === "1";

    const bunFile = readFile(params.bucketId, params.path);
    let renderedContent: string;

    if (await bunFile.exists()) {
      const content = Buffer.from(await bunFile.arrayBuffer());
      if (viewRaw) {
        // Show raw source with code highlighting
        const code = content.toString("utf-8");
        renderedContent = `<pre style="padding:16px;overflow-x:auto;font-size:13px;"><code>${Bun.escapeHTML(code)}</code></pre>`;
      } else if (content.length > config.maxRenderSize) {
        renderedContent = `<div class="lumen-no-preview"><p>File too large to preview (${(content.length / 1024 / 1024).toFixed(1)} MB). <a href="/raw/${bucket.id}/${encodeFilePath(file.path)}">Download raw file</a>.</p></div>`;
      } else {
        renderedContent = await render(content, file.path, file.mime_type, { bucketId: params.bucketId });
      }
    } else {
      renderedContent = `<div class="lumen-no-preview"><p>File not found on disk.</p></div>`;
    }

    // Return just the fragment for htmx requests
    if (isFragment) {
      return new Response(renderedContent, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const versions = getFileVersions(db, file.id);
    return new Response(filePage(bucket, file, renderedContent, versions), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
}
