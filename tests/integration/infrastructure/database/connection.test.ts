import { describe, expect, it } from "vitest";
import { isDatabaseConfigured, loadDatabaseConfig } from "../../../../src/infrastructure/database/config";
import { createDatabasePool } from "../../../../src/infrastructure/database/pool";
import { checkDatabaseHealth } from "../../../../src/infrastructure/database/health-check";

const hasDatabaseUrl = isDatabaseConfigured(process.env);

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
