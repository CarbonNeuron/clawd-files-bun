import { layout } from "./layout";

export function homePage(): string {
  return layout({
    title: "Home",
    content: `
    <div class="hero">
      <h1><span>Clawd</span>Files</h1>
      <p>Fast file hosting with built-in rendering, versioning, and an API designed for humans and machines alike.</p>
    </div>
    <div class="features">
      <div class="card">
        <h3>Built-in Previews</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Code highlighting (Shiki), Markdown, CSV tables, JSON trees, SVG, images, PDFs — all rendered server-side.</p>
      </div>
      <div class="card">
        <h3>Version History</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Re-upload files to create new versions. Old versions are archived and accessible via the API.</p>
      </div>
      <div class="card">
        <h3>Share Instantly</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Every file gets a short URL. Share with <code>curl -LJO</code> or send a browser-friendly link.</p>
      </div>
      <div class="card">
        <h3>ZIP Downloads</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Download entire buckets as streaming ZIP archives. Perfect for bulk sharing.</p>
      </div>
      <div class="card">
        <h3>Upload Links</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Generate pre-signed URLs for drag-and-drop uploads. No API key needed.</p>
      </div>
      <div class="card">
        <h3>LLM-Friendly</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Plain text summaries, OpenAPI spec, and llms.txt — built for AI agents and integrations.</p>
      </div>
    </div>
    `,
  });
}
