import { config } from "../config";

type LayoutOptions = {
  title: string;
  content: string;
  scripts?: string;
  head?: string;
};

export function layout({ title, content, scripts, head }: LayoutOptions): string {
  const safeTitle = Bun.escapeHTML(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} — ClawdFiles</title>
  <link rel="stylesheet" href="/styles.css">
  ${head ?? ""}
</head>
<body>
  <nav class="nav">
    <div class="container nav-inner">
      <a href="/" class="nav-logo">ClawdFiles<span>.v4</span></a>
      <div class="nav-links">
        <a href="/docs">API Docs</a>
        <a href="/llms.txt">llms.txt</a>
      </div>
    </div>
  </nav>
  <main class="container">
    ${content}
  </main>
  <footer class="footer">
    <div class="container">ClawdFiles v4 &mdash; ${Bun.escapeHTML(config.baseUrl)}</div>
  </footer>
  <script src="/static/htmx.min.js"></script>
  ${scripts ?? ""}
</body>
</html>`;
}
