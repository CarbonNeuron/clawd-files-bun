import { config } from "./config";
import { getDb } from "./db";
import { ensureDataDirs } from "./storage";
import { matchRoute } from "./router";
import { registerKeyRoutes } from "./routes/keys";
import { registerBucketRoutes } from "./routes/buckets";
import { registerFileRoutes } from "./routes/files";
import { registerUploadLinkRoutes } from "./routes/upload-links";
import { registerShortRoutes } from "./routes/short";

// Ensure data directories exist
await ensureDataDirs();

// Initialize database
getDb();

// Register all routes
registerKeyRoutes();
registerBucketRoutes();
registerFileRoutes();
registerUploadLinkRoutes();
registerShortRoutes();

const server = Bun.serve({
  port: config.port,

  routes: {
    "/health": new Response("ok"),
    "/static/htmx.min.js": () => new Response(Bun.file("src/static/htmx.min.js"), {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=31536000, immutable" },
    }),
  },

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const wsMatch = url.pathname.match(/^\/ws\/bucket\/(.+)$/);
      if (wsMatch) {
        server.upgrade(req, { data: { bucketId: wsMatch[1] } });
        return undefined;
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

    return Response.json({ error: "Not found" }, { status: 404 });
  },

  websocket: {
    open(ws) {
      const { bucketId } = ws.data as { bucketId: string };
      if (bucketId) {
        ws.subscribe(`bucket:${bucketId}`);
      }
    },
    message(ws, message) {
      // Handle subscribe commands
      try {
        const msg = JSON.parse(String(message));
        if (msg.type === "subscribe" && msg.bucketId) {
          ws.subscribe(`bucket:${msg.bucketId}`);
        }
      } catch {
        // Ignore invalid messages
      }
    },
    close(ws) {
      // Cleanup handled by Bun
    },
  },
});

console.log(`ClawdFiles v4 running at http://localhost:${server.port}`);

export { server };
