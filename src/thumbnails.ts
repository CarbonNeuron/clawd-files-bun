import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { filesDir } from "./config";
import * as log from "./logger";

const THUMB_SIZE = 200;
const THUMB_QUALITY = 70;

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"]);

let _sharp: typeof import("sharp").default | null | false = null;

async function getSharp() {
  if (_sharp === false) return null; // Already tried and failed
  if (_sharp) return _sharp;
  try {
    _sharp = (await import("sharp")).default;
    return _sharp;
  } catch {
    log.warn("sharp not available — thumbnails disabled");
    _sharp = false;
    return null;
  }
}

export function isImageFile(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function thumbPath(bucketId: string, filePath: string): string {
  return join(filesDir, bucketId, ".thumbs", filePath + ".webp");
}

function sourcePath(bucketId: string, filePath: string): string {
  return join(filesDir, bucketId, filePath);
}

export async function getThumbnail(bucketId: string, filePath: string): Promise<Buffer | null> {
  const tp = thumbPath(bucketId, filePath);

  // Return cached thumbnail
  if (existsSync(tp)) {
    const file = Bun.file(tp);
    return Buffer.from(await file.arrayBuffer());
  }

  const sharp = await getSharp();
  if (!sharp) return null;

  // Generate from source
  const sp = sourcePath(bucketId, filePath);
  if (!existsSync(sp)) return null;

  try {
    const thumb = await sharp(sp)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();

    // Cache it
    await mkdir(dirname(tp), { recursive: true });
    await Bun.write(tp, thumb);

    return thumb;
  } catch {
    return null;
  }
}
