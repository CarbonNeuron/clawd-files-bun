import MarkdownIt from "markdown-it";
import { registerRenderer } from "./registry";
import { highlightCode } from "./code";
import type { RenderContext } from "./registry";

// Two-pass rendering: collect code blocks, batch highlight, substitute
const PLACEHOLDER_PREFIX = "%%SHIKI_BLOCK_";
const PLACEHOLDER_SUFFIX = "%%";

async function markdownRenderer(
  content: Buffer,
  filename: string,
  context?: RenderContext
): Promise<string> {
  const source = content.toString("utf-8");
  const codeBlocks: Array<{ id: number; code: string; lang: string }> = [];
  let blockId = 0;

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight(str, lang) {
      const id = blockId++;
      codeBlocks.push({ id, code: str, lang: lang || "text" });
      return `${PLACEHOLDER_PREFIX}${id}${PLACEHOLDER_SUFFIX}`;
    },
  });

  // Custom link and image rewriting rules
  if (context?.bucketId) {
    const bucketId = context.bucketId;

    function rewriteUrl(href: string): string {
      if (href.startsWith("./") || (!href.startsWith("../") && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("/"))) {
        const cleanPath = href.startsWith("./") ? href.slice(2) : href;
        if (/\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mp3|wav|pdf)$/i.test(cleanPath)) {
          return `/raw/${bucketId}/${cleanPath}`;
        }
        return `/${bucketId}/${cleanPath}`;
      }
      return href;
    }

    const defaultLinkRender = md.renderer.rules.link_open ||
      function (tokens: any, idx: any, options: any, _env: any, self: any) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const hrefIdx = tokens[idx].attrIndex("href");
      if (hrefIdx >= 0) {
        tokens[idx].attrs![hrefIdx][1] = rewriteUrl(tokens[idx].attrs![hrefIdx][1]);
      }
      return defaultLinkRender(tokens, idx, options, env, self);
    };

    const defaultImageRender = md.renderer.rules.image ||
      function (tokens: any, idx: any, options: any, _env: any, self: any) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.image = function (tokens, idx, options, env, self) {
      const srcIdx = tokens[idx].attrIndex("src");
      if (srcIdx >= 0) {
        tokens[idx].attrs![srcIdx][1] = rewriteUrl(tokens[idx].attrs![srcIdx][1]);
      }
      return defaultImageRender(tokens, idx, options, env, self);
    };
  }

  let html = md.render(source);

  // Batch highlight all code blocks
  const highlighted = await Promise.all(
    codeBlocks.map(async ({ id, code, lang }) => {
      const result = await highlightCode(code, lang);
      return { id, html: result };
    })
  );

  // Substitute placeholders — markdown-it wraps in <pre><code class="language-X">
  for (const { id, html: blockHtml } of highlighted) {
    const placeholder = `${PLACEHOLDER_PREFIX}${id}${PLACEHOLDER_SUFFIX}`;
    // Match the full <pre><code ...>PLACEHOLDER\n</code></pre> wrapper with any attributes
    const wrapperRe = new RegExp(
      `<pre><code[^>]*>${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?</code></pre>`,
    );
    html = html.replace(wrapperRe, blockHtml);
    // Fallback: bare placeholder (shouldn't happen, but safe)
    html = html.replace(placeholder, blockHtml);
  }

  return `<div class="lumen-markdown">${html}</div>`;
}

registerRenderer(["text/markdown"], [".md", ".markdown", ".mdx"], markdownRenderer);
