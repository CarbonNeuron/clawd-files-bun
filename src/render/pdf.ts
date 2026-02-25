import { registerRenderer } from "./registry";
import type { RenderContext } from "./registry";

async function pdfRenderer(
  _content: Buffer,
  filename: string,
  context?: RenderContext
): Promise<string> {
  const bucketId = context?.bucketId ?? "";
  const rawUrl = `/raw/${bucketId}/${filename}`;
  const name = Bun.escapeHTML(filename);

  return `<div class="lumen-pdf">
  <object data="${rawUrl}" type="application/pdf" width="100%" height="80vh">
    <p>PDF preview not available in this browser.</p>
  </object>
  <div class="pdf-fallback">
    <a href="${rawUrl}" download="${name}">Download ${name}</a>
  </div>
</div>`;
}

registerRenderer(["application/pdf"], [".pdf"], pdfRenderer);
