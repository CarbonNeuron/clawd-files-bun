import { layout } from "./layout.tsx";

function FeatureCard({ title, desc }: { title: string; desc: string; children?: unknown }) {
  return (
    <div class="card">
      <h3>{title}</h3>
      <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">{desc}</p>
    </div>
  );
}

export function homePage(): string {
  const content = (
    <>
      <div class="hero">
        <h1><span>Clawd</span>Files</h1>
        <p>Fast file hosting with built-in rendering, versioning, and an API designed for humans and machines alike.</p>
      </div>
      <div class="features">
        <FeatureCard title="Built-in Previews" desc="Code highlighting (Shiki), Markdown, CSV tables, JSON trees, SVG, images, PDFs — all rendered server-side." />
        <FeatureCard title="Version History" desc="Re-upload files to create new versions. Old versions are archived and accessible via the API." />
        <FeatureCard title="Share Instantly" desc="Every file gets a short URL. Share with curl -LJO or send a browser-friendly link." />
        <FeatureCard title="ZIP Downloads" desc="Download entire buckets as streaming ZIP archives. Perfect for bulk sharing." />
        <FeatureCard title="Upload Links" desc="Generate pre-signed URLs for drag-and-drop uploads. No API key needed." />
        <FeatureCard title="LLM-Friendly" desc="Plain text summaries, OpenAPI spec, and llms.txt — built for AI agents and integrations." />
      </div>
    </>
  );

  return layout({ title: "Home", content });
}
