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

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: migrateTestDatabaseUrl,
      },
    },
  });
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

  it("prisma migrate deploy が成功し、必要なカラムと制約が作成される", async () => {
    await runPrismaMigrateDeploy();

    const prisma = createPrismaClient();
    try {
      const user = await prisma.user.create({
        data: {
          id: "migrate-test-user",
          email: "migrate-test@example.com",
          passwordHash: "hash",
        },
      });
      const organization = await prisma.organization.create({
        data: {
          id: "migrate-test-organization",
          name: "Migrate Test Org",
          slug: "migrate-test-organization",
        },
      });
      await prisma.organizationMember.create({
        data: {
          id: "migrate-test-member",
          organizationId: organization.id,
          userId: user.id,
          role: "owner",
        },
      });

      const ticket = await prisma.ticket.create({
        data: {
          id: "migrate-test-ticket",
          organizationId: organization.id,
          title: "マイグレーション確認用チケット",
          description: "説明",
          status: "in-progress",
          priority: "high",
          assigneeId: user.id,
          createdBy: user.id,
        },
      });

      expect(ticket.organizationId).toBe(organization.id);
      expect(ticket.createdBy).toBe(user.id);
      expect(ticket.status).toBe("in-progress");
      expect(ticket.priority).toBe("high");

      const columns = (await prisma.$queryRaw`
        PRAGMA table_info('tickets')
      `) as Array<{ name: string }>;
      const columnNames = columns.map((column) => column.name);
      expect(columnNames).toContain("organization_id");
      expect(columnNames).toContain("description");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("priority");
      expect(columnNames).toContain("assignee_id");
      expect(columnNames).toContain("created_by");

      const indexes = (await prisma.$queryRaw`
        PRAGMA index_list('tickets')
      `) as Array<{ name: string }>;
      const indexNames = indexes.map((index) => index.name);
      expect(indexNames).toContain("tickets_organization_id_status_idx");
      expect(indexNames).toContain("tickets_organization_id_created_at_idx");
      expect(indexNames).toContain("tickets_organization_id_assignee_id_idx");
      expect(indexNames).toContain("tickets_organization_id_created_by_idx");

      const comment = await prisma.comment.create({
        data: {
          id: "migrate-test-comment",
          ticketId: ticket.id,
          organizationId: organization.id,
          authorId: user.id,
          content: "マイグレーション確認用コメント",
        },
      });
      expect(comment.organizationId).toBe(organization.id);
      expect(comment.ticketId).toBe(ticket.id);
      expect(comment.authorId).toBe(user.id);

      const commentColumns = (await prisma.$queryRaw`
        PRAGMA table_info('comments')
      `) as Array<{ name: string }>;
      const commentColumnNames = commentColumns.map((column) => column.name);
      expect(commentColumnNames).toContain("ticket_id");
      expect(commentColumnNames).toContain("organization_id");
      expect(commentColumnNames).toContain("author_id");
      expect(commentColumnNames).toContain("content");
      expect(commentColumnNames).toContain("created_at");
      expect(commentColumnNames).toContain("updated_at");
      expect(commentColumnNames).toContain("deleted_at");

      const commentIndexes = (await prisma.$queryRaw`
        PRAGMA index_list('comments')
      `) as Array<{ name: string }>;
      const commentIndexNames = commentIndexes.map((index) => index.name);
      expect(commentIndexNames).toContain(
        "comments_organization_id_ticket_id_deleted_at_created_at_idx",
      );
      expect(commentIndexNames).toContain(
        "comments_organization_id_created_at_idx",
      );
      expect(commentIndexNames).toContain("comments_ticket_id_idx");
      expect(commentIndexNames).toContain("comments_author_id_idx");
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);
});
