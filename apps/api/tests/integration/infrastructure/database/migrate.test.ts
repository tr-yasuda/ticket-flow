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
const testDatabasePath = resolve(projectRoot, "prisma/test.db");

async function runPrismaMigrateDeploy(): Promise<void> {
  await execFileAsync(
    "node",
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "prisma/schema.prisma",
    ],
    { cwd: projectRoot },
  );
}

async function cleanTestDatabase(): Promise<void> {
  await rm(testDatabasePath, { force: true });
}

describe("マイグレーションコマンド", () => {
  beforeEach(cleanTestDatabase);
  afterEach(cleanTestDatabase);

  it("prisma migrate deploy が成功する", async () => {
    await runPrismaMigrateDeploy();
  }, 30_000);
});
