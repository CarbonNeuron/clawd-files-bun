# JSX + CSS Modules + Client JS Bundling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor all HTML rendering to use JSX with bun-css-modules for per-page scoped CSS, per-page bundled client JS, remove HTMX, and redesign the upload page with a refreshed theme.

**Architecture:** Server-side JSX templates import `.module.css` files for scoped class names + cssText. Client JS lives in `src/client/*.ts`, bundled by `Bun.build()` at startup into a memory cache, and inlined into templates. Server data (class names, tokens, config) passes to client via `<script type="application/json" id="pageData">`.

**Tech Stack:** Bun, bun-css-modules (Lightning CSS), custom JSX-to-string runtime (existing), TypeScript

---

### Task 1: Install bun-css-modules and set up the plugin

**Files:**
- Create: `src/cssLoader.ts`
- Create: `src/css-modules.d.ts`
- Modify: `bunfig.toml`
- Modify: `tsconfig.json`

**Step 1: Install the dependency**

Run: `bun add -D bun-css-modules`
Expected: Package added to devDependencies

**Step 2: Create the CSS loader plugin**

Create `src/cssLoader.ts`:
```ts
import { plugin } from "bun";
import { moduleCssLoader } from "bun-css-modules";

plugin(moduleCssLoader());
```

**Step 3: Create TypeScript ambient declaration**

Create `src/css-modules.d.ts`:
```ts
declare module "*.module.css" {
  const styles: {
    cssText: string;
    [className: string]: string;
  };
  export default styles;
}
```

**Step 4: Update bunfig.toml**

Replace contents with:
```toml
preload = ["./src/cssLoader.ts"]

[test]
preload = ["./src/cssLoader.ts", "./test/preload.ts"]
```

Note: top-level `preload` for the server runtime, `[test].preload` includes both the CSS loader and test setup.

**Step 5: Update tsconfig.json**

Add `"./src/css-modules.d.ts"` to a new `"types"` array in compilerOptions, and ensure `"bun-types"` is there too:
```json
{
  "compilerOptions": {
    ...existing options...
    "types": ["bun-types", "./src/css-modules.d.ts"]
  }
}
```

**Step 6: Verify the plugin loads**

Run: `bun run src/index.ts`
Expected: Server starts without errors. The CSS loader is loaded but no `.module.css` files exist yet, so it's a no-op.

**Step 7: Commit**

```
feat: add bun-css-modules plugin infrastructure
```

---

### Task 2: Create base CSS module with refreshed theme

**Files:**
- Create: `src/styles/base.module.css`

**Step 1: Create the base module**

Create `src/styles/base.module.css` with:
- CSS reset (`*`, `body`, `a`, etc.)
- Refreshed CSS custom properties on `:root` (keep dark theme, modernize palette)
- Base typography with JetBrains Mono

Use `:global()` wrappers for the reset/variables since they need to be unscoped:

```css
:global(*) { box-sizing: border-box; margin: 0; padding: 0; }

:global(:root) {
  --bg-deep: #050809;
  --bg-card: #0c1015;
  --bg-surface: #131920;
  --bg-code: #161b22;
  --text: #e4e8ee;
  --text-muted: #8494a7;
  --text-dim: #5a6a7e;
  --accent: #22d3ee;
  --accent-hover: #06b6d4;
  --accent-glow: rgba(34, 211, 238, 0.08);
  --border: rgba(148, 163, 184, 0.08);
  --border-hover: rgba(148, 163, 184, 0.16);
  --success: #34d399;
  --error: #f87171;
  --warning: #fbbf24;
  --radius: 8px;
  --radius-sm: 6px;
  --radius-lg: 12px;
}

:global(body) {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  background: var(--bg-deep);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

:global(a) { color: var(--accent); text-decoration: none; }
:global(a:hover) { text-decoration: underline; }
```

Also add a scoped `.container` class:
```css
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
```

**Step 2: Verify import works**

Create a quick test — temporarily add to the bottom of `src/index.ts`:
```ts
import baseStyles from "./styles/base.module.css";
console.log("base cssText length:", baseStyles.cssText.length);
console.log("container class:", baseStyles.container);
```

Run: `bun run src/index.ts`
Expected: Prints the cssText length (non-zero) and a scoped class name like `base_container_xxxxx`. Then remove the test lines.

**Step 3: Commit**

```
feat: add base CSS module with refreshed theme variables
```

---

### Task 3: Create layout CSS module and refactor layout.tsx

**Files:**
- Create: `src/styles/layout.module.css`
- Modify: `src/templates/layout.tsx`

**Step 1: Create layout.module.css**

Extract nav, footer, breadcrumbs, card, badge, button, metadata, copy-cmd styles from `site.css` into `src/styles/layout.module.css`. These are shared layout components used across pages. Use scoped class names:

```css
/* Nav */
.nav { padding: 16px 0; border-bottom: 1px solid var(--border); margin-bottom: 32px; }
.navInner { display: flex; align-items: center; justify-content: space-between; }
.navLogo { font-size: 18px; font-weight: 700; color: var(--accent); text-decoration: none; }
.navLogoVersion { color: var(--text-muted); font-weight: 400; }
.navLinks { display: flex; gap: 16px; }
.navLink { color: var(--text-muted); font-size: 14px; text-decoration: none; }
.navLink:hover { color: var(--text); text-decoration: none; }

/* Footer */
.footer { margin-top: 64px; padding: 24px 0; border-top: 1px solid var(--border); text-align: center; color: var(--text-muted); font-size: 12px; }

/* Common components */
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 16px; }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 12px; font-size: 12px; border: 1px solid var(--border); color: var(--text-muted); }
.badgeAccent { border-color: rgba(34, 211, 238, 0.3); color: var(--accent); }
.badgeSuccess { border-color: rgba(52, 211, 153, 0.3); color: var(--success); }
.badgeWarning { border-color: rgba(251, 191, 36, 0.3); color: var(--warning); }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--text); transition: background 0.15s, border-color 0.15s; }
.btn:hover { border-color: var(--border-hover); background: rgba(255,255,255,0.03); text-decoration: none; }
.btnPrimary { composes: btn; background: var(--accent); color: var(--bg-deep); border-color: var(--accent); font-weight: 600; }
.btnPrimary:hover { background: var(--accent-hover); }
.metadata { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.breadcrumbs { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 20px; color: var(--text-muted); }
.breadcrumbLink { color: var(--text-muted); text-decoration: none; }
.breadcrumbLink:hover { color: var(--accent); }
.breadcrumbSep { color: var(--text-dim); }
.copyCmd { display: flex; align-items: center; gap: 8px; background: var(--bg-code); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; margin: 8px 0; }
.copyCmdCode { flex: 1; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.copyCmdBtn { background: none; border: 1px solid var(--border); color: var(--text-muted); padding: 2px 8px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 11px; }
.copyCmdBtn:hover { color: var(--text); border-color: var(--border-hover); }
```

**Step 2: Refactor layout.tsx**

Update `src/templates/layout.tsx`:
- Import `baseStyles` from `../styles/base.module.css`
- Import `layoutStyles` from `../styles/layout.module.css`
- Remove `<link rel="stylesheet" href="/styles.css" />`
- Remove `<script src="/static/htmx.min.js">`
- Add `<style>` tag in `<head>` with `baseStyles.cssText` + `layoutStyles.cssText`
- Replace all string class names with `layoutStyles.xxx`
- Keep the Google Fonts `<link>` tags
- Keep `head` and `scripts` props for per-page injection

Updated layout structure:
```tsx
import { Raw } from "../jsx/jsx-runtime";
import { config } from "../config";
import baseStyles from "../styles/base.module.css";
import layoutStyles from "../styles/layout.module.css";

type LayoutProps = {
  title: string;
  content: string;
  scripts?: string;
  head?: string;
};

export function layout({ title, content, scripts, head }: LayoutProps): string {
  return "<!DOCTYPE html>" + (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{Bun.escapeHTML(title)} — ClawdFiles</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=optional" as="style" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=optional" />
        <style><Raw html={baseStyles.cssText + layoutStyles.cssText} /></style>
        {head ? <Raw html={head} /> : null}
      </head>
      <body>
        <nav class={layoutStyles.nav}>
          <div class={`${baseStyles.container} ${layoutStyles.navInner}`}>
            <a href="/" class={layoutStyles.navLogo}>ClawdFiles<span class={layoutStyles.navLogoVersion}>.v4</span></a>
            <div class={layoutStyles.navLinks}>
              <a href="/docs" class={layoutStyles.navLink}>API Docs</a>
              <a href="/llms.txt" class={layoutStyles.navLink}>llms.txt</a>
            </div>
          </div>
        </nav>
        <main class={baseStyles.container}>
          <Raw html={content} />
        </main>
        <footer class={layoutStyles.footer}>
          <div class={baseStyles.container}>ClawdFiles v4 &mdash; {Bun.escapeHTML(config.baseUrl)}</div>
        </footer>
        {scripts ? <Raw html={scripts} /> : null}
      </body>
    </html>
  );
}
```

Export `baseStyles` and `layoutStyles` so other templates can reuse the shared component classes (badge, btn, card, etc.) without re-importing.

**Step 3: Verify the layout renders**

Run: `bun run src/index.ts`
Visit the home page in browser. It should render but look unstyled in places (since home.tsx still uses old string class names and the old `/styles.css` link is gone). That's expected — we'll fix page-by-page.

**Step 4: Commit**

```
refactor: migrate layout to CSS modules with scoped classes
```

---

### Task 4: Create client JS build pipeline

**Files:**
- Create: `src/client-bundle.ts`
- Create: `src/client/bucket.ts` (empty placeholder)
- Create: `src/client/file.ts` (empty placeholder)
- Create: `src/client/upload.ts` (empty placeholder)
- Modify: `src/index.ts`

**Step 1: Create placeholder client entry points**

Create minimal files to make the build pipeline work:

`src/client/bucket.ts`:
```ts
console.log("bucket client loaded");
```

`src/client/file.ts`:
```ts
console.log("file client loaded");
```

`src/client/upload.ts`:
```ts
console.log("upload client loaded");
```

**Step 2: Create the client bundle module**

Create `src/client-bundle.ts`:
```ts
import * as log from "./logger";

const clientJsCache = new Map<string, string>();

export async function buildClientJs(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [
      "./src/client/upload.ts",
      "./src/client/bucket.ts",
      "./src/client/file.ts",
    ],
    minify: true,
  });

  if (!result.success) {
    log.error("Client JS build failed:", result.logs);
    throw new Error("Client JS build failed");
  }

  for (const output of result.outputs) {
    // output.path is like "/absolute/path/upload.js"
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
```

**Step 3: Wire into index.ts startup**

In `src/index.ts`, add:
- Import `buildClientJs` from `./client-bundle`
- Call `buildClientJs()` alongside `buildStyles()` and `preloadHighlighter()` in the `Promise.all`

```ts
import { buildClientJs } from "./client-bundle";

// Build CSS, client JS, and preload Shiki in parallel
const [styles] = await Promise.all([
  buildStyles(),
  buildClientJs(),
  preloadHighlighter(),
]);
```

**Step 4: Verify builds succeed**

Run: `bun run src/index.ts`
Expected: Log output includes "Client JS built: upload, bucket, file"

**Step 5: Commit**

```
feat: add client JS build pipeline with startup bundling
```

---

### Task 5: Refactor home page to CSS modules

**Files:**
- Create: `src/styles/home.module.css`
- Modify: `src/templates/home.tsx`

**Step 1: Create home.module.css**

Extract hero and features grid styles. Refresh the design slightly — cleaner spacing:

```css
.hero { text-align: center; padding: 72px 0 48px; }
.heroTitle { font-size: 36px; margin-bottom: 12px; }
.heroAccent { color: var(--accent); }
.heroDesc { color: var(--text-muted); font-size: 15px; max-width: 600px; margin: 0 auto; line-height: 1.7; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 48px 0; }
.featureTitle { font-size: 15px; font-weight: 600; }
.featureDesc { color: var(--text-muted); font-size: 13px; margin-top: 8px; line-height: 1.6; }
```

**Step 2: Refactor home.tsx**

- Import `homeStyles` from `../styles/home.module.css`
- Import `layoutStyles` from `../styles/layout.module.css` (for `.card`)
- Use scoped class names in JSX
- Pass `homeStyles.cssText` in the `head` prop to layout

```tsx
import layoutStyles from "../styles/layout.module.css";
import homeStyles from "../styles/home.module.css";
import { layout } from "./layout.tsx";

function FeatureCard({ title, desc }: { title: string; desc: string; children?: unknown }) {
  return (
    <div class={layoutStyles.card}>
      <h3 class={homeStyles.featureTitle}>{title}</h3>
      <p class={homeStyles.featureDesc}>{desc}</p>
    </div>
  );
}

export function homePage(): string {
  const content = (
    <>
      <div class={homeStyles.hero}>
        <h1 class={homeStyles.heroTitle}><span class={homeStyles.heroAccent}>Clawd</span>Files</h1>
        <p class={homeStyles.heroDesc}>Fast file hosting with built-in rendering, versioning, and an API designed for humans and machines alike.</p>
      </div>
      <div class={homeStyles.features}>
        <FeatureCard title="Built-in Previews" desc="Code highlighting (Shiki), Markdown, CSV tables, JSON trees, SVG, images, PDFs — all rendered server-side." />
        ...remaining cards...
      </div>
    </>
  );

  return layout({ title: "Home", content, head: `<style>${homeStyles.cssText}</style>` });
}
```

**Step 3: Verify home page renders correctly**

Run: `bun run src/index.ts`
Visit `/` in browser — should look correct with refreshed theme.

**Step 4: Commit**

```
refactor: migrate home page to CSS modules
```

---

### Task 6: Create render CSS module with :global() for lumen classes

**Files:**
- Create: `src/styles/render.module.css`

**Step 1: Create render.module.css**

Move all `.lumen-*` styles from `index.css` into `src/styles/render.module.css`, wrapped in `:global()`:

```css
:global(.lumen-render) { font-family: 'JetBrains Mono', monospace; line-height: 1.6; color: var(--text); }
:global(.lumen-no-preview) { padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border); }
:global(.lumen-code pre) { margin: 0; padding: 16px; border-radius: 0; overflow-x: auto; font-size: 13px; line-height: 1.5; background: transparent !important; }
/* ...all other lumen-* styles from index.css... */
```

Copy every `.lumen-*` rule from the current `src/render/styles/index.css` (lines 4-415), wrapping each selector with `:global()`.

Also include the `.csv-filter`, `.csv-toolbar`, `.csv-count` styles since those are used by the CSV renderer's HTML output.

**Step 2: Commit**

```
feat: add render CSS module with :global() lumen classes
```

---

### Task 7: Refactor bucket page to CSS modules + bundled client JS

**Files:**
- Create: `src/styles/bucket.module.css`
- Modify: `src/templates/bucket.tsx`
- Modify: `src/client/bucket.ts`

**Step 1: Create bucket.module.css**

Extract file table, file grid, toolbar, view toggle styles from `site.css`:

```css
/* File table */
.fileTable { width: 100%; border-collapse: collapse; }
.fileTableHead { text-align: left; padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; background: rgba(0,0,0,0.15); border-bottom: 1px solid var(--border); }
.fileTableCell { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid var(--border); }
.fileIcon { width: 32px; text-align: center; font-size: 15px; white-space: nowrap; }
.fileName { font-weight: 500; }
.fileNameLink { color: var(--text); text-decoration: none; }
.fileNameLink:hover { color: var(--accent); }
.fileMeta { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: var(--accent); }

/* File toolbar */
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.filterInput { flex: 1; max-width: 320px; padding: 6px 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: inherit; font-size: 13px; outline: none; }
.filterInput:focus { border-color: var(--accent); }
.filterInput::placeholder { color: var(--text-dim); }

/* View toggle */
.viewToggle { display: flex; gap: 4px; }
.viewBtn { gap: 4px; font-size: 12px; padding: 5px 12px; }
.viewBtnActive { color: var(--accent); border-color: var(--accent); }

/* File grid */
.fileGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.gridItem { display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: border-color 0.15s; }
.gridItem:hover { border-color: var(--accent); }
.gridPreview { aspect-ratio: 1; overflow: hidden; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; }
.gridPreviewImg { width: 100%; height: 100%; object-fit: cover; }
.gridIcon { font-size: 36px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
.gridInfo { padding: 10px 12px; border-top: 1px solid var(--border); }
.gridName { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); text-decoration: none; display: block; }
.gridName:hover { color: var(--accent); }
.gridMetaRow { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
.gridMeta { font-size: 11px; color: var(--text-muted); }
.gridDownload { font-size: 14px; color: var(--text-muted); text-decoration: none; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: color 0.15s, background 0.15s; }
.gridDownload:hover { color: var(--accent); background: var(--accent-glow); }

/* Bucket header */
.headerRow { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 8px; }
.headerActions { display: flex; gap: 8px; }
.purpose { color: var(--text-muted); font-size: 13px; margin-top: 2px; }
.description { color: var(--text-muted); margin-bottom: 16px; }
```

**Step 2: Refactor bucket.tsx**

- Import `bucketStyles` from `../styles/bucket.module.css`
- Import `layoutStyles` from `../styles/layout.module.css` (for card, badge, btn, breadcrumbs, copyCmd, metadata)
- Replace all string class names with scoped names
- Remove the inline `<script>` block entirely
- Add a `<script type="application/json" id="pageData">` with bucket ID and scoped class names the client JS needs
- Pass `bucketStyles.cssText` in `head` prop
- Import `getClientJs` from `../client-bundle` and pass bundled JS in `scripts` prop

The template passes class names to the client via pageData so the client can manipulate DOM with the correct scoped names:

```tsx
const pageData = JSON.stringify({
  bucketId: bucket.id,
  styles: {
    viewBtnActive: bucketStyles.viewBtnActive,
  },
});
```

Head: `<style>${bucketStyles.cssText}</style><script type="application/json" id="pageData">${pageData}</script>`

Scripts: `<script>${getClientJs("bucket")}</script>`

**Step 3: Implement src/client/bucket.ts**

Move the inline JS logic from the old bucket.tsx template into this file. Uses safe DOM APIs (no innerHTML except for WebSocket-pushed server-rendered HTML which is trusted):

```ts
interface PageData {
  bucketId: string;
  styles: {
    viewBtnActive: string;
  };
}

const data: PageData = JSON.parse(document.getElementById("pageData")!.textContent!);

// WebSocket — server sends pre-rendered HTML for the file list
(function() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws/bucket/${data.bucketId}`);
  ws.onmessage = (e) => {
    const list = document.getElementById("file-list");
    if (list) {
      // Server-rendered trusted HTML from our own WebSocket
      list.replaceChildren();
      const template = document.createElement("template");
      template.innerHTML = e.data;
      list.appendChild(template.content);
    }
  };
  ws.onclose = () => setTimeout(() => location.reload(), 3000);
})();

// View toggle
function setView(view: string) {
  document.getElementById("file-view-list")!.style.display = view === "list" ? "" : "none";
  document.getElementById("file-view-grid")!.style.display = view === "grid" ? "" : "none";
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle(data.styles.viewBtnActive, (b as HTMLElement).dataset.view === view);
  });
  localStorage.setItem("cf4-view", view);
}

// Sorting
let sortCol: string | null = null;
let sortDir = "asc";
function sortFiles(col: string) {
  if (sortCol === col) { sortDir = sortDir === "asc" ? "desc" : "asc"; }
  else { sortCol = col; sortDir = "asc"; }
  // ...same sort logic as current inline code...
}

// Filtering
function filterFiles(q: string) {
  // ...same filter logic as current inline code...
}

// Restore view preference
const saved = localStorage.getItem("cf4-view");
if (saved === "grid") setView("grid");

// Expose to onclick handlers in HTML
Object.assign(window, { setView, sortFiles, filterFiles });
```

**Step 4: Verify bucket page**

Run server, navigate to a bucket page. Check:
- Styles render correctly
- View toggle works
- Sort works
- Filter works
- WebSocket updates work

**Step 5: Commit**

```
refactor: migrate bucket page to CSS modules + bundled client JS
```

---

### Task 8: Refactor file page to CSS modules + bundled client JS (remove HTMX)

**Files:**
- Create: `src/styles/file.module.css`
- Modify: `src/templates/file.tsx`
- Modify: `src/client/file.ts`

**Step 1: Create file.module.css**

```css
.previewContainer { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.previewWide { width: calc(100vw - 48px); max-width: none; margin-left: calc(-1 * (100vw - 48px - 100%) / 2); }
.previewHeader { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--border); font-size: 13px; }
.previewBody { padding: 0; overflow-x: auto; }
.previewActions { display: flex; gap: 4px; }
.previewBtn { padding: 2px 8px; font-size: 11px; }
.previewBtnActive { color: var(--accent); border-color: var(--accent); }
.headerRow { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.headerActions { display: flex; gap: 8px; }
.versionDetails { margin-top: 16px; }
.versionSummary { cursor: pointer; color: var(--text-muted); font-size: 13px; }
.versionCurrent { padding: 6px 0; font-size: 13px; color: var(--accent); }
.versionItem { padding: 6px 0; font-size: 13px; border-top: 1px solid var(--border); }
```

**Step 2: Refactor file.tsx**

- Import CSS modules
- Replace `hx-get`, `hx-target`, `hx-swap` attributes with plain `data-action` attributes
- Use scoped class names everywhere
- Pass `bucketId`, `filePath`, scoped class names via pageData
- Pass `renderStyles.cssText` + `fileStyles.cssText` in head
- Pass `getClientJs("file")` in scripts

Remove HTMX attributes from the source/rendered toggle buttons:
```tsx
<button class={`${layoutStyles.btn} ${fileStyles.previewBtn}`}
  data-action="source">Source</button>
<button class={`${layoutStyles.btn} ${fileStyles.previewBtn} ${fileStyles.previewBtnActive}`}
  data-action="rendered">Rendered</button>
```

**Step 3: Implement src/client/file.ts**

```ts
interface PageData {
  bucketId: string;
  filePath: string;
  styles: {
    previewBtnActive: string;
  };
}

const data: PageData = JSON.parse(document.getElementById("pageData")!.textContent!);

// WebSocket for live updates
(function() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws/file/${data.bucketId}/${encodeURIComponent(data.filePath)}`);
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "updated") {
        fetch(`/${data.bucketId}/${encodeURIComponent(data.filePath)}?fragment=1`)
          .then(r => r.text())
          .then(html => {
            const el = document.getElementById("preview-body");
            if (el) {
              // Server-rendered trusted preview content
              const template = document.createElement("template");
              template.innerHTML = html;
              el.replaceChildren(template.content);
            }
          });
      }
    } catch {}
  };
  ws.onclose = () => setTimeout(() => location.reload(), 3000);
})();

// Source/Rendered toggle (replaces HTMX)
document.querySelectorAll("[data-action]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const action = (btn as HTMLElement).dataset.action;
    const isSource = action === "source";
    const url = `/${data.bucketId}/${encodeURIComponent(data.filePath)}${isSource ? "?view=raw&fragment=1" : "?fragment=1"}`;

    fetch(url)
      .then(r => r.text())
      .then(html => {
        const el = document.getElementById("preview-body");
        if (el) {
          const template = document.createElement("template");
          template.innerHTML = html;
          el.replaceChildren(template.content);
        }
      });

    // Update active state
    document.querySelectorAll("[data-action]").forEach(b => {
      b.classList.toggle(data.styles.previewBtnActive, b === btn);
    });
  });
});
```

**Step 4: Verify file page**

Test: source/rendered toggle, WebSocket live updates, version history display.

**Step 5: Commit**

```
refactor: migrate file page to CSS modules + vanilla JS, remove HTMX
```

---

### Task 9: Refactor admin page to CSS modules

**Files:**
- Create: `src/styles/admin.module.css`
- Create: `src/client/admin.ts`
- Modify: `src/templates/admin.tsx`
- Modify: `src/client-bundle.ts`

**Step 1: Create admin.module.css**

```css
.title { margin-bottom: 24px; }
.statsGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.statCard { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
.statValue { font-size: 28px; font-weight: 700; color: var(--accent); }
.statLabel { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.sectionTitle { margin: 32px 0 16px; }
.revokeBtn { padding: 2px 8px; font-size: 11px; color: var(--error); }
```

**Step 2: Create src/client/admin.ts**

```ts
// Handle key revocation
document.querySelectorAll("[data-revoke]").forEach(btn => {
  btn.addEventListener("click", () => {
    const prefix = (btn as HTMLElement).dataset.revoke!;
    if (!confirm(`Revoke key ${prefix}?`)) return;
    fetch(`/api/keys/${prefix}`, { method: "DELETE" })
      .then(() => btn.closest("tr")?.remove());
  });
});
```

**Step 3: Add admin.ts to client-bundle.ts entrypoints**

Add `"./src/client/admin.ts"` to the entrypoints array in `buildClientJs()`.

**Step 4: Refactor admin.tsx**

- Import CSS modules, use scoped class names
- Replace HTMX attributes on revoke button with `data-revoke={k.prefix}`
- Pass `adminStyles.cssText` in head
- Pass `getClientJs("admin")` in scripts

**Step 5: Commit**

```
refactor: migrate admin page to CSS modules + bundled client JS
```

---

### Task 10: Refactor docs page (minor)

**Files:**
- Modify: `src/routes/docs.ts`

**Step 1: Update docs route**

The docs page uses layout with a `<style>` that hides `.nav,.footer`. With CSS modules, these class names are scoped. Import `layoutStyles` and `baseStyles` in `docs.ts` and use the scoped names:

```ts
import layoutStyles from "../styles/layout.module.css";
import baseStyles from "../styles/base.module.css";

// In the handler:
head: `<style>.${layoutStyles.nav},.${layoutStyles.footer}{display:none} .${baseStyles.container}{max-width:100%;padding:0}</style>`,
```

**Step 2: Commit**

```
refactor: update docs page to use scoped CSS class names
```

---

### Task 11: Remove old CSS infrastructure and HTMX

**Files:**
- Delete: `src/render/styles/site.css`
- Delete: `src/render/styles/index.css`
- Delete: `src/render/styles.ts`
- Delete: `src/static/htmx.min.js` (if it exists)
- Modify: `src/index.ts` (remove old styles build, remove htmx route, remove styles.css route)
- Modify: `package.json` (remove `htmx.org` dependency)

**Step 1: Remove old files**

Delete the files listed above.

**Step 2: Update index.ts**

- Remove `import { buildStyles } from "./render/styles"`
- Remove `buildStyles()` from `Promise.all` (keep `buildClientJs()` and `preloadHighlighter()`)
- Remove the `/styles.css` route from the `routes` object
- Remove the `/static/htmx.min.js` route from the `routes` object

**Step 3: Remove htmx dependency**

Run: `bun remove htmx.org`

**Step 4: Verify everything still works**

Run: `bun run src/index.ts`
Test all pages: home, bucket, file, admin, docs, upload.

**Step 5: Commit**

```
chore: remove old CSS build pipeline and HTMX dependency
```

---

### Task 12: Build the upload page — CSS module

**Files:**
- Create: `src/styles/upload.module.css`

**Step 1: Create upload.module.css**

Full standalone dark theme for the upload page:

```css
.page {
  min-height: 100vh;
  background: var(--bg-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  color: var(--text);
  padding: 24px;
}

.container { width: 100%; max-width: 560px; }
.title { font-size: 18px; font-weight: 600; margin-bottom: 24px; color: var(--text); text-align: center; }

.dropZone {
  border: 2px dashed var(--border-hover);
  border-radius: var(--radius-lg);
  padding: 48px 32px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.dropZone:hover { border-color: var(--accent); background: var(--accent-glow); }
.dropZoneActive { border-color: var(--accent); border-style: solid; background: rgba(34, 211, 238, 0.12); }

.dropIcon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
.dropText { font-size: 15px; color: var(--text-muted); margin-bottom: 16px; }
.dropHint { font-size: 12px; color: var(--text-dim); }

.browseBtn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 20px;
  border-radius: var(--radius-sm); font-size: 13px; font-family: inherit;
  cursor: pointer; border: 1px solid var(--accent); background: transparent;
  color: var(--accent); transition: background 0.15s; margin-top: 12px;
}
.browseBtn:hover { background: var(--accent-glow); }

.fileList { margin-top: 24px; }

.fileItem {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); margin-bottom: 8px;
}
.fileHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.fileName { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.fileSize { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.fileStatus { font-size: 11px; font-weight: 600; white-space: nowrap; }

.statusPending { color: var(--text-dim); }
.statusUploading { color: var(--accent); }
.statusComplete { color: var(--success); }
.statusError { color: var(--error); }

.progressTrack { height: 4px; background: var(--bg-surface); border-radius: 2px; overflow: hidden; }
.progressBar { height: 100%; background: linear-gradient(90deg, var(--accent), #6366f1); border-radius: 2px; transition: width 0.2s ease; width: 0%; }

.fileUrl { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.fileUrlText { font-size: 12px; color: var(--accent); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.copyBtn {
  background: none; border: 1px solid var(--border); color: var(--text-muted);
  padding: 2px 8px; border-radius: 4px; cursor: pointer; font-family: inherit;
  font-size: 11px; white-space: nowrap; transition: color 0.15s, border-color 0.15s;
}
.copyBtn:hover { color: var(--text); border-color: var(--border-hover); }

.errorMsg { font-size: 12px; color: var(--error); margin-top: 2px; }
.hidden { display: none; }
```

**Step 2: Commit**

```
feat: add upload page CSS module with dark theme
```

---

### Task 13: Build the upload page — template

**Files:**
- Create: `src/templates/upload.tsx`
- Modify: `src/routes/upload-links.ts`

**Step 1: Create upload.tsx**

Standalone page (no layout wrapper). Imports base + upload CSS modules and injects them:

```tsx
import { Raw } from "../jsx/jsx-runtime";
import baseStyles from "../styles/base.module.css";
import uploadStyles from "../styles/upload.module.css";
import { getClientJs } from "../client-bundle";

type UploadPageProps = {
  token: string;
  baseUrl: string;
};

export function uploadPage({ token, baseUrl }: UploadPageProps): string {
  const pageData = JSON.stringify({
    token,
    baseUrl,
    styles: {
      dropZone: uploadStyles.dropZone,
      dropZoneActive: uploadStyles.dropZoneActive,
      fileList: uploadStyles.fileList,
      fileItem: uploadStyles.fileItem,
      fileHeader: uploadStyles.fileHeader,
      fileName: uploadStyles.fileName,
      fileSize: uploadStyles.fileSize,
      fileStatus: uploadStyles.fileStatus,
      statusPending: uploadStyles.statusPending,
      statusUploading: uploadStyles.statusUploading,
      statusComplete: uploadStyles.statusComplete,
      statusError: uploadStyles.statusError,
      progressTrack: uploadStyles.progressTrack,
      progressBar: uploadStyles.progressBar,
      fileUrl: uploadStyles.fileUrl,
      fileUrlText: uploadStyles.fileUrlText,
      copyBtn: uploadStyles.copyBtn,
      errorMsg: uploadStyles.errorMsg,
      hidden: uploadStyles.hidden,
    },
  });

  return "<!DOCTYPE html>" + (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Upload Files — ClawdFiles</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=optional" />
        <style><Raw html={baseStyles.cssText + uploadStyles.cssText} /></style>
        <script type="application/json" id="pageData"><Raw html={pageData} /></script>
      </head>
      <body>
        <div class={uploadStyles.page}>
          <div class={uploadStyles.container}>
            <div class={uploadStyles.title}>Upload Files</div>
            <div class={uploadStyles.dropZone} id="dropZone">
              <div class={uploadStyles.dropIcon}>&#8593;</div>
              <div class={uploadStyles.dropText}>Drag and drop files here</div>
              <button class={uploadStyles.browseBtn} id="browseBtn">Choose Files</button>
              <div class={uploadStyles.dropHint}>Files upload immediately when dropped</div>
              <input type="file" id="fileInput" multiple class={uploadStyles.hidden} />
            </div>
            <div class={uploadStyles.fileList} id="fileList"></div>
          </div>
        </div>
        <script><Raw html={getClientJs("upload")} /></script>
      </body>
    </html>
  );
}
```

**Step 2: Update upload-links route**

In `src/routes/upload-links.ts`, replace the GET handler's inline HTML:

```ts
import { uploadPage } from "../templates/upload";

// In the GET handler:
addRoute("GET", "/api/upload/:token", async (_req, params) => {
  const result = validateUploadToken(params.token);
  if (!result.valid) {
    return new Response("Upload link expired or invalid", { status: 401 });
  }

  const html = uploadPage({ token: params.token, baseUrl: config.baseUrl });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});
```

**Step 3: Commit**

```
feat: add upload page template with CSS modules
```

---

### Task 14: Build the upload page — client JS

**Files:**
- Modify: `src/client/upload.ts`

**Step 1: Implement the full upload client**

All DOM construction uses safe methods (createElement, textContent, appendChild) — no innerHTML with user data:

```ts
interface PageData {
  token: string;
  baseUrl: string;
  styles: Record<string, string>;
}

const data: PageData = JSON.parse(document.getElementById("pageData")!.textContent!);
const s = data.styles;

const dropZone = document.getElementById("dropZone")!;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const browseBtn = document.getElementById("browseBtn")!;
const fileListEl = document.getElementById("fileList")!;

// Browse button opens file picker (stop propagation to avoid dropZone click)
browseBtn.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener("click", () => fileInput.click());

// Drag events
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add(s.dropZoneActive); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove(s.dropZoneActive));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove(s.dropZoneActive);
  if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files?.length) uploadFiles(fileInput.files);
  fileInput.value = "";
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function uploadFiles(files: FileList) {
  for (const file of Array.from(files)) uploadSingleFile(file);
}

function uploadSingleFile(file: File) {
  // Build file item using safe DOM APIs
  const item = document.createElement("div");
  item.className = s.fileItem;

  const header = document.createElement("div");
  header.className = s.fileHeader;

  const nameEl = document.createElement("span");
  nameEl.className = s.fileName;
  nameEl.textContent = file.name;

  const sizeEl = document.createElement("span");
  sizeEl.className = s.fileSize;
  sizeEl.textContent = formatBytes(file.size);

  const statusEl = document.createElement("span");
  statusEl.className = `${s.fileStatus} ${s.statusPending}`;
  statusEl.textContent = "Pending";

  header.append(nameEl, sizeEl, statusEl);

  const track = document.createElement("div");
  track.className = s.progressTrack;
  const bar = document.createElement("div");
  bar.className = s.progressBar;
  track.appendChild(bar);

  item.append(header, track);
  fileListEl.appendChild(item);

  // XHR upload
  const fd = new FormData();
  fd.append("files", file);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `/api/upload/${data.token}`);

  statusEl.textContent = "0%";
  statusEl.className = `${s.fileStatus} ${s.statusUploading}`;

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      bar.style.width = pct + "%";
      statusEl.textContent = pct + "%";
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const resp = JSON.parse(xhr.responseText);
      statusEl.textContent = "Complete";
      statusEl.className = `${s.fileStatus} ${s.statusComplete}`;
      bar.style.width = "100%";

      // Show short URL
      if (resp.uploaded?.[0]?.shortCode) {
        const shortUrl = `${data.baseUrl}/s/${resp.uploaded[0].shortCode}`;
        const urlRow = document.createElement("div");
        urlRow.className = s.fileUrl;

        const link = document.createElement("a");
        link.href = shortUrl;
        link.className = s.fileUrlText;
        link.target = "_blank";
        link.textContent = shortUrl;

        const copyBtn = document.createElement("button");
        copyBtn.className = s.copyBtn;
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(shortUrl);
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
        });

        urlRow.append(link, copyBtn);
        item.appendChild(urlRow);
      }
    } else {
      let errMsg = "Upload failed";
      try { errMsg = JSON.parse(xhr.responseText).error || errMsg; } catch {}
      statusEl.textContent = "Error";
      statusEl.className = `${s.fileStatus} ${s.statusError}`;
      const errEl = document.createElement("div");
      errEl.className = s.errorMsg;
      errEl.textContent = errMsg;
      item.appendChild(errEl);
    }
  };

  xhr.onerror = () => {
    statusEl.textContent = "Error";
    statusEl.className = `${s.fileStatus} ${s.statusError}`;
    const errEl = document.createElement("div");
    errEl.className = s.errorMsg;
    errEl.textContent = "Network error";
    item.appendChild(errEl);
  };

  xhr.send(fd);
}
```

**Step 2: Verify upload page**

Generate an upload link via API, visit the URL. Test:
- Drag and drop files: concurrent uploads with per-file progress
- Click to browse files: same behavior
- Error handling (expired token, network error)
- Copy short URL button works
- Re-dropping more files adds them to the list

**Step 3: Commit**

```
feat: implement upload page client JS with concurrent uploads
```

---

### Task 15: End-to-end verification and cleanup

**Files:**
- Possibly modify various files for small fixes

**Step 1: Full smoke test**

Run: `bun run src/index.ts`

Test each page:
- `/` — home page renders with refreshed theme
- `/:bucketId` — bucket page with file list, sorting, filtering, view toggle, WebSocket
- `/:bucketId/:path` — file page with preview, source/rendered toggle, WebSocket, version history
- `/api/upload/:token` — upload page with drag-and-drop, concurrent uploads, progress, short URLs
- `/admin?token=...` — admin dashboard with key revoke
- `/docs` — Scalar API docs (nav/footer hidden)

**Step 2: Check no old CSS references remain**

Search for: `styles.css`, `site.css`, `index.css` (in the render/styles sense), `htmx`, `/static/htmx`

**Step 3: Run tests**

Run: `bun test`
Expected: All existing tests pass (the CSS loader preload is in `[test].preload` so modules work in tests too).

**Step 4: Clean up any empty directories**

If `src/render/styles/` is empty after deleting `site.css` and `index.css`, remove the directory.
If `src/static/` is empty after deleting `htmx.min.js`, remove the directory (unless other static files exist).

**Step 5: Final commit**

```
chore: end-to-end verification and cleanup
```
