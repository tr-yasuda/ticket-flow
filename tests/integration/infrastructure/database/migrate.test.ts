import { exec } from "node:child_process";
import { promisify } from "node:util";

import { describe, it } from "vitest";

import { isDatabaseConfigured } from "../../../../src/infrastructure/database/config";

const execAsync = promisify(exec);

const runMigrationTests =
  isDatabaseConfigured(process.env) &&
  process.env.RUN_MIGRATION_TESTS === "true";

describe("マイグレーションコマンド", () => {
  it.skipIf(!runMigrationTests)(
    "マイグレーションを適用し、必ずロールバックする",
    async () => {
      try {
        await execAsync("pnpm run migrate");
      } finally {
        await execAsync("pnpm run migrate:rollback");
      }
    },
    30_000,
  );
});
