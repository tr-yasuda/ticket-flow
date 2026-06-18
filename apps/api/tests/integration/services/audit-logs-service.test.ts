import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import {
  findAuditLogsByEntity,
  findAuditLogsByOrganizationId,
  saveAuditLog,
} from "../../../src/services/audit-logs-service.js";
import { registerUser } from "../../../src/services/auth-service.js";
import { createOrganization } from "../../../src/services/organizations-service.js";

async function cleanAll(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function seedOrganization(): Promise<{
  organizationId: string;
  actorId: string;
}> {
  const userResult = await registerUser({
    email: `owner-${randomUUID()}@example.com`,
    password: "password123",
  });
  expect(userResult.success).toBe(true);
  if (!userResult.success) {
    throw new Error("Failed to register user");
  }

  const organizationResult = await createOrganization({
    name: "Acme Inc.",
    slug: `acme-${randomUUID()}`,
    ownerUserId: userResult.data.user.id,
  });
  expect(organizationResult.success).toBe(true);
  if (!organizationResult.success) {
    throw new Error("Failed to create organization");
  }

  return {
    organizationId: organizationResult.data.id,
    actorId: userResult.data.user.id,
  };
}

async function waitMilliseconds(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("audit-logs-service 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("監査ログを記録できる", async () => {
    const { organizationId, actorId } = await seedOrganization();

    const result = await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
      oldValues: { status: "open" },
      newValues: { status: "closed" },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.organizationId).toBe(organizationId);
    expect(result.data.actorId).toBe(actorId);
    expect(result.data.entityType).toBe("ticket");
    expect(result.data.entityId).toBe("ticket-1");
    expect(result.data.action).toBe("created");
    expect(result.data.oldValues).toEqual({ status: "open" });
    expect(result.data.newValues).toEqual({ status: "closed" });
    expect(result.data.createdAt).toBeInstanceOf(Date);

    const stored = await prisma.auditLog.findUnique({
      where: { id: result.data.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.id).toBe(result.data.id);
    expect(stored?.createdAt.getTime()).toBe(result.data.createdAt.getTime());
  });

  it("actorId を省略して監査ログを記録できる", async () => {
    const { organizationId } = await seedOrganization();

    const result = await saveAuditLog({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.actorId).toBeNull();
  });

  it("oldValues と newValues を省略して監査ログを記録できる", async () => {
    const { organizationId, actorId } = await seedOrganization();

    const result = await saveAuditLog({
      organizationId,
      actorId,
      entityType: "member",
      entityId: "member-1",
      action: "deleted",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.oldValues).toBeNull();
    expect(result.data.newValues).toBeNull();
  });

  it("存在しない組織には監査ログを記録できない", async () => {
    const { actorId } = await seedOrganization();

    const result = await saveAuditLog({
      organizationId: randomUUID(),
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("organization-not-found");
  });

  it("存在しない actor には監査ログを記録できない", async () => {
    const { organizationId } = await seedOrganization();

    const result = await saveAuditLog({
      organizationId,
      actorId: randomUUID(),
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("actor-not-found");
  });

  it("無効なペイロードは invalid-payload エラーになる", async () => {
    const { organizationId, actorId } = await seedOrganization();

    const result = await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
      oldValues: { data: "x".repeat(65537) },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("invalid-payload");
  });

  it("組織IDで監査ログを取得できる", async () => {
    const { organizationId, actorId } = await seedOrganization();

    await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });

    const result = await findAuditLogsByOrganizationId({ organizationId });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.entityType).toBe("ticket");
  });

  it("他組織の監査ログは取得できない", async () => {
    const { organizationId, actorId } = await seedOrganization();
    const other = await seedOrganization();

    await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });
    await saveAuditLog({
      organizationId: other.organizationId,
      actorId: other.actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });

    const result = await findAuditLogsByOrganizationId({ organizationId });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.organizationId).toBe(organizationId);
  });

  it("エンティティの変更履歴を取得できる", async () => {
    const { organizationId, actorId } = await seedOrganization();

    await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
      newValues: { title: "First" },
    });
    await waitMilliseconds(20);
    await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "updated",
      newValues: { title: "Second" },
    });

    const result = await findAuditLogsByEntity({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.action).toBe("updated");
    expect(result.data[1]?.action).toBe("created");
  });

  it("エンティティ履歴取得で他組織のログは含まれない", async () => {
    const { organizationId, actorId } = await seedOrganization();
    const other = await seedOrganization();

    await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });
    await saveAuditLog({
      organizationId: other.organizationId,
      actorId: other.actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "updated",
    });

    const result = await findAuditLogsByEntity({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.action).toBe("created");
  });

  it("該当がない場合は空配列を返す", async () => {
    const { organizationId } = await seedOrganization();

    const byOrganization = await findAuditLogsByOrganizationId({
      organizationId,
    });
    const byEntity = await findAuditLogsByEntity({
      organizationId,
      entityType: "ticket",
      entityId: "missing",
    });

    expect(byOrganization.success).toBe(true);
    if (!byOrganization.success) {
      return;
    }
    expect(byOrganization.data).toEqual([]);

    expect(byEntity.success).toBe(true);
    if (!byEntity.success) {
      return;
    }
    expect(byEntity.data).toEqual([]);
  });

  it("ページネーションで件数を制限できる", async () => {
    const { organizationId, actorId } = await seedOrganization();

    await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });
    await waitMilliseconds(20);
    await saveAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "updated",
    });

    const result = await findAuditLogsByOrganizationId({
      organizationId,
      take: 1,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.action).toBe("updated");
  });

  it("トランザクションがロールバックされると監査ログも記録されない", async () => {
    const { organizationId, actorId } = await seedOrganization();

    await expect(
      prisma.$transaction(async (tx) => {
        const result = await saveAuditLog(
          {
            organizationId,
            actorId,
            entityType: "ticket",
            entityId: "ticket-1",
            action: "created",
          },
          tx,
        );
        expect(result.success).toBe(true);
        throw new Error("intentional rollback");
      }),
    ).rejects.toThrow("intentional rollback");

    const stored = await prisma.auditLog.findMany({
      where: { organizationId },
    });
    expect(stored).toHaveLength(0);
  });
});
