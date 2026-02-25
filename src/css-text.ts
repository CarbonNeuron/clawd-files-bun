import { existsSync } from "node:fs";
import * as log from "./logger";

let prebuiltStylesheet: string | null = null;

/**
 * Load pre-built combined CSS stylesheet (for compiled binary).
 * In dev mode, CSS is inlined per-page via module cssText. In production,
 * the CSS is inlined into each page's <style> tag to avoid an extra round trip.
 */
export async function loadPrebuiltCss(): Promise<void> {
  const path = "./src/generated/styles.css";
  if (existsSync(path)) {
    prebuiltStylesheet = await Bun.file(path).text();
    log.info(`CSS stylesheet loaded (pre-built): ${prebuiltStylesheet.length} bytes`);
  }
}

/** Whether we're using a pre-built stylesheet (production) */
export function hasPrebuiltStylesheet(): boolean {
  return prebuiltStylesheet !== null;
}

/** Get the raw pre-built CSS text for inlining */
export function getPrebuiltCss(): string {
  return prebuiltStylesheet ?? "";
}


/** Return cssText from the module in dev, or empty in production (inlined via getPrebuiltCss) */
export function cssText(moduleStyles: { cssText?: string }, _name: string): string {
  // Production: CSS inlined from pre-built stylesheet, per-module CSS not needed
  if (prebuiltStylesheet) return "";
  // Dev mode: inline from module
  if (typeof moduleStyles.cssText === "string" && moduleStyles.cssText.length > 0) {
    return moduleStyles.cssText;
  }
  return "";
}
