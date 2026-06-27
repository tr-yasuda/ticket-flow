import { exec } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabaseUrl } from "../../../test-database-url.js";

const execAsync = promisify(exec);

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);
const seedTestDatabasePath = resolve(projectRoot, "prisma/seed-test.db");
const seedTestDatabaseUrl = createTestDatabaseUrl("prisma/seed-test.db");

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
  }, 30_000);
  afterEach(cleanSeedTestDatabase);

  it("db:seed でデモユーザーとデモチケットが投入される", async () => {
    await runSeed();

    const prisma = createPrismaClient();
    try {
      const user = await prisma.user.findUnique({
        where: { email: "demo@example.com" },
      });
      expect(user).not.toBeNull();
      expect(user?.id).toBe("demo-user-001");

      const organization = await prisma.organization.findUnique({
        where: { id: "demo-organization-001" },
      });
      expect(organization).not.toBeNull();
      expect(organization?.slug).toBe("demo-organization");

      const membership = await prisma.organizationMember.findUnique({
        where: { id: "demo-member-001" },
      });
      expect(membership).not.toBeNull();
      expect(membership?.userId).toBe("demo-user-001");
      expect(membership?.organizationId).toBe("demo-organization-001");
      expect(membership?.role).toBe("owner");

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
      for (const ticket of tickets) {
        expect(ticket.organizationId).toBe("demo-organization-001");
        expect(ticket.createdBy).toBe("demo-user-001");
      }
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
      const organizationCount = await prisma.organization.count();
      const memberCount = await prisma.organizationMember.count();
      const ticketCount = await prisma.ticket.count();
      expect(userCount).toBe(1);
      expect(organizationCount).toBe(1);
      expect(memberCount).toBe(1);
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

  it("demo-organization の slug が他の組織で使われている場合は明確なエラーを出す", async () => {
    const prisma = createPrismaClient();
    try {
      await prisma.organization.create({
        data: {
          id: "other-organization-001",
          name: "Other Organization",
          slug: "demo-organization",
        },
      });
    } finally {
      await prisma.$disconnect();
    }

    await expect(runSeed()).rejects.toThrow(
      'Seed failed: slug "demo-organization" is already used by organization "other-organization-001".',
    );
  });
});
