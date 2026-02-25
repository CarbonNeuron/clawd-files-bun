import { config } from "./config";
import { getDb, getExpiredBuckets, deleteBucket, aggregateCurrentStats, upsertDailyStats } from "./db";
import { deleteBucketDir } from "./storage";
import * as log from "./logger";

export function startCleanupLoop(): ReturnType<typeof setInterval> {
  return setInterval(runCleanup, config.cleanupIntervalMs);
}

export async function runCleanup(): Promise<number> {
  const db = getDb();
  const expired = getExpiredBuckets(db);

  for (const bucket of expired) {
    log.info(`Cleanup: deleting expired bucket ${bucket.id} (${bucket.name})`);
    await deleteBucketDir(bucket.id);
    deleteBucket(db, bucket.id);
  }

  if (expired.length > 0) {
    log.info(`Cleanup: deleted ${expired.length} expired bucket(s)`);
  }

  return expired.length;
}

export function startStatsAggregation(): ReturnType<typeof setInterval> {
  runStatsAggregation();
  return setInterval(runStatsAggregation, 3_600_000);
}

export function runStatsAggregation(): void {
  const db = getDb();
  const stats = aggregateCurrentStats(db);
  if (stats) {
    const date = new Date().toISOString().split("T")[0];
    upsertDailyStats(db, date, stats.total_buckets, stats.total_files, stats.total_size);
    log.debug(`Stats: ${stats.total_buckets} buckets, ${stats.total_files} files, ${stats.total_size} bytes`);
  }
}
