import { addRoute } from "../router";
import { validateRequest } from "../auth";
import {
  getDb,
  createBucket,
  getBucket,
  listBucketsByOwner,
  listAllBuckets,
  updateBucket,
  deleteBucket,
  listFiles,
  updateBucketStats,
} from "../db";
import { deleteBucketDir } from "../storage";
import { generateBucketId, parseExpiresIn, wantsJson } from "../utils";

export function registerBucketRoutes() {
  // Create bucket
  addRoute("POST", "/api/buckets", async (req) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    let body: { name?: string; description?: string; purpose?: string; expiresIn?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const id = generateBucketId();
    const expiresAt = body.expiresIn ? parseExpiresIn(body.expiresIn) : null;

    createBucket(db, id, body.name, auth.keyHash, body.description, body.purpose, expiresAt);

    const bucket = getBucket(db, id);
    return Response.json({ bucket }, { status: 201 });
  });

  // List buckets
  addRoute("GET", "/api/buckets", async (req) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const buckets = auth.isAdmin
      ? listAllBuckets(db)
      : listBucketsByOwner(db, auth.keyHash);

    return Response.json({ buckets });
  });

  // Get bucket detail
  addRoute("GET", "/api/buckets/:id", async (req, params) => {
    const db = getDb();
    const bucket = getBucket(db, params.id);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    const files = listFiles(db, params.id);

    if (wantsJson(req)) {
      return Response.json({ bucket, files });
    }

    // HTML response will be handled by page routes (Phase 3)
    return Response.json({ bucket, files });
  });

  // Update bucket
  addRoute("PATCH", "/api/buckets/:id", async (req, params) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const bucket = getBucket(db, params.id);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    if (!auth.isAdmin && bucket.owner_key_hash !== auth.keyHash) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { name?: string; description?: string; purpose?: string; expiresIn?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const fields: Record<string, string | number | null> = {};
    if (body.name) fields.name = body.name;
    if (body.description !== undefined) fields.description = body.description;
    if (body.purpose !== undefined) fields.purpose = body.purpose;
    if (body.expiresIn !== undefined) {
      fields.expires_at = body.expiresIn ? parseExpiresIn(body.expiresIn) : null;
    }

    updateBucket(db, params.id, fields);
    const updated = getBucket(db, params.id);
    return Response.json({ bucket: updated });
  });

  // Delete bucket
  addRoute("DELETE", "/api/buckets/:id", async (req, params) => {
    const db = getDb();
    const auth = validateRequest(req, db);
    if (!auth.authenticated) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const bucket = getBucket(db, params.id);
    if (!bucket) {
      return Response.json({ error: "Bucket not found" }, { status: 404 });
    }

    if (!auth.isAdmin && bucket.owner_key_hash !== auth.keyHash) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from disk and DB (CASCADE handles files)
    await deleteBucketDir(params.id);
    deleteBucket(db, params.id);

    return Response.json({ deleted: true });
  });
}
