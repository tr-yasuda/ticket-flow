import { describe, expect, it } from "vitest";

import { loadDatabaseConfig } from "../../../../src/infrastructure/database/config";
import { checkDatabaseHealth } from "../../../../src/infrastructure/database/health-check";
import { createPrismaClient } from "../../../../src/infrastructure/database/prisma-client";

describe("データベース接続", () => {
  it("データベースに接続できる", async () => {
    const config = loadDatabaseConfig(process.env);
    const client = createPrismaClient(config);

    try {
      const health = await checkDatabaseHealth(client);
      if (health.status === "unhealthy") {
        throw (
          health.error ?? new Error("データベースヘルスチェックが失敗しました")
        );
      }
      expect(health.status).toBe("healthy");
    } finally {
      await client.$disconnect();
    }
  });
});
