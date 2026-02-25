/**
 * Build script — pre-bundles CSS, then compiles the server into a single binary.
 * Usage: bun run scripts/build.ts
 */
import * as log from "../src/logger";

// 1. Bundle CSS
log.info("Bundling render CSS...");
const renderCss = await Bun.build({
  entrypoints: ["./src/render/styles/index.css"],
  minify: true,
});
await Bun.write("./src/static/render.css", renderCss.outputs[0]);

log.info("Bundling site CSS...");
const siteCss = await Bun.build({
  entrypoints: ["./src/render/styles/site.css"],
  minify: true,
});
await Bun.write("./src/static/site.css", siteCss.outputs[0]);

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
