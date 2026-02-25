import { registerRenderer } from "./registry";
import { encodeFilePath } from "../utils";
import type { RenderContext } from "./registry";

async function imageRenderer(
  _content: Buffer,
  filename: string,
  context?: RenderContext
): Promise<string> {
  const bucketId = context?.bucketId ?? "";
  const rawUrl = `/raw/${bucketId}/${encodeFilePath(filename)}`;
  const alt = Bun.escapeHTML(filename);
  return `<div class="lumen-image"><img src="${rawUrl}" alt="${alt}" loading="lazy"></div>`;
}

registerRenderer(
  ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp"],
  [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico"],
  imageRenderer
);
