import { test, expect, beforeEach } from "bun:test";
import {
  createTestDb,
  insertApiKey,
  getApiKeyByHash,
  listApiKeys,
  deleteApiKey,
  updateApiKeyLastUsed,
  createBucket,
  getBucket,
  listBucketsByOwner,
  listAllBuckets,
  updateBucket,
  deleteBucket,
  getExpiredBuckets,
  updateBucketStats,
  upsertFile,
  getFile,
  getFileByShortCode,
  listFiles,
  deleteFile,
  insertFileVersion,
  getFileVersions,
  upsertDailyStats,
  getDailyStatsRange,
  aggregateCurrentStats,
} from "../src/db";
import type { Database } from "bun:sqlite";

let db: Database;

beforeEach(() => {
  db = createTestDb();
});

// ---- API Keys ----

test("insertApiKey and getApiKeyByHash", () => {
  insertApiKey(db, "abc12345", "hash_abc", "Test Key");
  const key = getApiKeyByHash(db, "hash_abc");
  expect(key).not.toBeNull();
  expect(key!.prefix).toBe("abc12345");
  expect(key!.name).toBe("Test Key");
  expect(key!.last_used).toBeNull();
});

test("listApiKeys returns all keys", () => {
  insertApiKey(db, "key1xxxx", "hash_1", "Key 1");
  insertApiKey(db, "key2xxxx", "hash_2", "Key 2");
  const keys = listApiKeys(db);
  expect(keys).toHaveLength(2);
});

test("deleteApiKey removes key", () => {
  insertApiKey(db, "delkey00", "hash_del", "Delete Me");
  deleteApiKey(db, "delkey00");
  expect(getApiKeyByHash(db, "hash_del")).toBeNull();
});

test("updateApiKeyLastUsed sets timestamp", () => {
  insertApiKey(db, "usekey00", "hash_use", "Use Key");
  updateApiKeyLastUsed(db, "hash_use");
  const key = getApiKeyByHash(db, "hash_use");
  expect(key!.last_used).not.toBeNull();
});

// ---- Buckets ----

test("createBucket and getBucket", () => {
  insertApiKey(db, "owner000", "hash_owner", "Owner");
  createBucket(db, "bucket0001", "Test Bucket", "hash_owner", "A test bucket", "testing");
  const bucket = getBucket(db, "bucket0001");
  expect(bucket).not.toBeNull();
  expect(bucket!.name).toBe("Test Bucket");
  expect(bucket!.description).toBe("A test bucket");
  expect(bucket!.purpose).toBe("testing");
  expect(bucket!.file_count).toBe(0);
});

test("listBucketsByOwner filters by owner", () => {
  insertApiKey(db, "own1xxxx", "hash_own1", "Owner 1");
  insertApiKey(db, "own2xxxx", "hash_own2", "Owner 2");
  createBucket(db, "b1xxxxxxxx", "Bucket 1", "hash_own1");
  createBucket(db, "b2xxxxxxxx", "Bucket 2", "hash_own2");
  const buckets = listBucketsByOwner(db, "hash_own1");
  expect(buckets).toHaveLength(1);
  expect(buckets[0].name).toBe("Bucket 1");
});

test("updateBucket modifies fields", () => {
  insertApiKey(db, "upd00000", "hash_upd", "Updater");
  createBucket(db, "bupd000000", "Original", "hash_upd");
  updateBucket(db, "bupd000000", { name: "Updated", description: "New desc" });
  const bucket = getBucket(db, "bupd000000");
  expect(bucket!.name).toBe("Updated");
  expect(bucket!.description).toBe("New desc");
});

test("deleteBucket cascades to files", () => {
  insertApiKey(db, "cas00000", "hash_cas", "Cascade");
  createBucket(db, "bcas000000", "Cascade Bucket", "hash_cas");
  upsertFile(db, "bcas000000", "test.txt", 100, "text/plain", "abc123", "sha_test");
  deleteBucket(db, "bcas000000");
  expect(getBucket(db, "bcas000000")).toBeNull();
  expect(getFile(db, "bcas000000", "test.txt")).toBeNull();
});

test("getExpiredBuckets returns expired buckets", () => {
  insertApiKey(db, "exp00000", "hash_exp", "Expirer");
  createBucket(db, "bexp000000", "Expired", "hash_exp", "", "", 1000);
  createBucket(db, "bfut000000", "Future", "hash_exp", "", "", Math.floor(Date.now() / 1000) + 86400);
  const expired = getExpiredBuckets(db);
  expect(expired).toHaveLength(1);
  expect(expired[0].id).toBe("bexp000000");
});

// ---- Files ----

test("upsertFile creates new file", () => {
  insertApiKey(db, "fil00000", "hash_fil", "Filer");
  createBucket(db, "bfil000000", "File Bucket", "hash_fil");
  upsertFile(db, "bfil000000", "hello.txt", 42, "text/plain", "sh1234", "sha_hello");
  const file = getFile(db, "bfil000000", "hello.txt");
  expect(file).not.toBeNull();
  expect(file!.size).toBe(42);
  expect(file!.version).toBe(1);
  expect(file!.short_code).toBe("sh1234");
});

test("upsertFile increments version on conflict", () => {
  insertApiKey(db, "ver00000", "hash_ver", "Versioner");
  createBucket(db, "bver000000", "Version Bucket", "hash_ver");
  upsertFile(db, "bver000000", "app.js", 100, "application/javascript", "v1code", "sha_v1");
  upsertFile(db, "bver000000", "app.js", 200, "application/javascript", "v2code", "sha_v2");
  const file = getFile(db, "bver000000", "app.js");
  expect(file!.version).toBe(2);
  expect(file!.size).toBe(200);
});

test("getFileByShortCode finds file", () => {
  insertApiKey(db, "shrt0000", "hash_shrt", "Shorter");
  createBucket(db, "bshrt00000", "Short Bucket", "hash_shrt");
  upsertFile(db, "bshrt00000", "data.csv", 500, "text/csv", "shrtcd", "sha_data");
  const file = getFileByShortCode(db, "shrtcd");
  expect(file).not.toBeNull();
  expect(file!.path).toBe("data.csv");
});

test("listFiles returns all files in bucket", () => {
  insertApiKey(db, "lst00000", "hash_lst", "Lister");
  createBucket(db, "blst000000", "List Bucket", "hash_lst");
  upsertFile(db, "blst000000", "a.txt", 10, "text/plain", "lstsc1", "sha_a");
  upsertFile(db, "blst000000", "b.txt", 20, "text/plain", "lstsc2", "sha_b");
  const files = listFiles(db, "blst000000");
  expect(files).toHaveLength(2);
  expect(files[0].path).toBe("a.txt");
  expect(files[1].path).toBe("b.txt");
});

test("deleteFile removes file", () => {
  insertApiKey(db, "delf0000", "hash_delf", "Deleter");
  createBucket(db, "bdelf00000", "Delete Bucket", "hash_delf");
  upsertFile(db, "bdelf00000", "gone.txt", 10, "text/plain", "delsc1", "sha_gone");
  deleteFile(db, "bdelf00000", "gone.txt");
  expect(getFile(db, "bdelf00000", "gone.txt")).toBeNull();
});

test("updateBucketStats recalculates counts", () => {
  insertApiKey(db, "stat0000", "hash_stat", "Stats");
  createBucket(db, "bstat00000", "Stats Bucket", "hash_stat");
  upsertFile(db, "bstat00000", "a.txt", 100, "text/plain", "stsc1x", "sha_a");
  upsertFile(db, "bstat00000", "b.txt", 200, "text/plain", "stsc2x", "sha_b");
  updateBucketStats(db, "bstat00000");
  const bucket = getBucket(db, "bstat00000");
  expect(bucket!.file_count).toBe(2);
  expect(bucket!.total_size).toBe(300);
});

// ---- Versions ----

test("insertFileVersion and getFileVersions", () => {
  insertApiKey(db, "fver0000", "hash_fver", "FVer");
  createBucket(db, "bfver00000", "FVer Bucket", "hash_fver");
  upsertFile(db, "bfver00000", "app.ts", 100, "text/typescript", "fvsc01", "sha_v1");
  const file = getFile(db, "bfver00000", "app.ts");
  insertFileVersion(db, file!.id, 1, 100, "sha_v1");
  insertFileVersion(db, file!.id, 2, 150, "sha_v2");
  const versions = getFileVersions(db, file!.id);
  expect(versions).toHaveLength(2);
  expect(versions[0].version).toBe(2);
  expect(versions[1].version).toBe(1);
});

// ---- Stats ----

test("upsertDailyStats and getDailyStatsRange", () => {
  upsertDailyStats(db, "2026-02-24", 5, 100, 1000000);
  upsertDailyStats(db, "2026-02-25", 6, 110, 1100000);
  const stats = getDailyStatsRange(db, "2026-02-24", "2026-02-25");
  expect(stats).toHaveLength(2);
  expect(stats[0].total_buckets).toBe(5);
  expect(stats[1].total_files).toBe(110);
});

test("aggregateCurrentStats computes totals", () => {
  insertApiKey(db, "agg00000", "hash_agg", "Aggregator");
  createBucket(db, "bagg000000", "Agg Bucket", "hash_agg");
  upsertFile(db, "bagg000000", "x.txt", 100, "text/plain", "aggsc1", "sha_x");
  upsertFile(db, "bagg000000", "y.txt", 200, "text/plain", "aggsc2", "sha_y");
  const stats = aggregateCurrentStats(db);
  expect(stats!.total_buckets).toBe(1);
  expect(stats!.total_files).toBe(2);
  expect(stats!.total_size).toBe(300);
});
