import { Raw } from "../jsx/jsx-runtime";
import { config } from "../config";
import { cssText, hasPrebuiltStylesheet, getPrebuiltCss } from "../css-text";
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
        <link rel="icon" href={`data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='80' font-size='80'>🦀</text></svg>")}`} />
        {hasPrebuiltStylesheet()
          ? <style><Raw html={getPrebuiltCss()} /></style>
          : <style><Raw html={cssText(baseStyles, "base") + cssText(layoutStyles, "layout")} /></style>}
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
          <div class={baseStyles.container}>ClawdFiles v4 &mdash; {Bun.escapeHTML(config.baseUrl)}{config.commitHash !== "dev" ? ` · commit ${config.commitHash.slice(0, 7)}` : ""}</div>
        </footer>
        {scripts ? <Raw html={scripts} /> : null}
      </body>
    </html>
  );
}

export { baseStyles, layoutStyles };
