import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, it } from "vitest";

const execFileAsync = promisify(execFile);

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
const migrateTestDatabaseUrl = "file:./prisma/migrate-test.db";
const migrateTestDatabasePath = resolve(projectRoot, "prisma/migrate-test.db");

async function runPrismaMigrateDeploy(): Promise<void> {
  await execFileAsync(
    "pnpm",
    [
      "--pm-on-fail=ignore",
      "exec",
      "prisma",
      "migrate",
      "deploy",
      "--schema",
      "prisma/schema.prisma",
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: migrateTestDatabaseUrl },
    },
  );
}

async function cleanMigrateTestDatabase(): Promise<void> {
  await rm(migrateTestDatabasePath, { force: true });
}

describe("マイグレーションコマンド", () => {
  beforeEach(cleanMigrateTestDatabase);
  afterEach(cleanMigrateTestDatabase);

  it("prisma migrate deploy が成功する", async () => {
    await runPrismaMigrateDeploy();
  }, 30_000);
});
