import { describe, expect, it } from "vitest";

import {
  isDatabaseConfigured,
  loadDatabaseConfig,
} from "../../../../src/infrastructure/database/config";
import { checkDatabaseHealth } from "../../../../src/infrastructure/database/health-check";
import { createPrismaClient } from "../../../../src/infrastructure/database/prisma-client";

const hasDatabaseUrl = isDatabaseConfigured(process.env);

describe("データベース接続", () => {
  it.skipIf(!hasDatabaseUrl)(
    "DATABASE_URL が設定されていれば接続できる",
    async () => {
      const config = loadDatabaseConfig(process.env);
      const client = createPrismaClient(config);

      try {
        const health = await checkDatabaseHealth(client);
        expect(health.status).toBe("healthy");
      } finally {
        await client.$disconnect();
      }
    },
  );
});
