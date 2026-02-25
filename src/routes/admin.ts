import { addRoute } from "../router";
import { validateRequest, generateAdminToken, validateAdminToken } from "../auth";
import {
  getDb,
  listApiKeys,
  listAllBuckets,
  aggregateCurrentStats,
  getDailyStatsRange,
} from "../db";
import { config } from "../config";
import { adminPage } from "../templates/admin";

export function registerAdminRoutes() {
  // Generate admin dashboard link
  addRoute("POST", "/api/admin/dashboard-link", async (req) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }
    if (!auth.isAdmin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24h
    const token = generateAdminToken(expiresAt);
    const url = `${config.baseUrl}/admin?token=${token}`;

    return Response.json({ url, expiresAt }, { status: 201 });
  });

  // Admin dashboard page
  addRoute("GET", "/admin", async (req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 401 });
    }

    const result = validateAdminToken(token);
    if (!result.valid) {
      return new Response(`Access denied: ${result.error}`, { status: 401 });
    }

    const db = getDb();
    const stats = aggregateCurrentStats(db);
    const keys = listApiKeys(db);
    const buckets = listAllBuckets(db);

    const html = adminPage(
      {
        totalBuckets: stats?.total_buckets ?? 0,
        totalFiles: stats?.total_files ?? 0,
        totalSize: stats?.total_size ?? 0,
        keyCount: keys.length,
      },
      keys,
      buckets
    );

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
}
