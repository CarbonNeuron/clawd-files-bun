/**
 * Build script — compiles the server into a single binary.
 * CSS is handled by bun-css-modules at runtime (no pre-bundling needed).
 * Usage: bun run scripts/build.ts
 */
import * as log from "../src/logger";

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
