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

// 2. Pre-build CSS module texts (compiled binary loses cssText from bun-css-modules)
log.info("Extracting CSS module texts...");
import baseStyles from "../src/styles/base.module.css";
import layoutStyles from "../src/styles/layout.module.css";
import homeStyles from "../src/styles/home.module.css";
import bucketStyles from "../src/styles/bucket.module.css";
import fileStyles from "../src/styles/file.module.css";
import renderStyles from "../src/styles/render.module.css";
import adminStyles from "../src/styles/admin.module.css";
import uploadStyles from "../src/styles/upload.module.css";

const cssTexts: Record<string, string> = {
  base: baseStyles.cssText,
  layout: layoutStyles.cssText,
  home: homeStyles.cssText,
  bucket: bucketStyles.cssText,
  file: fileStyles.cssText,
  render: renderStyles.cssText,
  admin: adminStyles.cssText,
  upload: uploadStyles.cssText,
};
await Bun.write("./src/generated/css-texts.json", JSON.stringify(cssTexts));
log.info(`CSS texts extracted: ${Object.keys(cssTexts).join(", ")}`);

// 3. Compile binary
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
