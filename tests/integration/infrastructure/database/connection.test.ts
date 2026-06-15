import { describe, expect, it } from "vitest";
import { loadDatabaseConfig } from "../../../../src/infrastructure/database/config";
import { createDatabasePool } from "../../../../src/infrastructure/database/pool";
import { checkDatabaseHealth } from "../../../../src/infrastructure/database/health-check";

const hasDatabaseUrl =
  process.env.DATABASE_URL != null && process.env.DATABASE_URL !== "";

describe("データベース接続", () => {
  it.skipIf(!hasDatabaseUrl)("DATABASE_URL が設定されていれば接続できる", async () => {
    const config = loadDatabaseConfig(process.env);
    const pool = createDatabasePool(config);

    try {
      const health = await checkDatabaseHealth(pool);
      expect(health.status).toBe("healthy");
    } finally {
      await pool.end();
    }
  });
});
