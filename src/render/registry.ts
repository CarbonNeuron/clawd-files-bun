export type RenderContext = {
  bucketId?: string;
  baseUrl?: string;
};

export type Renderer = (
  content: Buffer,
  filename: string,
  context?: RenderContext
) => Promise<string>;

type RendererEntry = {
  mimeTypes: string[];
  extensions: string[];
  renderer: Renderer;
};

const renderers: RendererEntry[] = [];

export function registerRenderer(
  mimeTypes: string[],
  extensions: string[],
  renderer: Renderer
) {
  renderers.push({ mimeTypes, extensions, renderer });
}

export function getRenderer(
  filename: string,
  mimeType: string
): Renderer | null {
  // 1. Exact MIME match
  for (const entry of renderers) {
    if (entry.mimeTypes.includes(mimeType)) return entry.renderer;
  }

  // 2. MIME prefix match (e.g. "text/" matches "text/plain")
  for (const entry of renderers) {
    for (const mt of entry.mimeTypes) {
      if (mt.endsWith("/*") && mimeType.startsWith(mt.slice(0, -1))) {
        return entry.renderer;
      }
    }
  }

  // 3. Extension match
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  for (const entry of renderers) {
    if (entry.extensions.includes(ext)) return entry.renderer;
  }

  // 4. Exact filename match (Dockerfile, Makefile, etc.)
  const basename = filename.split("/").pop() ?? filename;
  for (const entry of renderers) {
    if (entry.extensions.includes(basename)) return entry.renderer;
  }

  return null;
}

export async function render(
  content: Buffer,
  filename: string,
  mimeType: string,
  context?: RenderContext
): Promise<string> {
  const renderer = getRenderer(filename, mimeType);
  if (renderer) {
    return renderer(content, filename, context);
  }

  // Fallback: if it looks like text, try rendering as plain code
  if (mimeType.startsWith("text/") || mimeType === "application/octet-stream") {
    if (looksLikeText(content)) {
      const { codeRenderer } = await import("./code");
      return codeRenderer(content, filename, context);
    }
  }

  return `<div class="lumen-no-preview"><p>No preview available for this file type (${Bun.escapeHTML(mimeType)})</p></div>`;
}

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    // Allow printable ASCII, tabs, newlines, carriage returns, and UTF-8 continuation bytes
    if (b === 0) return false;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) return false;
  }
  return true;
}
