import { exec } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { isDatabaseConfigured } from "../../../../src/infrastructure/database/config";

const execAsync = promisify(exec);

const hasDatabaseUrl = isDatabaseConfigured(process.env);

describe("マイグレーションコマンド", () => {
  it.skipIf(!hasDatabaseUrl)("マイグレーションを適用できる", async () => {
    const { stdout } = await execAsync("pnpm run migrate");

    expect(stdout).toContain("Migrations complete");
  });

  it.skipIf(!hasDatabaseUrl)(
    "マイグレーションをロールバックできる",
    async () => {
      const { stdout } = await execAsync("pnpm run migrate:rollback");

      expect(stdout).toContain("Migrations complete");
    },
  );
});
