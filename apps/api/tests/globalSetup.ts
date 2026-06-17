import { exec } from "node:child_process";
import { promisify } from "node:util";

import { createTestDatabaseUrl } from "./test-database-url.js";

const execAsync = promisify(exec);

const defaultTestDatabaseUrl = createTestDatabaseUrl("prisma/test.db");

async function runPrismaMigrateDeploy(): Promise<void> {
  await execAsync(
    "pnpm exec prisma migrate deploy --schema prisma/schema.prisma",
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: defaultTestDatabaseUrl },
    },
  );
}

export default async function setup(): Promise<void> {
  process.env.DATABASE_URL = defaultTestDatabaseUrl;
  await runPrismaMigrateDeploy();
}
