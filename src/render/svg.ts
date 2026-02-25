import { registerRenderer } from "./registry";

function sanitizeSvg(svg: string): string {
  // Remove <script> tags and their content
  let sanitized = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Remove on* event attributes
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, "removed:");
  // Remove data: URLs in href (potential XSS vector)
  sanitized = sanitized.replace(/(href\s*=\s*["'])data:/gi, "$1removed:");
  return sanitized;
}

async function svgRenderer(content: Buffer): Promise<string> {
  const svg = content.toString("utf-8");
  const sanitized = sanitizeSvg(svg);
  return `<div class="lumen-svg">${sanitized}</div>`;
}

registerRenderer(["image/svg+xml"], [".svg"], svgRenderer);

export { sanitizeSvg };
