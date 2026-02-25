# ClawdFiles v4 — Design Document

**Date:** 2026-02-24
**Status:** Approved

## Summary

File hosting service built entirely on Bun. Single process, SQLite for data, disk for files, server-rendered HTML with htmx for interactivity, native WebSocket for live updates, Shiki for syntax highlighting. Under 20KB client JS.

## Design

The full design specification is maintained in the project README/spec provided by the user. Key architectural decisions:

1. **Single Bun process** — `Bun.serve()` handles HTTP + WebSocket in one call
2. **SQLite via `bun:sqlite`** — api_keys, buckets, files, file_versions, daily_stats tables
3. **Server-rendered HTML** — tagged template literals, no client framework
4. **htmx** (14KB gzipped) — form submissions, search, delete confirmations, partial page swaps
5. **Native WebSocket** — live bucket updates (file added/removed)
6. **Render engine** — built-in module for code (Shiki), markdown (markdown-it), CSV (papaparse + SQLite for large files), JSON (recursive details/summary), SVG (sanitized), images (sharp), PDF (placeholder)
7. **Content negotiation** — same URL serves HTML (browser) or JSON (API/CLI)
8. **Abyssal Terminal** visual identity — deep-sea research station aesthetic
9. **Upload links** — pre-signed URLs with HMAC tokens for auth-free uploads
10. **File versioning** — re-upload same filename increments version, all versions accessible

## Dependencies

- `shiki` — syntax highlighting
- `markdown-it` — markdown rendering
- `papaparse` — CSV parsing
- `sharp` — image resizing
- `fast-xml-parser` — SVG sanitization
- `htmx.org` — client-side interactivity (static file)
- `archiver` or equivalent — streaming ZIP creation

## Implementation Approach

Build all modules in parallel, wire together at the end. Priority is getting the full system functional simultaneously rather than incremental vertical slices.
