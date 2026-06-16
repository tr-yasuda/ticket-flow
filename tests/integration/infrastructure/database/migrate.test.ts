import { exec } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { isDatabaseConfigured } from "../../../../src/infrastructure/database/config";

const execAsync = promisify(exec);

const hasDatabaseUrl = isDatabaseConfigured(process.env);

describe("マイグレーションコマンド", () => {
  it.skipIf(!hasDatabaseUrl)(
    "マイグレーションを適用できる",
    async () => {
      await expect(execAsync("pnpm run migrate")).resolves.toBeDefined();
    },
    30000,
  );

  it.skipIf(!hasDatabaseUrl)(
    "マイグレーションをロールバックできる",
    async () => {
      await expect(
        execAsync("pnpm run migrate:rollback"),
      ).resolves.toBeDefined();
    },
    30000,
  );
});
