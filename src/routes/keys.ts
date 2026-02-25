import { addRoute } from "../router";
import { validateRequest, generateApiKey } from "../auth";
import { getDb, insertApiKey, listApiKeys, deleteApiKey } from "../db";

export function registerKeyRoutes() {
  addRoute("POST", "/api/keys", async (req) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }
    if (!auth.isAdmin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    let body: { name?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const { key, prefix, keyHash } = generateApiKey();
    insertApiKey(db, prefix, keyHash, body.name);

    return Response.json({ key, prefix, name: body.name }, { status: 201 });
  });

  addRoute("GET", "/api/keys", async (req) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }
    if (!auth.isAdmin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const keys = listApiKeys(db);
    return Response.json({ keys });
  });

  addRoute("DELETE", "/api/keys/:prefix", async (req, params) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }
    if (!auth.isAdmin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const result = deleteApiKey(db, params.prefix);
    if (result.changes === 0) {
      return Response.json({ error: "Key not found" }, { status: 404 });
    }

    return Response.json({ deleted: true });
  });
}
