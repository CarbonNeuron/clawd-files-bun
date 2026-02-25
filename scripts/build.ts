/**
 * Build script — pre-bundles CSS, then compiles the server into a single binary.
 * Usage: bun run scripts/build.ts
 */
import * as log from "../src/logger";

// 1. Bundle all CSS (index.css @imports site.css, Bun resolves everything)
log.info("Bundling CSS...");
const css = await Bun.build({
  entrypoints: ["./src/render/styles/index.css"],
  minify: true,
});
await Bun.write("./src/static/styles.css", css.outputs[0]);
log.info(`CSS bundled: ${(await css.outputs[0].arrayBuffer()).byteLength} bytes`);

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
