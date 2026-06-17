import { exec } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, it } from "vitest";

import { createTestDatabaseUrl } from "../../../test-database-url.js";

const execAsync = promisify(exec);

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
const migrateTestDatabasePath = resolve(projectRoot, "prisma/migrate-test.db");
const migrateTestDatabaseUrl = createTestDatabaseUrl("prisma/migrate-test.db");

async function runPrismaMigrateDeploy(): Promise<void> {
  await execAsync(
    "pnpm --pm-on-fail=ignore exec prisma migrate deploy --schema prisma/schema.prisma",
    {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: migrateTestDatabaseUrl },
    },
  );
}

async function cleanMigrateTestDatabase(): Promise<void> {
  const sidecarSuffixes = ["", "-wal", "-shm", "-journal"];
  await Promise.all(
    sidecarSuffixes.map((suffix) =>
      rm(`${migrateTestDatabasePath}${suffix}`, { force: true }),
    ),
  );
}

describe("マイグレーションコマンド", () => {
  beforeEach(cleanMigrateTestDatabase);
  afterEach(cleanMigrateTestDatabase);

  it("prisma migrate deploy が成功する", async () => {
    await runPrismaMigrateDeploy();
  }, 30_000);
});
