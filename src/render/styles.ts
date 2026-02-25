let cachedCss: string | null = null;
let cachedEtag: string | null = null;

export async function buildStyles(): Promise<{ css: string; etag: string }> {
  if (cachedCss && cachedEtag) return { css: cachedCss, etag: cachedEtag };

  const result = await Bun.build({
    entrypoints: ["./src/render/styles/index.css"],
    minify: true,
  });

  if (!result.success) {
    console.error("CSS build failed:", result.logs);
    throw new Error("CSS build failed");
  }

  cachedCss = await result.outputs[0].text();
  cachedEtag = Bun.hash(cachedCss).toString(16);
  return { css: cachedCss, etag: cachedEtag };
}

export function getCachedStyles(): { css: string; etag: string } | null {
  if (cachedCss && cachedEtag) return { css: cachedCss, etag: cachedEtag };
  return null;
}
