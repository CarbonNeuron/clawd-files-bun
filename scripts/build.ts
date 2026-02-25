/**
 * Build script — pre-builds client JS, extracts CSS from bundler, compiles binary.
 * Usage: bun run scripts/build.ts
 */
import * as log from "../src/logger";
import { mkdir } from "node:fs/promises";

await mkdir("./src/generated", { recursive: true });

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

await Bun.write("./src/generated/client-bundles.json", JSON.stringify(bundles));
log.info(`Client JS built: ${Object.keys(bundles).join(", ")}`);

// 2. Bundle the server to extract CSS module output
// Bun.build() uses the same CSS module hashing as bun build --compile,
// so the CSS class names will match the compiled binary's class mappings.
log.info("Extracting CSS from bundler...");
const cssBundle = await Bun.build({
  entrypoints: ["./src/index.ts"],
  target: "bun",
  minify: true,
});

if (!cssBundle.success) {
  log.error("CSS extraction build failed:", cssBundle.logs);
  process.exit(1);
}

// Find the CSS output artifact
const cssOutput = cssBundle.outputs.find(o => o.path.endsWith(".css"));
if (cssOutput) {
  const css = await cssOutput.text();
  await Bun.write("./src/generated/styles.css", css);
  log.info(`CSS extracted: ${css.length} bytes`);
} else {
  log.warn("No CSS output from bundler — check CSS module imports");
  await Bun.write("./src/generated/styles.css", "");
}

// 3. Compile binary with bytecode
log.info("Compiling binary...");
const proc = Bun.spawn(
  ["bun", "build", "--compile", "--bytecode", "src/index.ts", "--outfile", "clawd-files"],
  { stdout: "inherit", stderr: "inherit" }
);
const code = await proc.exited;
if (code !== 0) {
  log.error(`Compile failed with exit code ${code}`);
  process.exit(code);
}

log.info("Build complete: ./clawd-files");
