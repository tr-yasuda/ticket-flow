import { exec } from "node:child_process";
import { promisify } from "node:util";

import { describe, it } from "vitest";

import { isDatabaseConfigured } from "../../../../src/infrastructure/database/config";

const execAsync = promisify(exec);

const isEnabled =
  isDatabaseConfigured(process.env) &&
  process.env.MIGRATE_INTEGRATION_TEST === "true";

describe("マイグレーションコマンド", () => {
  it.skipIf(!isEnabled)(
    "マイグレーションを適用してロールバックできる",
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
