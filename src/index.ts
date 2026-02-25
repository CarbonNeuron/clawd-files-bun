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
import { registerTableViewerRoutes } from "./routes/table-viewer";
import { buildStyles, buildSiteStyles } from "./render/styles";
import { preloadHighlighter } from "./render/code";
import { startCleanupLoop, startStatsAggregation } from "./cleanup";
import { setServer } from "./websocket";
import * as log from "./logger";

// Import all renderers to register them
import "./render/index";

// Ensure data directories exist
await ensureDataDirs();
log.info("Data directories ready");

// Initialize database
getDb();
log.info("Database initialized");

// Build CSS and preload Shiki in parallel
const [styles, siteStyles] = await Promise.all([
  buildStyles(),
  buildSiteStyles(),
  preloadHighlighter(),
]);
log.info("CSS built, Shiki loaded");

const combinedCss = styles.css + "\n" + siteStyles.css;
const combinedCssEtag = Bun.hash(combinedCss).toString(16);

// Register all routes (order matters — API routes first, then catch-all page routes)
registerKeyRoutes();
registerBucketRoutes();
registerFileRoutes();
registerUploadLinkRoutes();
registerShortRoutes();
registerDocRoutes();
registerTableViewerRoutes();
registerPageRoutes(); // Must be last — catch-all patterns
log.info("Routes registered");

// Start background tasks
startCleanupLoop();
startStatsAggregation();
log.info("Background tasks started");

const server = Bun.serve({
  port: config.port,

  routes: {
    "/health": new Response("ok"),
    "/static/htmx.min.js": () => new Response(Bun.file("src/static/htmx.min.js"), {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=31536000, immutable" },
    }),
    "/styles.css": () => {
      return new Response(combinedCss, {
        headers: {
          "Content-Type": "text/css",
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: combinedCssEtag,
        },
      });
    },
  },

  async fetch(req, server) {
    const start = performance.now();
    const url = new URL(req.url);

    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const wsMatch = url.pathname.match(/^\/ws\/bucket\/(.+)$/);
      if (wsMatch) {
        const upgraded = server.upgrade(req, { data: { bucketId: wsMatch[1] } });
        if (upgraded) {
          log.debug(`WS upgrade ${url.pathname}`);
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return new Response("Bad WebSocket path", { status: 400 });
    }

    // Match against registered routes
    const route = matchRoute(req.method, url.pathname);
    if (route) {
      try {
        const res = await route.handler(req, route.params);
        log.request(req.method, url.pathname, res.status, performance.now() - start);
        return res;
      } catch (err) {
        log.error(`${req.method} ${url.pathname}`, err);
        log.request(req.method, url.pathname, 500, performance.now() - start);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    log.request(req.method, url.pathname, 404, performance.now() - start);
    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      const { bucketId } = ws.data as { bucketId: string };
      if (bucketId) {
        ws.subscribe(`bucket:${bucketId}`);
        log.debug(`WS open bucket:${bucketId}`);
      }
    },
    message(ws, message) {
      try {
        const msg = JSON.parse(String(message));
        if (msg.type === "subscribe" && msg.bucketId) {
          ws.subscribe(`bucket:${msg.bucketId}`);
          log.debug(`WS subscribe bucket:${msg.bucketId}`);
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

setServer(server);
log.info(`ClawdFiles v4 running at http://localhost:${server.port}`);

export { server };
