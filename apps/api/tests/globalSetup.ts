import { exec } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const defaultTestDatabaseUrl = `file:${resolve(process.cwd(), "prisma/test.db").replace(/\\/g, "/")}`;

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
