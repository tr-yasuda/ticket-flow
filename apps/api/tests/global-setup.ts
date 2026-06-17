import { exec } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const defaultTestDatabaseUrl = `file:${resolve(process.cwd(), "prisma/test.db").replace(/\\/g, "/")}`;

function getTestDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim() ?? "";
  return envUrl === "" ? defaultTestDatabaseUrl : envUrl;
}

async function runPrismaMigrateDeploy(databaseUrl: string): Promise<void> {
  await execAsync(
    "pnpm --pm-on-fail=ignore exec prisma migrate deploy --schema prisma/schema.prisma",
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );
}

export default async function setup(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  await runPrismaMigrateDeploy(databaseUrl);
}
