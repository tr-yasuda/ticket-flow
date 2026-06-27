import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createAuditLog } from "../../../../src/domain/audit-log.js";
import {
  findAuditLogsByEntityWithActor,
  saveAuditLog,
} from "../../../../src/infrastructure/database/audit-log-repository.js";
import { prisma } from "../../../../src/lib/prisma.js";
import { registerUser } from "../../../../src/services/auth-service.js";
import { createOrganization } from "../../../../src/services/organizations-service.js";

async function cleanAll(): Promise<void> {
  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.organizationInvitation.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.organizationMember.deleteMany();
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

describe("audit-log-repository 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("エンティティ履歴を actor 情報付きで取得できる", async () => {
    const { organizationId, actorId } = await seedOrganization();
    const saved = await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "create",
        newValues: { title: "First" },
      }),
    );

    const logs = await findAuditLogsByEntityWithActor({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
    });

    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).not.toBeUndefined();
    expect(log.id).toBe(saved.id);
    expect(log.actor).not.toBeNull();
    expect(log.actor?.id).toBe(actorId);
    expect(log.actor).not.toHaveProperty("email");
    expect(log.action).toBe("create");
    expect(log.newValues).toEqual({ title: "First" });
  });

  it("履歴が時系列順に返される", async () => {
    const { organizationId, actorId } = await seedOrganization();
    await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "create",
      }),
    );
    await waitMilliseconds(20);
    await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "update",
      }),
    );

    const logs = await findAuditLogsByEntityWithActor({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]?.action).toBe("update");
    expect(logs[1]?.action).toBe("create");
    expect(new Date(logs[0]!.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(logs[1]!.createdAt).getTime(),
    );
  });

  it("take/skip でページネーションできる", async () => {
    const { organizationId, actorId } = await seedOrganization();
    await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "create",
      }),
    );
    await waitMilliseconds(20);
    await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "update",
      }),
    );
    await waitMilliseconds(20);
    await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "delete",
      }),
    );

    const page1 = await findAuditLogsByEntityWithActor({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
      take: 2,
      skip: 0,
    });
    expect(page1).toHaveLength(2);
    expect(page1[0]?.action).toBe("delete");
    expect(page1[1]?.action).toBe("update");

    const page2 = await findAuditLogsByEntityWithActor({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
      take: 2,
      skip: 2,
    });
    expect(page2).toHaveLength(1);
    expect(page2[0]?.action).toBe("create");
  });

  it("他組織のログは含まれない", async () => {
    const { organizationId, actorId } = await seedOrganization();
    const other = await seedOrganization();
    await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "create",
      }),
    );
    await saveAuditLog(
      createAuditLog({
        organizationId: other.organizationId,
        actorId: other.actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "update",
      }),
    );

    const logs = await findAuditLogsByEntityWithActor({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("create");
  });

  it("actor が null の履歴は actor: null で返る", async () => {
    const { organizationId } = await seedOrganization();
    await saveAuditLog(
      createAuditLog({
        organizationId,
        actorId: null,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "system",
        newValues: { note: "auto" },
      }),
    );

    const logs = await findAuditLogsByEntityWithActor({
      organizationId,
      entityType: "ticket",
      entityId: "ticket-1",
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.actor).toBeNull();
  });

  it("oldValues/newValues が不正な形状でも読み出し時に検証される", async () => {
    const { organizationId, actorId } = await seedOrganization();
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "corrupt",
        oldValues: { data: "x".repeat(65537) },
      },
    });

    await expect(
      findAuditLogsByEntityWithActor({
        organizationId,
        entityType: "ticket",
        entityId: "ticket-1",
      }),
    ).rejects.toThrow();
  });
});
