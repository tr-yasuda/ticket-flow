import { exec } from "node:child_process";
import { promisify } from "node:util";

import { describe, it } from "vitest";

import { isDatabaseConfigured } from "../../../../src/infrastructure/database/config";

const execAsync = promisify(exec);

const isEnabled =
  isDatabaseConfigured(process.env) &&
  process.env.MIGRATE_INTEGRATION_TEST === "true";

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

describe("マイグレーションコマンド", () => {
  it.skipIf(!isEnabled)(
    "マイグレーションを適用してロールバックできる",
    async () => {
      const errors: Error[] = [];

      try {
        await execAsync("pnpm run migrate");
      } catch (error) {
        errors.push(toError(error));
      }

      try {
        await execAsync("pnpm run migrate:rollback");
      } catch (error) {
        errors.push(toError(error));
      }

      if (errors.length > 0) {
        const [first, ...rest] = errors;
        const message =
          rest.length > 0
            ? `${first.message}; 追加のエラー: ${rest.map((error) => error.message).join(", ")}`
            : first.message;
        throw new Error(message);
      }
    },
    30_000,
  );
});
