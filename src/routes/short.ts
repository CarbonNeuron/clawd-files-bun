import { addRoute } from "../router";
import { getDb, getFileByShortCode } from "../db";
import { config } from "../config";

export function registerShortRoutes() {
  addRoute("GET", "/s/:code", async (_req, params) => {
    const db = getDb();
    const file = getFileByShortCode(db, params.code);
    if (!file) {
      return new Response("Not Found", { status: 404 });
    }

    const rawUrl = `${config.baseUrl}/raw/${file.bucket_id}/${file.path}`;
    const filename = file.path.split("/").pop() ?? file.path;

    return new Response(null, {
      status: 307,
      headers: {
        Location: rawUrl,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
