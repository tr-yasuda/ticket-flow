import { exec } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execAsync = promisify(exec);

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
const seedTestDatabaseUrl = "file:./prisma/seed-test.db";
const seedTestDatabasePath = resolve(projectRoot, "prisma/seed-test.db");

async function runPrismaMigrateDeploy(): Promise<void> {
  await execAsync(
    "pnpm --pm-on-fail=ignore exec prisma migrate deploy --schema prisma/schema.prisma",
    {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: seedTestDatabaseUrl },
    },
  );
}

async function runSeed(): Promise<void> {
  await execAsync("pnpm run db:seed", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: seedTestDatabaseUrl },
  });
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: seedTestDatabaseUrl,
      },
    },
  });
}

async function cleanSeedTestDatabase(): Promise<void> {
  const sidecarSuffixes = ["", "-wal", "-shm", "-journal"];
  await Promise.all(
    sidecarSuffixes.map((suffix) =>
      rm(`${seedTestDatabasePath}${suffix}`, { force: true }),
    ),
  );
}

describe("デモ seed 統合テスト", () => {
  beforeEach(async () => {
    await cleanSeedTestDatabase();
    await runPrismaMigrateDeploy();
  });
  afterEach(cleanSeedTestDatabase);

  it("db:seed でデモユーザーとデモチケットが投入される", async () => {
    await runSeed();

    const prisma = createPrismaClient();
    try {
      const user = await prisma.user.findUnique({
        where: { email: "demo@example.com" },
      });
      expect(user).not.toBeNull();

      const tickets = await prisma.ticket.findMany({
        orderBy: { id: "asc" },
      });
      expect(tickets).toHaveLength(4);
      expect(tickets.map((ticket) => ticket.status)).toEqual([
        "open",
        "in-progress",
        "closed",
        "open",
      ]);
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);

  it("db:seed は複数回実行してもデータ件数が増えない", async () => {
    await runSeed();
    await runSeed();

    const prisma = createPrismaClient();
    try {
      const userCount = await prisma.user.count();
      const ticketCount = await prisma.ticket.count();
      expect(userCount).toBe(1);
      expect(ticketCount).toBe(4);
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);

  it("db:seed は production 環境では実行できない", async () => {
    await expect(
      execAsync("pnpm run db:seed", {
        cwd: projectRoot,
        env: {
          ...process.env,
          DATABASE_URL: seedTestDatabaseUrl,
          NODE_ENV: "production",
        },
      }),
    ).rejects.toThrow("Seed scripts must not run in production environment");
  });
});
