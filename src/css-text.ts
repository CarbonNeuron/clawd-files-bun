import { existsSync } from "node:fs";
import * as log from "./logger";

let prebuiltStylesheet: string | null = null;
let prebuiltEtag: string | null = null;

/**
 * Load pre-built combined CSS stylesheet (for compiled binary).
 * In dev mode, CSS is inlined per-page via module cssText. In production,
 * the bundler extracts all CSS to a single file with matching class hashes.
 */
export async function loadPrebuiltCss(): Promise<void> {
  const path = "./src/generated/styles.css";
  if (existsSync(path)) {
    prebuiltStylesheet = await Bun.file(path).text();
    prebuiltEtag = Bun.hash(prebuiltStylesheet).toString(16);
    log.info(`CSS stylesheet loaded (pre-built): ${prebuiltStylesheet.length} bytes`);
  }
}

/** Whether we're using a pre-built stylesheet (production) */
export function hasPrebuiltStylesheet(): boolean {
  return prebuiltStylesheet !== null;
}

/** Get the pre-built stylesheet response for /styles.css route */
export function getStylesheetResponse(req: Request): Response {
  if (!prebuiltStylesheet) {
    return new Response("Not Found", { status: 404 });
  }
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === prebuiltEtag) {
    return new Response(null, { status: 304 });
  }
  return new Response(prebuiltStylesheet, {
    headers: {
      "Content-Type": "text/css",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: prebuiltEtag!,
    },
  });
}

/** Return cssText from the module in dev, or empty in production (served via /styles.css) */
export function cssText(moduleStyles: { cssText?: string }, _name: string): string {
  // Production: CSS served via <link> to /styles.css, no inline needed
  if (prebuiltStylesheet) return "";
  // Dev mode: inline from module
  if (typeof moduleStyles.cssText === "string" && moduleStyles.cssText.length > 0) {
    return moduleStyles.cssText;
  }
  return "";
}
