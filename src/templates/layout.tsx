import { Raw } from "../jsx/jsx-runtime";
import { config } from "../config";
import { cssText } from "../css-text";
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
        <style><Raw html={cssText(baseStyles, "base") + cssText(layoutStyles, "layout")} /></style>
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

export { baseStyles, layoutStyles };
