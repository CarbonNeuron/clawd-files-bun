import * as log from "./logger";

const clientJsCache = new Map<string, string>();

export async function buildClientJs(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [
      "./src/client/upload.ts",
      "./src/client/bucket.ts",
      "./src/client/file.ts",
      "./src/client/admin.ts",
    ],
    minify: true,
  });

  if (!result.success) {
    log.error("Client JS build failed:", result.logs);
    throw new Error("Client JS build failed");
  }

  for (const output of result.outputs) {
    const name = output.path.split("/").pop()!.replace(/\.js$/, "");
    clientJsCache.set(name, await output.text());
  }

  log.info(`Client JS built: ${[...clientJsCache.keys()].join(", ")}`);
}

export function getClientJs(name: string): string {
  const js = clientJsCache.get(name);
  if (!js) throw new Error(`No client JS bundle for "${name}"`);
  return js;
}
