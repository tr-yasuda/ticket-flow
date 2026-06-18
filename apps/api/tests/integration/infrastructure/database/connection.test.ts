import { describe, expect, it } from "vitest";

import { checkDatabaseHealth } from "../../../../src/infrastructure/database/health-check";
import { createPrismaClient } from "../../../../src/infrastructure/database/prisma-client";
import { env } from "../../../../src/lib/env";

describe("データベース接続", () => {
  it("データベースに接続できる", async () => {
    const client = createPrismaClient({ connectionString: env.DATABASE_URL });

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
