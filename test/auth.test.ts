import { test, expect } from "bun:test";
import {
  generateApiKey,
  hashKey,
  parseKey,
  validateRequest,
  generateUploadToken,
  validateUploadToken,
} from "../src/auth";
import { createTestDb, insertApiKey } from "../src/db";

test("generateApiKey returns valid format", () => {
  const { key, prefix, keyHash } = generateApiKey();
  expect(key).toMatch(/^cf4_[0-9a-f]{8}_[0-9a-f]{32}$/);
  expect(prefix).toHaveLength(8);
  expect(keyHash).toHaveLength(64);
});

test("hashKey returns consistent SHA256 hex", () => {
  const hash1 = hashKey("cf4_12345678_abcdef0123456789abcdef0123456789");
  const hash2 = hashKey("cf4_12345678_abcdef0123456789abcdef0123456789");
  expect(hash1).toBe(hash2);
  expect(hash1).toHaveLength(64);
  expect(hash1).toMatch(/^[0-9a-f]+$/);
});

test("parseKey validates format", () => {
  const result = parseKey("cf4_12345678_abcdef0123456789abcdef0123456789");
  expect(result).not.toBeNull();
  expect(result!.prefix).toBe("12345678");

  expect(parseKey("invalid")).toBeNull();
  expect(parseKey("cf4_short_key")).toBeNull();
  expect(parseKey("")).toBeNull();
});

test("validateRequest with admin key", () => {
  const db = createTestDb();
  const req = new Request("http://localhost/test", {
    headers: { authorization: "Bearer dev-admin-key-change-in-production" },
  });
  const result = validateRequest(req, db);
  expect(result.authenticated).toBe(true);
  if (result.authenticated) {
    expect(result.isAdmin).toBe(true);
  }
});

test("validateRequest with valid API key", () => {
  const db = createTestDb();
  const { key, prefix, keyHash } = generateApiKey();
  insertApiKey(db, prefix, keyHash, "Test Key");

  const req = new Request("http://localhost/test", {
    headers: { authorization: `Bearer ${key}` },
  });
  const result = validateRequest(req, db);
  expect(result.authenticated).toBe(true);
  if (result.authenticated) {
    expect(result.isAdmin).toBe(false);
    expect(result.keyHash).toBe(keyHash);
  }
});

test("validateRequest without auth header", () => {
  const db = createTestDb();
  const req = new Request("http://localhost/test");
  const result = validateRequest(req, db);
  expect(result.authenticated).toBe(false);
});

test("validateRequest with invalid key", () => {
  const db = createTestDb();
  const req = new Request("http://localhost/test", {
    headers: { authorization: "Bearer cf4_00000000_00000000000000000000000000000000" },
  });
  const result = validateRequest(req, db);
  expect(result.authenticated).toBe(false);
});

test("generateUploadToken and validateUploadToken round-trip", () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = generateUploadToken("bucket123", expiresAt);
  expect(token).toBeTruthy();

  const result = validateUploadToken(token);
  expect(result.valid).toBe(true);
  if (result.valid) {
    expect(result.bucketId).toBe("bucket123");
  }
});

test("validateUploadToken rejects expired token", () => {
  const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  const token = generateUploadToken("bucket123", expiresAt);
  const result = validateUploadToken(token);
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.error).toBe("Token expired");
  }
});

test("validateUploadToken rejects tampered token", () => {
  const result = validateUploadToken("dGFtcGVyZWQ6MTIzNDU2Nzg5MDpmYWtlc2ln");
  expect(result.valid).toBe(false);
});
