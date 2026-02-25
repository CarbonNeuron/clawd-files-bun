import { existsSync } from "node:fs";

let cachedCss: string | null = null;
let cachedEtag: string | null = null;

export async function buildStyles(): Promise<{ css: string; etag: string }> {
  if (cachedCss && cachedEtag) return { css: cachedCss, etag: cachedEtag };

  // Try pre-built CSS first (for compiled binary)
  const prebuilt = "./src/static/render.css";
  if (existsSync(prebuilt)) {
    cachedCss = await Bun.file(prebuilt).text();
  } else {
    // Build at runtime (dev mode)
    const result = await Bun.build({
      entrypoints: ["./src/render/styles/index.css"],
      minify: true,
    });

    if (!result.success) {
      console.error("CSS build failed:", result.logs);
      throw new Error("CSS build failed");
    }

    cachedCss = await result.outputs[0].text();
  }

  cachedEtag = Bun.hash(cachedCss).toString(16);
  return { css: cachedCss, etag: cachedEtag };
}

export async function buildSiteStyles(): Promise<{ css: string; etag: string }> {
  // Try pre-built CSS first
  const prebuilt = "./src/static/site.css";
  if (existsSync(prebuilt)) {
    const css = await Bun.file(prebuilt).text();
    return { css, etag: Bun.hash(css).toString(16) };
  }

  // Build at runtime
  const result = await Bun.build({
    entrypoints: ["./src/render/styles/site.css"],
    minify: true,
  });

  if (!result.success) {
    console.error("Site CSS build failed:", result.logs);
    throw new Error("Site CSS build failed");
  }

  const css = await result.outputs[0].text();
  return { css, etag: Bun.hash(css).toString(16) };
}
