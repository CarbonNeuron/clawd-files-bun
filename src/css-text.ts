import { existsSync } from "node:fs";
import * as log from "./logger";

let prebuiltCss: Record<string, string> | null = null;

export async function loadPrebuiltCss(): Promise<void> {
  const path = "./src/generated/css-texts.json";
  if (existsSync(path)) {
    prebuiltCss = JSON.parse(await Bun.file(path).text());
    log.info("CSS texts loaded (pre-built)");
  }
}

/** Return cssText from the module in dev, or from pre-built cache in production */
export function cssText(moduleStyles: { cssText?: string }, name: string): string {
  if (typeof moduleStyles.cssText === "string" && moduleStyles.cssText.length > 0) {
    return moduleStyles.cssText;
  }
  return prebuiltCss?.[name] ?? "";
}
