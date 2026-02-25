import { test, expect, beforeEach } from "bun:test";
import {
  createTestDb,
  insertApiKey,
  createBucket,
  getBucket,
  upsertFile,
  getExpiredBuckets,
  deleteBucket,
  aggregateCurrentStats,
  upsertDailyStats,
  getDailyStatsRange,
} from "../src/db";
import type { Database } from "bun:sqlite";

let db: Database;

beforeEach(() => {
  db = createTestDb();
});

test("expired buckets are detected", () => {
  insertApiKey(db, "clean000", "hash_clean", "Cleaner");
  createBucket(db, "bexp000001", "Expired 1", "hash_clean", "", "", 1000); // way in the past
  createBucket(db, "bfut000001", "Future 1", "hash_clean", "", "", Math.floor(Date.now() / 1000) + 86400);
  createBucket(db, "bnev000001", "No Expiry", "hash_clean");

  const expired = getExpiredBuckets(db);
  expect(expired).toHaveLength(1);
  expect(expired[0].id).toBe("bexp000001");
});

test("cleanup deletes expired bucket and cascaded files", () => {
  insertApiKey(db, "clnup000", "hash_clnup", "Cleanup");
  createBucket(db, "bclnup0001", "Cleanup Bucket", "hash_clnup", "", "", 1000);
  upsertFile(db, "bclnup0001", "test.txt", 100, "text/plain", "clnsc1", "sha_t");

  const expired = getExpiredBuckets(db);
  for (const b of expired) {
    deleteBucket(db, b.id);
  }

  expect(getBucket(db, "bclnup0001")).toBeNull();
});

test("stats aggregation computes totals", () => {
  insertApiKey(db, "stag0000", "hash_stag", "Stats");
  createBucket(db, "bstag00001", "Stats Bucket", "hash_stag");
  upsertFile(db, "bstag00001", "a.txt", 100, "text/plain", "stag01", "sha_a");
  upsertFile(db, "bstag00001", "b.txt", 200, "text/plain", "stag02", "sha_b");

  const stats = aggregateCurrentStats(db);
  expect(stats!.total_buckets).toBe(1);
  expect(stats!.total_files).toBe(2);
  expect(stats!.total_size).toBe(300);

  upsertDailyStats(db, "2026-02-24", stats!.total_buckets, stats!.total_files, stats!.total_size);
  const range = getDailyStatsRange(db, "2026-02-24", "2026-02-24");
  expect(range).toHaveLength(1);
  expect(range[0].total_files).toBe(2);
});
