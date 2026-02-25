import { test, expect, beforeEach, afterEach } from "bun:test";

test("config uses default values", async () => {
  // Re-import to get fresh config with current env
  const { config, dbPath, filesDir } = await import("../src/config");
  expect(config.port).toBe(5109);
  expect(config.dataDir).toBe("./data");
  expect(config.baseUrl).toBe("http://localhost:5109");
  expect(config.maxRenderSize).toBe(2 * 1024 * 1024);
  expect(config.cleanupIntervalMs).toBe(3_600_000);
  expect(dbPath).toBe("./data/clawd.db");
  expect(filesDir).toBe("./data/files");
});

test("config reads ADMIN_KEY from env", async () => {
  const { config } = await import("../src/config");
  // ADMIN_KEY is set in .env
  expect(config.adminKey).toBe("dev-admin-key-change-in-production");
});
