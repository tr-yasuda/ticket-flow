import { exec } from "node:child_process";
import { promisify } from "node:util";

import { describe, it } from "vitest";

import { isDatabaseConfigured } from "../../../../src/infrastructure/database/config";

const execAsync = promisify(exec);

const hasDatabaseUrl = isDatabaseConfigured(process.env);

describe("マイグレーションコマンド", () => {
  it.skipIf(!hasDatabaseUrl)(
    "マイグレーションを適用できる",
    async () => {
      await execAsync("pnpm run migrate");
    },
    30_000,
  );

  it.skipIf(!hasDatabaseUrl)(
    "マイグレーションをロールバックできる",
    async () => {
      await execAsync("pnpm run migrate:rollback");
    },
    30_000,
  );
});
