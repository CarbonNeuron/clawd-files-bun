import { config } from "./config";
import { getDb } from "./db";
import { ensureDataDirs } from "./storage";
import { matchRoute } from "./router";
import { registerKeyRoutes } from "./routes/keys";
import { registerBucketRoutes } from "./routes/buckets";
import { registerFileRoutes } from "./routes/files";
import { registerUploadLinkRoutes } from "./routes/upload-links";
import { registerShortRoutes } from "./routes/short";
import { registerPageRoutes } from "./routes/pages";
import { registerDocRoutes } from "./routes/docs";
import { buildStyles } from "./render/styles";
import { preloadHighlighter } from "./render/code";
import { startCleanupLoop, startStatsAggregation } from "./cleanup";

// Import all renderers to register them
import "./render/index";

// Ensure data directories exist
await ensureDataDirs();

// Initialize database
getDb();

// Build CSS and preload Shiki in parallel
const [styles] = await Promise.all([
  buildStyles(),
  preloadHighlighter(),
]);

// Build site CSS
const siteCssResult = await Bun.build({
  entrypoints: ["./src/render/styles/site.css"],
  minify: true,
});
const siteCss = await siteCssResult.outputs[0].text();
const siteCssEtag = Bun.hash(siteCss).toString(16);

// Register all routes (order matters — API routes first, then catch-all page routes)
registerKeyRoutes();
registerBucketRoutes();
registerFileRoutes();
registerUploadLinkRoutes();
registerShortRoutes();
registerDocRoutes();
registerPageRoutes(); // Must be last — catch-all patterns

// Start background tasks
startCleanupLoop();
startStatsAggregation();

const server = Bun.serve({
  port: config.port,

  routes: {
    "/health": new Response("ok"),
    "/static/htmx.min.js": () => new Response(Bun.file("src/static/htmx.min.js"), {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=31536000, immutable" },
    }),
    "/render/styles.css": () => {
      return new Response(styles.css, {
        headers: {
          "Content-Type": "text/css",
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: styles.etag,
        },
      });
    },
    "/site/styles.css": () => {
      return new Response(siteCss, {
        headers: {
          "Content-Type": "text/css",
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: siteCssEtag,
        },
      });
    },
  },

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const wsMatch = url.pathname.match(/^\/ws\/bucket\/(.+)$/);
      if (wsMatch) {
        const upgraded = server.upgrade(req, { data: { bucketId: wsMatch[1] } });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return new Response("Bad WebSocket path", { status: 400 });
    }

    // Match against registered routes
    const route = matchRoute(req.method, url.pathname);
    if (route) {
      try {
        return await route.handler(req, route.params);
      } catch (err) {
        console.error(`Error handling ${req.method} ${url.pathname}:`, err);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      const { bucketId } = ws.data as { bucketId: string };
      if (bucketId) {
        ws.subscribe(`bucket:${bucketId}`);
      }
    },
    message(ws, message) {
      try {
        const msg = JSON.parse(String(message));
        if (msg.type === "subscribe" && msg.bucketId) {
          ws.subscribe(`bucket:${msg.bucketId}`);
        }
      } catch {
        // Ignore invalid messages
      }
    },
    close(_ws) {
      // Cleanup handled by Bun
    },
  },
});

console.log(`ClawdFiles v4 running at http://localhost:${server.port}`);

export { server };
