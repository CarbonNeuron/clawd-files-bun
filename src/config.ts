export const config = {
  port: Number(process.env.PORT ?? 5109),
  dataDir: process.env.DATA_DIR ?? "./data",
  adminKey: process.env.ADMIN_KEY ?? "",
  baseUrl: process.env.BASE_URL ?? "http://localhost:5109",
  maxRenderSize: Number(process.env.MAX_RENDER_SIZE ?? 2 * 1024 * 1024),
  cleanupIntervalMs: Number(process.env.CLEANUP_INTERVAL_MS ?? 3_600_000),
} as const;

export const dbPath = `${config.dataDir}/clawd.db`;
export const filesDir = `${config.dataDir}/files`;
