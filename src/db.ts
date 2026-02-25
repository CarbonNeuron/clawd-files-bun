import { Database } from "bun:sqlite";
import { dbPath } from "./config";

let _db: Database | null = null;

export function getDb(path?: string): Database {
  if (_db) return _db;
  _db = new Database(path ?? dbPath);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  _db.exec("PRAGMA busy_timeout = 5000");
  initSchema(_db);
  return _db;
}

/** For testing — use an in-memory database */
export function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  initSchema(db);
  return db;
}

/** Reset the singleton (for testing) */
export function resetDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prefix TEXT NOT NULL UNIQUE,
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_used INTEGER
    );

    CREATE TABLE IF NOT EXISTS buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      purpose TEXT DEFAULT '',
      owner_key_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER,
      file_count INTEGER NOT NULL DEFAULT 0,
      total_size INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (owner_key_hash) REFERENCES api_keys(key_hash) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bucket_id TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      short_code TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL DEFAULT 1,
      sha256 TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
      UNIQUE(bucket_id, path)
    );

    CREATE TABLE IF NOT EXISTS file_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT NOT NULL,
      total_buckets INTEGER NOT NULL DEFAULT 0,
      total_files INTEGER NOT NULL DEFAULT 0,
      total_size INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date)
    );

    CREATE INDEX IF NOT EXISTS idx_files_short_code ON files(short_code);
    CREATE INDEX IF NOT EXISTS idx_buckets_expires_at ON buckets(expires_at);
    CREATE INDEX IF NOT EXISTS idx_files_bucket_id ON files(bucket_id);
    CREATE INDEX IF NOT EXISTS idx_buckets_owner ON buckets(owner_key_hash);
  `);
}

// ---- API Key queries ----

export function insertApiKey(db: Database, prefix: string, keyHash: string, name: string) {
  return db.query(
    "INSERT INTO api_keys (prefix, key_hash, name) VALUES (?, ?, ?)"
  ).run(prefix, keyHash, name);
}

export function getApiKeyByHash(db: Database, keyHash: string) {
  return db.query<{ id: number; prefix: string; key_hash: string; name: string; created_at: number; last_used: number | null }, [string]>(
    "SELECT * FROM api_keys WHERE key_hash = ?"
  ).get(keyHash);
}

export function listApiKeys(db: Database) {
  return db.query<{ id: number; prefix: string; name: string; created_at: number; last_used: number | null }, []>(
    "SELECT id, prefix, name, created_at, last_used FROM api_keys ORDER BY created_at DESC"
  ).all();
}

export function deleteApiKey(db: Database, prefix: string) {
  return db.query("DELETE FROM api_keys WHERE prefix = ?").run(prefix);
}

export function updateApiKeyLastUsed(db: Database, keyHash: string) {
  return db.query("UPDATE api_keys SET last_used = unixepoch() WHERE key_hash = ?").run(keyHash);
}

// ---- Bucket queries ----

export function createBucket(
  db: Database,
  id: string,
  name: string,
  ownerKeyHash: string,
  description?: string,
  purpose?: string,
  expiresAt?: number | null
) {
  return db.query(
    "INSERT INTO buckets (id, name, description, purpose, owner_key_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name, description ?? "", purpose ?? "", ownerKeyHash, expiresAt ?? null);
}

export type BucketRow = {
  id: string;
  name: string;
  description: string;
  purpose: string;
  owner_key_hash: string;
  created_at: number;
  expires_at: number | null;
  file_count: number;
  total_size: number;
};

export function getBucket(db: Database, id: string) {
  return db.query<BucketRow, [string]>(
    "SELECT * FROM buckets WHERE id = ?"
  ).get(id);
}

export function listBucketsByOwner(db: Database, ownerKeyHash: string) {
  return db.query<BucketRow, [string]>(
    "SELECT * FROM buckets WHERE owner_key_hash = ? ORDER BY created_at DESC"
  ).all(ownerKeyHash);
}

export function listAllBuckets(db: Database) {
  return db.query<BucketRow, []>(
    "SELECT * FROM buckets ORDER BY created_at DESC"
  ).all();
}

export function updateBucket(db: Database, id: string, fields: Partial<Pick<BucketRow, "name" | "description" | "purpose" | "expires_at">>) {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  return db.query(`UPDATE buckets SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteBucket(db: Database, id: string) {
  return db.query("DELETE FROM buckets WHERE id = ?").run(id);
}

export function getExpiredBuckets(db: Database) {
  return db.query<BucketRow, []>(
    "SELECT * FROM buckets WHERE expires_at IS NOT NULL AND expires_at < unixepoch()"
  ).all();
}

export function updateBucketStats(db: Database, bucketId: string) {
  return db.query(
    `UPDATE buckets SET
      file_count = (SELECT COUNT(*) FROM files WHERE bucket_id = ?),
      total_size = (SELECT COALESCE(SUM(size), 0) FROM files WHERE bucket_id = ?)
    WHERE id = ?`
  ).run(bucketId, bucketId, bucketId);
}

// ---- File queries ----

export type FileRow = {
  id: number;
  bucket_id: string;
  path: string;
  size: number;
  mime_type: string;
  short_code: string;
  version: number;
  sha256: string;
  uploaded_at: number;
};

export function upsertFile(
  db: Database,
  bucketId: string,
  path: string,
  size: number,
  mimeType: string,
  shortCode: string,
  sha256: string
) {
  return db.query(
    `INSERT INTO files (bucket_id, path, size, mime_type, short_code, sha256)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(bucket_id, path) DO UPDATE SET
       size = excluded.size,
       mime_type = excluded.mime_type,
       sha256 = excluded.sha256,
       version = files.version + 1,
       uploaded_at = unixepoch()`
  ).run(bucketId, path, size, mimeType, shortCode, sha256);
}

export function getFile(db: Database, bucketId: string, path: string) {
  return db.query<FileRow, [string, string]>(
    "SELECT * FROM files WHERE bucket_id = ? AND path = ?"
  ).get(bucketId, path);
}

export function getFileByShortCode(db: Database, shortCode: string) {
  return db.query<FileRow, [string]>(
    "SELECT * FROM files WHERE short_code = ?"
  ).get(shortCode);
}

export function listFiles(db: Database, bucketId: string) {
  return db.query<FileRow, [string]>(
    "SELECT * FROM files WHERE bucket_id = ? ORDER BY path ASC"
  ).all(bucketId);
}

export function deleteFile(db: Database, bucketId: string, path: string) {
  return db.query("DELETE FROM files WHERE bucket_id = ? AND path = ?").run(bucketId, path);
}

// ---- Version queries ----

export type VersionRow = {
  id: number;
  file_id: number;
  version: number;
  size: number;
  sha256: string;
  created_at: number;
};

export function insertFileVersion(db: Database, fileId: number, version: number, size: number, sha256: string) {
  return db.query(
    "INSERT INTO file_versions (file_id, version, size, sha256) VALUES (?, ?, ?, ?)"
  ).run(fileId, version, size, sha256);
}

export function getFileVersions(db: Database, fileId: number) {
  return db.query<VersionRow, [number]>(
    "SELECT * FROM file_versions WHERE file_id = ? ORDER BY version DESC"
  ).all(fileId);
}

// ---- Stats queries ----

export function upsertDailyStats(db: Database, date: string, totalBuckets: number, totalFiles: number, totalSize: number) {
  return db.query(
    `INSERT INTO daily_stats (date, total_buckets, total_files, total_size)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       total_buckets = excluded.total_buckets,
       total_files = excluded.total_files,
       total_size = excluded.total_size`
  ).run(date, totalBuckets, totalFiles, totalSize);
}

export function getDailyStatsRange(db: Database, startDate: string, endDate: string) {
  return db.query<{ date: string; total_buckets: number; total_files: number; total_size: number }, [string, string]>(
    "SELECT * FROM daily_stats WHERE date >= ? AND date <= ? ORDER BY date ASC"
  ).all(startDate, endDate);
}

export function aggregateCurrentStats(db: Database) {
  return db.query<{ total_buckets: number; total_files: number; total_size: number }, []>(
    `SELECT
      (SELECT COUNT(*) FROM buckets) as total_buckets,
      (SELECT COUNT(*) FROM files) as total_files,
      (SELECT COALESCE(SUM(size), 0) FROM files) as total_size`
  ).get();
}
