import type { BundledLanguage } from "shiki";
import { registerRenderer } from "./registry";

let highlighterPromise: ReturnType<typeof import("shiki")["createHighlighter"]> | null = null;

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "jsx",
  ".py": "python", ".rb": "ruby", ".rs": "rust", ".go": "go",
  ".java": "java", ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
  ".cs": "csharp", ".php": "php", ".swift": "swift", ".kt": "kotlin",
  ".sh": "bash", ".bash": "bash", ".zsh": "bash",
  ".sql": "sql", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
  ".json": "json", ".xml": "xml", ".html": "html", ".css": "css",
  ".md": "markdown", ".r": "r", ".lua": "lua", ".zig": "zig",
  ".dockerfile": "dockerfile",
  ".graphql": "graphql", ".vue": "vue", ".svelte": "svelte",
  ".env": "bash", ".gitignore": "text",
};

// Extensionless files mapped by exact filename
const FILENAME_TO_LANG: Record<string, string> = {
  "Dockerfile": "dockerfile",
  "Makefile": "makefile",
  "Rakefile": "ruby",
  "Gemfile": "ruby",
  "Justfile": "makefile",
  "Vagrantfile": "ruby",
  "Procfile": "bash",
  ".bashrc": "bash",
  ".zshrc": "bash",
  ".profile": "bash",
  ".gitignore": "text",
  ".gitattributes": "text",
  ".editorconfig": "ini",
  ".env": "bash",
  ".env.example": "bash",
};

const CODE_EXTENSIONS = Object.keys(EXT_TO_LANG);
const CODE_FILENAMES = Object.keys(FILENAME_TO_LANG);

async function getHighlighter() {
  if (!highlighterPromise) {
    const { createHighlighter } = await import("shiki");
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: [...new Set(Object.values(EXT_TO_LANG))] as BundledLanguage[],
    });
  }
  return highlighterPromise;
}

export async function preloadHighlighter() {
  await getHighlighter();
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  try {
    const highlighter = await getHighlighter();
    return highlighter.codeToHtml(code, {
      lang: lang as BundledLanguage,
      theme: "github-dark",
    });
  } catch {
    // Fallback: plain pre block
    return `<pre class="shiki" style="background-color:#24292e;color:#e1e4e8"><code>${Bun.escapeHTML(code)}</code></pre>`;
  }
}

export async function codeRenderer(content: Buffer, filename: string): Promise<string> {
  const basename = filename.split("/").pop() ?? filename;
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  const lang = FILENAME_TO_LANG[basename] ?? EXT_TO_LANG[ext] ?? "text";
  const code = content.toString("utf-8");
  const html = await highlightCode(code, lang);
  return `<div class="lumen-code">${html}</div>`;
}

export { EXT_TO_LANG, FILENAME_TO_LANG };

export function getLangForFile(filename: string): string | null {
  const basename = filename.split("/").pop() ?? filename;
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return FILENAME_TO_LANG[basename] ?? EXT_TO_LANG[ext] ?? null;
}

// Register for all code file extensions
const codeMimeTypes = [
  "text/typescript", "text/javascript", "application/javascript",
  "text/x-python", "text/x-ruby", "text/x-rust", "text/x-go",
  "text/x-java", "text/x-c", "text/x-c++", "text/x-php",
  "text/x-swift", "text/x-kotlin", "text/x-sh",
  "text/x-sql", "text/yaml", "text/toml",
  "text/html", "text/css", "text/x-r", "text/x-lua", "text/x-zig",
];

registerRenderer(codeMimeTypes, [...CODE_EXTENSIONS, ...CODE_FILENAMES], codeRenderer);
