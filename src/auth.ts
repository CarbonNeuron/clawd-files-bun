import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { getApiKeyByHash, updateApiKeyLastUsed } from "./db";
import type { Database } from "bun:sqlite";

const KEY_PREFIX = "cf4_";

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const prefixBytes = crypto.getRandomValues(new Uint8Array(4));
  const secretBytes = crypto.getRandomValues(new Uint8Array(16));
  const prefix = Array.from(prefixBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const secret = Array.from(secretBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const key = `${KEY_PREFIX}${prefix}_${secret}`;
  const keyHash = hashKey(key);
  return { key, prefix, keyHash };
}

export function hashKey(key: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(key);
  return hasher.digest("hex");
}

export function parseKey(key: string): { prefix: string; secret: string } | null {
  const match = key.match(/^cf4_([0-9a-f]{8})_([0-9a-f]{32})$/);
  if (!match) return null;
  return { prefix: match[1], secret: match[2] };
}

export type AuthResult =
  | { authenticated: true; isAdmin: boolean; keyHash: string; keyName: string }
  | { authenticated: false; error: string };

export function validateRequest(req: Request, db: Database): AuthResult {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { authenticated: false, error: "Missing Authorization header" };
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!token) {
    return { authenticated: false, error: "Empty token" };
  }

  // Check admin key first
  if (config.adminKey && token === config.adminKey) {
    return { authenticated: true, isAdmin: true, keyHash: "__admin__", keyName: "admin" };
  }

  // Validate API key format
  const parsed = parseKey(token);
  if (!parsed) {
    return { authenticated: false, error: "Invalid key format" };
  }

  const keyHash = hashKey(token);
  const keyRecord = getApiKeyByHash(db, keyHash);
  if (!keyRecord) {
    return { authenticated: false, error: "Invalid API key" };
  }

  updateApiKeyLastUsed(db, keyHash);
  return { authenticated: true, isAdmin: false, keyHash, keyName: keyRecord.name };
}

// ---- Upload Token (HMAC) ----

function getHmacSecret(): string {
  if (!config.adminKey) {
    throw new Error("ADMIN_KEY is required for HMAC operations");
  }
  return config.adminKey;
}

export function generateUploadToken(bucketId: string, expiresAt: number): string {
  const payload = `${bucketId}:${expiresAt}`;
  const secret = getHmacSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  const token = Buffer.from(`${payload}:${signature}`).toString("base64url");
  return token;
}

export function validateUploadToken(token: string): { valid: true; bucketId: string } | { valid: false; error: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return { valid: false, error: "Invalid token encoding" };
  }

  const parts = decoded.split(":");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token format" };
  }

  const [bucketId, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  // Verify signature using constant-time comparison
  const payload = `${bucketId}:${expiresAt}`;
  const secret = getHmacSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, error: "Invalid token signature" };
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) {
    return { valid: false, error: "Token expired" };
  }

  return { valid: true, bucketId };
}
