/**
 * Build script — pre-builds client JS, then compiles the server into a single binary.
 * CSS is handled by bun-css-modules at compile time (preload plugin).
 * Usage: bun run scripts/build.ts
 */
import * as log from "../src/logger";
import { mkdir } from "node:fs/promises";

// 1. Pre-build client JS bundles (compiled binary can't run Bun.build at runtime)
log.info("Building client JS...");
const clientResult = await Bun.build({
  entrypoints: [
    "./src/client/upload.ts",
    "./src/client/bucket.ts",
    "./src/client/file.ts",
    "./src/client/admin.ts",
  ],
  minify: true,
});

if (!clientResult.success) {
  log.error("Client JS build failed:", clientResult.logs);
  process.exit(1);
}

const bundles: Record<string, string> = {};
for (const output of clientResult.outputs) {
  const name = output.path.split("/").pop()!.replace(/\.js$/, "");
  bundles[name] = await output.text();
}

await mkdir("./src/generated", { recursive: true });
await Bun.write("./src/generated/client-bundles.json", JSON.stringify(bundles));
log.info(`Client JS built: ${Object.keys(bundles).join(", ")}`);

// 2. Compile binary
log.info("Compiling binary...");
const proc = Bun.spawn(
  ["bun", "build", "--compile", "src/index.ts", "--outfile", "clawd-files"],
  { stdout: "inherit", stderr: "inherit" }
);
const code = await proc.exited;
if (code !== 0) {
  log.error(`Compile failed with exit code ${code}`);
  process.exit(code);
}

log.info("Build complete: ./clawd-files");
