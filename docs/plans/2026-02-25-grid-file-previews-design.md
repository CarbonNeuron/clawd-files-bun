# Grid File Previews Design

## Problem

1. Files without mapped extensions (Dockerfile, .cs files) show a folder icon instead of a file icon because `getMimeType()` returns `application/octet-stream` and the default icon in `fileIcon()` is the folder emoji.
2. Non-image files in grid view only show an emoji icon with no preview of their contents.
3. Video files show an emoji instead of a frame preview.

## Solution

### 1. Fix folder icon bug

**`src/utils.ts`**: Add missing extensions to `MIME_MAP` (`.cs`, `.csproj`, `.sln`, `.dockerfile`, `.graphql`, `.vue`, `.svelte`, `.ini`, `.cfg`, `.env`, `.lock`, `.wasm`). Handle extensionless files by filename (`Dockerfile`, `Makefile`, `Jenkinsfile`, `Procfile`, `Vagrantfile`, `Gemfile`, `Rakefile`, `Justfile`) in `getMimeType()`.

**`src/templates/bucket.tsx` and `src/websocket.ts`**: Change the default icon from `📁` (folder) to `📄` (file).

### 2. Syntax-highlighted code snippet previews

At render time, read the first ~500 bytes of each text/code file and highlight them with Shiki (already used in the codebase via `src/render/code.ts`).

**`src/routes/pages.ts`**: Before calling `bucketPage()`, iterate over text files, read first 500 bytes from disk, detect language using the existing `EXT_TO_LANG`/`FILENAME_TO_LANG` maps, call `highlightCode()`, and build a `Map<string, string>` of path-to-highlighted-HTML.

**`src/templates/bucket.tsx`**: `bucketPage()` and `GridCard()` accept an optional snippets map. When a snippet exists for a file, render it in the preview area as a `<div>` containing the highlighted HTML, styled with tiny monospace font (~7px), overflow hidden, and a fade-out gradient at the bottom.

**`src/styles/bucket.module.css`**: Add styles for `.gridCodePreview` — small font, no scrolling, pointer-events none, fade gradient overlay.

### 3. Video thumbnail previews

**`src/templates/bucket.tsx`**: When a file's MIME type starts with `video/`, render a `<video preload="metadata" muted>` element pointing to `/raw/{bucketId}/{path}` instead of the emoji icon. The browser loads enough data to display the first frame.

**`src/styles/bucket.module.css`**: Add styles for the video element to fill the preview area with `object-fit: cover`.

## Files to modify

- `src/utils.ts` — Add missing MIME types, handle extensionless files
- `src/render/code.ts` — Export `EXT_TO_LANG`, `FILENAME_TO_LANG`, and `getLangForFile()` helper
- `src/templates/bucket.tsx` — Accept snippets map, render code/video previews in GridCard
- `src/routes/pages.ts` — Read and highlight text file snippets before rendering
- `src/styles/bucket.module.css` — Add code preview and video preview styles
- `src/websocket.ts` — Fix default icon
