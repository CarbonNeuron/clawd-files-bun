# Grid File Previews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix incorrect folder icons for unmapped file types and add syntax-highlighted code previews + video thumbnail previews to the grid view.

**Architecture:** Server-side approach — read first ~500 bytes of text files at page render time, highlight with the existing Shiki highlighter, and embed the highlighted HTML directly into grid cards. Video previews use browser-native `<video preload="metadata">`. MIME detection is improved with filename-based fallbacks for extensionless files.

**Tech Stack:** Bun, Shiki (already in codebase), server-side TSX templates

**Security note:** All HTML in grid previews is server-generated from trusted local file content read from disk (Shiki's `codeToHtml` output and `Bun.escapeHTML`-escaped text). No user-supplied HTML is injected. The existing `dangerouslySetInnerHTML` pattern (already in use in `GridCard`) is safe here because content originates from server-side rendering of stored files.

---

### Task 1: Fix MIME type detection for extensionless and unmapped files

**Files:**
- Modify: `src/utils.ts:14-83` (MIME_MAP and getMimeType)
- Test: `test/utils.test.ts`

**Step 1: Write the failing tests**

Add to `test/utils.test.ts`, in the existing `getMimeType` test block or as a new test:

```typescript
test("getMimeType handles extensionless files by filename", () => {
  expect(getMimeType("Dockerfile")).toBe("text/x-dockerfile");
  expect(getMimeType("Makefile")).toBe("text/x-makefile");
  expect(getMimeType("Rakefile")).toBe("text/x-ruby");
  expect(getMimeType("Gemfile")).toBe("text/x-ruby");
  expect(getMimeType("Justfile")).toBe("text/x-makefile");
  expect(getMimeType("Vagrantfile")).toBe("text/x-ruby");
  expect(getMimeType("Procfile")).toBe("text/x-sh");
  expect(getMimeType("Jenkinsfile")).toBe("text/x-groovy");
});

test("getMimeType handles previously unmapped extensions", () => {
  expect(getMimeType("BucketService.cs")).toBe("text/x-csharp");
  expect(getMimeType("project.csproj")).toBe("text/xml");
  expect(getMimeType("app.sln")).toBe("text/plain");
  expect(getMimeType("schema.graphql")).toBe("text/x-graphql");
  expect(getMimeType("App.vue")).toBe("text/x-vue");
  expect(getMimeType("App.svelte")).toBe("text/x-svelte");
  expect(getMimeType(".env")).toBe("text/x-sh");
  expect(getMimeType(".dockerfile")).toBe("text/x-dockerfile");
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test test/utils.test.ts`
Expected: FAIL — getMimeType returns `application/octet-stream` for these files

**Step 3: Implement the fix**

In `src/utils.ts`, add missing entries to `MIME_MAP` (after the existing code entries around line 49):

```typescript
  ".cs": "text/x-csharp",
  ".csproj": "text/xml",
  ".sln": "text/plain",
  ".graphql": "text/x-graphql",
  ".gql": "text/x-graphql",
  ".vue": "text/x-vue",
  ".svelte": "text/x-svelte",
  ".dockerfile": "text/x-dockerfile",
  ".env": "text/x-sh",
  ".ini": "text/plain",
  ".cfg": "text/plain",
  ".groovy": "text/x-groovy",
  ".gradle": "text/x-groovy",
  ".lock": "text/plain",
```

Add a filename-based lookup map after MIME_MAP:

```typescript
const FILENAME_MIME: Record<string, string> = {
  "Dockerfile": "text/x-dockerfile",
  "Makefile": "text/x-makefile",
  "Rakefile": "text/x-ruby",
  "Gemfile": "text/x-ruby",
  "Justfile": "text/x-makefile",
  "Vagrantfile": "text/x-ruby",
  "Procfile": "text/x-sh",
  "Jenkinsfile": "text/x-groovy",
  ".bashrc": "text/x-sh",
  ".zshrc": "text/x-sh",
  ".profile": "text/x-sh",
  ".gitignore": "text/plain",
  ".gitattributes": "text/plain",
  ".editorconfig": "text/plain",
  ".env": "text/x-sh",
  ".env.example": "text/x-sh",
};
```

Update `getMimeType` to check filename first:

```typescript
export function getMimeType(filename: string): string {
  const basename = filename.split("/").pop() ?? filename;
  // Check exact filename match first (for Dockerfile, Makefile, etc.)
  if (FILENAME_MIME[basename]) return FILENAME_MIME[basename];
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test test/utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils.ts test/utils.test.ts
git commit -m "fix: add MIME types for .cs, Dockerfile, and other unmapped files"
```

---

### Task 2: Fix default file icon from folder to document

**Files:**
- Modify: `src/templates/bucket.tsx:21`
- Modify: `src/websocket.ts:46`
- Test: `test/templates.test.ts`

**Step 1: Write the failing test**

Add to `test/templates.test.ts`:

```typescript
test("bucket page uses document icon for unknown MIME types, not folder", () => {
  const bucket: BucketRow = {
    id: "test123456", name: "Test", description: "", purpose: "",
    owner_key_hash: "hash", created_at: Math.floor(Date.now() / 1000),
    expires_at: null, file_count: 1, total_size: 100,
  };
  const files: FileRow[] = [{
    id: 1, bucket_id: "test123456", path: "data.bin",
    size: 100, mime_type: "application/octet-stream",
    short_code: "abc123", version: 1, sha256: "sha",
    uploaded_at: Math.floor(Date.now() / 1000),
  }];
  const html = bucketPage(bucket, files);
  // Should NOT contain folder icon for unknown files
  expect(html).not.toContain("\u{1F4C1}");
  // Should contain generic document icon
  expect(html).toContain("\u{1F4C4}");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test test/templates.test.ts`
Expected: FAIL — html contains folder icon

**Step 3: Fix the default icon**

In `src/templates/bucket.tsx:21`, change:
```typescript
  return "\u{1F4C1}";
```
to:
```typescript
  return "\u{1F4C4}";
```

In `src/websocket.ts:46`, change:
```typescript
  return "\u{1F4C1}";
```
to:
```typescript
  return "\u{1F4C4}";
```

**Step 4: Run tests to verify they pass**

Run: `bun test test/templates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/templates/bucket.tsx src/websocket.ts test/templates.test.ts
git commit -m "fix: use document icon instead of folder icon for unknown file types"
```

---

### Task 3: Export language detection helper from code.ts

**Files:**
- Modify: `src/render/code.ts`

**Step 1: Add an exported `getLangForFile` helper**

At the end of `src/render/code.ts` (before the `registerRenderer` call), export the two maps and add a helper function:

```typescript
export { EXT_TO_LANG, FILENAME_TO_LANG };

export function getLangForFile(filename: string): string | null {
  const basename = filename.split("/").pop() ?? filename;
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return FILENAME_TO_LANG[basename] ?? EXT_TO_LANG[ext] ?? null;
}
```

This gives `pages.ts` a way to detect if a file is highlightable and get its language.

**Step 2: Verify nothing breaks**

Run: `bun test`
Expected: All existing tests pass (no behavior change)

**Step 3: Commit**

```bash
git add src/render/code.ts
git commit -m "refactor: export language detection helper from code renderer"
```

---

### Task 4: Generate highlighted snippets in pages.ts

**Files:**
- Modify: `src/routes/pages.ts:20-46`
- Modify: `src/templates/bucket.tsx:63` (signature change)

**Step 1: Update pages.ts to read and highlight snippets**

In `src/routes/pages.ts`, add imports at the top:

```typescript
import { highlightCode, getLangForFile } from "../render/code";
```

In the bucket page route handler (lines 27-44), after `const files = listFiles(...)` and before the `return new Response(bucketPage(...))`, add snippet generation:

```typescript
    // Generate syntax-highlighted snippets for text/code files
    const snippets = new Map<string, string>();
    const SNIPPET_BYTES = 500;
    await Promise.all(
      files.map(async (f) => {
        const lang = getLangForFile(f.path);
        if (!lang) return;
        try {
          const bunFile = readFile(params.bucketId, f.path);
          if (!(await bunFile.exists())) return;
          const slice = bunFile.slice(0, SNIPPET_BYTES);
          const text = await slice.text();
          const html = await highlightCode(text, lang);
          snippets.set(f.path, html);
        } catch {
          // Skip files that can't be read
        }
      })
    );
```

Update the `bucketPage` call to pass snippets:

```typescript
    return new Response(bucketPage(bucket, files, readmeHtml, snippets), {
```

**Step 2: Update bucketPage signature**

In `src/templates/bucket.tsx`, change the `bucketPage` function signature from:

```typescript
export function bucketPage(bucket: BucketRow, files: FileRow[], readmeHtml?: string): string {
```

to:

```typescript
export function bucketPage(bucket: BucketRow, files: FileRow[], readmeHtml?: string, snippets?: Map<string, string>): string {
```

And pass snippets to `GridCard` in the `gridCards` line (line 90):

```typescript
    const gridCards = files.map((f) => <GridCard bucketId={bucket.id} f={f} snippet={snippets?.get(f.path)} />).join("");
```

**Step 3: Verify it compiles and existing tests pass**

Run: `bun test`
Expected: All pass (snippet param is optional, no behavior change yet)

**Step 4: Commit**

```bash
git add src/routes/pages.ts src/templates/bucket.tsx
git commit -m "feat: generate syntax-highlighted snippets for grid preview"
```

---

### Task 5: Render code previews and video elements in GridCard

**Files:**
- Modify: `src/templates/bucket.tsx:36-61` (GridCard function)
- Modify: `src/styles/bucket.module.css`

**Step 1: Add CSS styles for code preview and video**

Append to `src/styles/bucket.module.css` (after `.gridDownload:hover` on line 43):

```css
/* Code snippet preview */
.gridCodePreview { position: relative; width: 100%; height: 100%; overflow: hidden; padding: 6px; font-size: 7px; line-height: 1.3; pointer-events: none; }
.gridCodePreview pre { margin: 0; padding: 0 !important; background: transparent !important; font-size: inherit; line-height: inherit; }
.gridCodePreview code { font-size: inherit !important; line-height: inherit !important; }
.gridCodePreview .line { white-space: pre; }
.gridCodeFade { position: absolute; bottom: 0; left: 0; right: 0; height: 40%; background: linear-gradient(transparent, rgba(0,0,0,0.5)); pointer-events: none; }
/* Video preview */
.gridVideoPreview { width: 100%; height: 100%; object-fit: cover; }
```

**Step 2: Update GridCard to render code snippets and video previews**

Replace the `GridCard` function in `src/templates/bucket.tsx`. The function accepts a `snippet` prop (highlighted HTML string). For images, it renders an `<img>` thumbnail. For videos, it renders a `<video>` element with `preload="metadata"`. For text/code files with a snippet, it renders the highlighted HTML in a code preview container with a fade gradient. For all other files, it falls back to the emoji icon.

The preview HTML is all server-generated from trusted content: Shiki's `codeToHtml` for code snippets (which internally escapes code via its own tokenizer), `Bun.escapeHTML`-escaped URLs, and static video/image tags.

```typescript
function GridCard({ bucketId, f, snippet }: { bucketId: string; f: FileRow; snippet?: string; children?: unknown }) {
  const isImage = isImageFile(f.path);
  const isVideo = f.mime_type.startsWith("video/");
  const thumbUrl = `/api/buckets/${bucketId}/thumb/${encodeFilePath(f.path)}`;
  const rawUrl = `/raw/${bucketId}/${encodeFilePath(f.path)}`;
  const icon = fileIcon(f.mime_type);

  let previewHtml: string;
  if (isImage) {
    const img = `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(f.path)}" loading="lazy" class="${bucketStyles.gridPreviewImg}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`;
    const fallback = `<div class="${bucketStyles.gridIcon}" style="display:none">${icon}</div>`;
    previewHtml = img + fallback;
  } else if (isVideo) {
    previewHtml = `<video src="${escapeHtml(rawUrl)}" preload="metadata" muted playsinline class="${bucketStyles.gridVideoPreview}"></video>`;
  } else if (snippet) {
    previewHtml = `<div class="${bucketStyles.gridCodePreview}">${snippet}<div class="${bucketStyles.gridCodeFade}"></div></div>`;
  } else {
    previewHtml = `<div class="${bucketStyles.gridIcon}">${icon}</div>`;
  }

  return (
    <div class={bucketStyles.gridItem} data-grid-item>
      <a href={`/${bucketId}/${encodeFilePath(f.path)}`} class={bucketStyles.gridPreviewLink}>
        <div class={bucketStyles.gridPreview} dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </a>
      <div class={bucketStyles.gridInfo}>
        <a href={`/${bucketId}/${encodeFilePath(f.path)}`} class={bucketStyles.gridName} data-grid-name>{escapeHtml(f.path)}</a>
        <div class={bucketStyles.gridMetaRow}>
          <span class={bucketStyles.gridMeta}>{formatBytes(f.size)}</span>
          <a href={rawUrl} download class={bucketStyles.gridDownload} title="Download">↓</a>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Write tests for snippet and video rendering**

Add to `test/templates.test.ts`:

```typescript
test("bucket page grid card renders code snippet when provided", () => {
  const bucket: BucketRow = {
    id: "test123456", name: "Test", description: "", purpose: "",
    owner_key_hash: "hash", created_at: Math.floor(Date.now() / 1000),
    expires_at: null, file_count: 1, total_size: 100,
  };
  const files: FileRow[] = [{
    id: 1, bucket_id: "test123456", path: "app.ts",
    size: 100, mime_type: "text/typescript",
    short_code: "abc123", version: 1, sha256: "sha",
    uploaded_at: Math.floor(Date.now() / 1000),
  }];
  const snippets = new Map<string, string>();
  snippets.set("app.ts", '<pre class="shiki"><code>const x = 1;</code></pre>');
  const html = bucketPage(bucket, files, undefined, snippets);
  expect(html).toContain("gridCodePreview");
  expect(html).toContain("const x = 1;");
  expect(html).toContain("gridCodeFade");
});

test("bucket page grid card renders video element for video files", () => {
  const bucket: BucketRow = {
    id: "test123456", name: "Test", description: "", purpose: "",
    owner_key_hash: "hash", created_at: Math.floor(Date.now() / 1000),
    expires_at: null, file_count: 1, total_size: 5000,
  };
  const files: FileRow[] = [{
    id: 1, bucket_id: "test123456", path: "clip.mp4",
    size: 5000, mime_type: "video/mp4",
    short_code: "vid123", version: 1, sha256: "sha",
    uploaded_at: Math.floor(Date.now() / 1000),
  }];
  const html = bucketPage(bucket, files);
  expect(html).toContain("<video");
  expect(html).toContain("preload");
  expect(html).toContain("gridVideoPreview");
  expect(html).toContain("clip.mp4");
});
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/templates/bucket.tsx src/styles/bucket.module.css test/templates.test.ts
git commit -m "feat: add syntax-highlighted code previews and video thumbnails to grid view"
```

---

### Task 6: Manual verification

**Step 1: Start the dev server**

Run: `bun --hot src/index.ts`

**Step 2: Upload test files to a bucket**

Upload a mix of files: a `.ts` file, a `.py` file, a `Dockerfile`, a `BucketService.cs`, an image, and a `.mp4` video.

**Step 3: Verify grid view**

- Switch to grid view
- Code files should show syntax-highlighted previews with a fade-out
- `Dockerfile` should show a code preview (not a folder icon)
- `BucketService.cs` should show a C# code preview (not a folder icon)
- Video files should show the first frame
- Images should still show thumbnails as before
- Binary files should show the document icon (not folder)

**Step 4: Commit any adjustments if needed**
