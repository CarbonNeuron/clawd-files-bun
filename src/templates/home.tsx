import { layout } from "./layout.tsx";
import { cssText } from "../css-text";
import layoutStyles from "../styles/layout.module.css";
import homeStyles from "../styles/home.module.css";

function FeatureCard({ title, desc }: { title: string; desc: string; children?: unknown }) {
  return (
    <div class={layoutStyles.card}>
      <h3 class={homeStyles.featureTitle}>{title}</h3>
      <p class={homeStyles.featureDesc}>{desc}</p>
    </div>
  );
}

export function homePage(): string {
  const content = (
    <>
      <div class={homeStyles.hero}>
        <h1 class={homeStyles.heroTitle}><span class={homeStyles.heroAccent}>Clawd</span>Files</h1>
        <p class={homeStyles.heroDesc}>Fast file hosting with built-in rendering, versioning, and an API designed for humans and machines alike.</p>
      </div>
      <div class={homeStyles.features}>
        <FeatureCard title="Built-in Previews" desc="Code highlighting (Shiki), Markdown, CSV tables, JSON trees, SVG, images, PDFs — all rendered server-side." />
        <FeatureCard title="Version History" desc="Re-upload files to create new versions. Old versions are archived and accessible via the API." />
        <FeatureCard title="Share Instantly" desc="Every file gets a short URL. Share with curl -LJO or send a browser-friendly link." />
        <FeatureCard title="ZIP Downloads" desc="Download entire buckets as streaming ZIP archives. Perfect for bulk sharing." />
        <FeatureCard title="Upload Links" desc="Generate pre-signed URLs for drag-and-drop uploads. No API key needed." />
        <FeatureCard title="LLM-Friendly" desc="Plain text summaries, OpenAPI spec, and llms.txt — built for AI agents and integrations." />
      </div>
    </>
  );

  return layout({ title: "Home", content, head: `<style>${cssText(homeStyles, "home")}</style>` });
}
