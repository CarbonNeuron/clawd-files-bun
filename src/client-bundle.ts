import { existsSync } from "node:fs";
import * as log from "./logger";

const clientJsCache = new Map<string, string>();

export async function buildClientJs(): Promise<void> {
  // Try pre-built bundles first (for compiled binary / Docker)
  const prebuilt = "./src/generated/client-bundles.json";
  if (existsSync(prebuilt)) {
    const bundles: Record<string, string> = JSON.parse(await Bun.file(prebuilt).text());
    for (const [name, js] of Object.entries(bundles)) {
      clientJsCache.set(name, js);
    }
    log.info(`Client JS loaded (pre-built): ${[...clientJsCache.keys()].join(", ")}`);
    return;
  }

  // Dev mode: build from source
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
