import { registerRenderer } from "./registry";

function sanitizeSvg(svg: string): string {
  // Remove <script> tags and their content (including self-closing)
  let sanitized = svg.replace(/<script[\s\S]*?(<\/script>|\/>)/gi, "");
  // Remove <foreignObject> tags (can embed arbitrary HTML)
  sanitized = sanitized.replace(/<foreignObject[\s\S]*?(<\/foreignObject>|\/>)/gi, "");
  // Remove on* event attributes
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // Remove javascript: URLs in any attribute
  sanitized = sanitized.replace(/javascript\s*:/gi, "removed:");
  // Remove data: URLs in href/xlink:href (potential XSS vector)
  sanitized = sanitized.replace(/((?:xlink:)?href\s*=\s*["'])data:/gi, "$1removed:");
  // Remove <animate>/<set> elements that can modify href attributes
  sanitized = sanitized.replace(/<(?:animate|set)\s[^>]*attributeName\s*=\s*["'](?:href|xlink:href)["'][^>]*\/?>/gi, "");
  return sanitized;
}

async function svgRenderer(content: Buffer): Promise<string> {
  const svg = content.toString("utf-8");
  const sanitized = sanitizeSvg(svg);
  // Render in sandboxed iframe to prevent any remaining XSS vectors
  const encoded = Buffer.from(sanitized).toString("base64");
  return `<div class="lumen-svg"><iframe sandbox="" srcdoc="${Bun.escapeHTML(sanitized)}" style="border:none;width:100%;min-height:400px;background:transparent;"></iframe></div>`;
}

registerRenderer(["image/svg+xml"], [".svg"], svgRenderer);

export { sanitizeSvg };
