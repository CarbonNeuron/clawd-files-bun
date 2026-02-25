# JSX + CSS Modules + Client JS Bundling Refactor

## Scope

Refactor all HTML rendering to use JSX with bun-css-modules for per-page scoped CSS, per-page bundled client JS entry points, remove HTMX, and redesign the upload page. Refresh the visual theme across all pages.

## CSS Modules Infrastructure

- **bun-css-modules** (`bun add -D bun-css-modules`): Bun preload plugin using Lightning CSS. Each `.module.css` import yields an object with scoped class names + a `cssText` property containing transformed CSS.
- **`src/cssLoader.ts`**: Plugin file. `bunfig.toml` gets `preload = ["./src/cssLoader.ts"]` at the top level; test preload moves to `[test].preload`.
- **`src/styles/base.module.css`**: Reset, CSS custom properties (refreshed theme), `@font-face` / font stack, shared primitives (`.container`, base typography). Injected via `<style>` in the layout head. Custom properties don't get scoped, which is correct — they're global by design.
- **Per-page modules**: `layout.module.css`, `home.module.css`, `bucket.module.css`, `file.module.css`, `upload.module.css`, `render.module.css`.
- **Renderer styles**: `render.module.css` uses `:global(.lumen-*)` for all renderer class names since renderers produce pre-built HTML strings with those class names. Keeps everything in the module system with explicit intent.
- **Old CSS removal**: Delete `src/render/styles/site.css`, `src/render/styles/index.css`, `src/render/styles.ts`. Remove `/styles.css` route from `index.ts`.

## Client JS Bundling

- **Entry points** in `src/client/`:
  - `upload.ts` — drag-and-drop, XHR progress, file list, concurrent uploads
  - `bucket.ts` — WebSocket, sorting, filtering, view toggle, grid sync
  - `file.ts` — WebSocket, live preview refresh, source/rendered toggle (vanilla fetch, replaces HTMX)
- **Build at startup** in `index.ts`: `Bun.build({ entrypoints: [...], minify: true })` → cache outputs in `Map<string, string>` → export `getClientJs(name): string`.
- **Template integration**: `<script>{getClientJs("bucket")}</script>` — inlined, no external script requests.
- **Server data passing**: `<script type="application/json" id="pageData">` with JSON containing scoped class names, bucket IDs, tokens, config. Client reads via `JSON.parse(document.getElementById("pageData").textContent)`.
- **HTMX removal**: Remove `htmx.org` dependency, delete `src/static/htmx.min.js`, remove `/static/htmx.min.js` route, remove `<script src="/static/htmx.min.js">` from layout.

## Template Refactoring

All pages refactored to the new pattern:

1. Import page's `.module.css` → scoped class names object
2. Use `styles.className` in JSX
3. Pass `cssText` into layout's `head` prop via `<style>` tag
4. Pass bundled client JS into layout's `scripts` prop via `getClientJs()`
5. Pass server data via `<script type="application/json" id="pageData">`
6. No inline `<script>` blocks in any template

**Layout (`layout.tsx`):**
- Keep Google Fonts `<link>` (simple, one request)
- Remove `<link rel="stylesheet" href="/styles.css" />`
- Remove `<script src="/static/htmx.min.js">`
- Inject `base.module.css` + `layout.module.css` cssText in head
- `head`/`scripts` props carry per-page CSS and JS

**Pages:**
- `home.tsx` — `home.module.css`, no client JS needed
- `bucket.tsx` — `bucket.module.css` + `src/client/bucket.ts`
- `file.tsx` — `file.module.css` + `render.module.css` + `src/client/file.ts`
- Upload page — `upload.module.css` + `src/client/upload.ts` (standalone, no layout)

## Upload Page Redesign

**Visual:**
- Standalone page (no layout wrapper, no nav/footer)
- Centered card on dark background, refreshed palette
- Clean minimal dark theme

**Drop zone:**
- Large dashed-border area with icon + instruction text
- Hover: solid accent border, subtle bg glow
- Active (dragging): prominent bg highlight
- File picker button as alternative

**File list (after selection):**
- Per-file rows: filename, formatted size, progress bar, status badge
- Statuses: pending, uploading (animated progress %), complete (green + copyable short URL), error (red + message)
- Per-file progress via XHR `upload.onprogress`
- Concurrent uploads (browser caps at ~6/host naturally)

**On completion:**
- Each file shows copyable short URL (`{baseUrl}/s/{shortCode}`)

**Error handling:**
- Per-file errors, one failure doesn't block others
- Re-drop/re-select adds more files (additive)

**pageData:**
```json
{
  "token": "...",
  "baseUrl": "https://...",
  "styles": { "dropZone": "...", "fileItem": "...", ... }
}
```

## Theme Refresh

Keep dark aesthetic but modernize: cleaner spacing, refined color palette, smoother transitions. Still recognizably the same app. Applied across all pages via the new CSS modules.
