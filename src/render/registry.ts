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
  const mimePrefix = mimeType.split("/")[0] + "/";
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

  return null;
}

export async function render(
  content: Buffer,
  filename: string,
  mimeType: string,
  context?: RenderContext
): Promise<string> {
  const renderer = getRenderer(filename, mimeType);
  if (!renderer) {
    return `<div class="lumen-no-preview"><p>No preview available for this file type (${Bun.escapeHTML(mimeType)})</p></div>`;
  }
  return renderer(content, filename, context);
}
