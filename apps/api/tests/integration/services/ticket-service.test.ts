import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import { createOrganization } from "../../../src/services/organizations-service.js";
import {
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  updateTicketStatus,
  type TicketServiceError,
} from "../../../src/services/ticket-service.js";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

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
  ownerId: string;
  memberId: string;
  nonMemberId: string;
}> {
  const ownerResult = await registerUser({
    email: uniqueEmail("owner"),
    password: "password123",
  });
  expect(ownerResult.success).toBe(true);
  if (!ownerResult.success) {
    throw new Error("failed to create owner");
  }

  const organization = await createOrganization({
    name: "Acme Inc.",
    slug: `acme-${randomUUID()}`,
    ownerUserId: ownerResult.data.user.id,
  });
  expect(organization.success).toBe(true);
  if (!organization.success) {
    throw new Error("failed to create organization");
  }

  const memberResult = await registerUser({
    email: uniqueEmail("member"),
    password: "password123",
  });
  expect(memberResult.success).toBe(true);
  if (!memberResult.success) {
    throw new Error("failed to create member user");
  }

  await prisma.organizationMember.create({
    data: {
      id: randomUUID(),
      organizationId: organization.data.id,
      userId: memberResult.data.user.id,
      role: "member",
    },
  });

  const nonMemberResult = await registerUser({
    email: uniqueEmail("non-member"),
    password: "password123",
  });
  expect(nonMemberResult.success).toBe(true);
  if (!nonMemberResult.success) {
    throw new Error("failed to create non-member user");
  }

  return {
    organizationId: organization.data.id,
    ownerId: ownerResult.data.user.id,
    memberId: memberResult.data.user.id,
    nonMemberId: nonMemberResult.data.user.id,
  };
}

function expectSuccess<T>(
  result:
    | { success: true; data: T }
    | { success: false; error: TicketServiceError },
): T {
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(`expected success but got error: ${result.error.message}`);
  }
  return result.data;
}

function expectError(
  result:
    | { success: true; data: unknown }
    | { success: false; error: TicketServiceError },
  expectedType: TicketServiceError["type"],
): void {
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("expected error but got success");
  }
  expect(result.error.type).toBe(expectedType);
}

describe("ticket-service 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  describe("createTicket", () => {
    it("チケットを作成できる", async () => {
      const { organizationId, ownerId } = await seedOrganization();

      const result = await createTicket({
        organizationId,
        title: "新規チケット",
        description: "説明",
        priority: "high",
        assigneeId: null,
        createdBy: ownerId,
      });

      const data = expectSuccess(result);
      expect(data.ticket.organizationId).toBe(organizationId);
      expect(data.ticket.title).toBe("新規チケット");
      expect(data.ticket.description).toBe("説明");
      expect(data.ticket.priority).toBe("high");
      expect(data.ticket.createdBy).toBe(ownerId);
      expect(data.ticket.assigneeId).toBeNull();
    });

    it("担当者を同組織メンバーに設定できる", async () => {
      const { organizationId, ownerId, memberId } = await seedOrganization();

      const result = await createTicket({
        organizationId,
        title: "assigned ticket",
        priority: "medium",
        assigneeId: memberId,
        createdBy: ownerId,
      });

      const data = expectSuccess(result);
      expect(data.ticket.assigneeId).toBe(memberId);
    });

    it("他組織メンバーを担当者にするとエラー", async () => {
      const first = await seedOrganization();
      const second = await seedOrganization();

      const result = await createTicket({
        organizationId: first.organizationId,
        title: "bad assignee",
        priority: "medium",
        assigneeId: second.memberId,
        createdBy: first.ownerId,
      });

      expectError(result, "user-not-organization-member");
    });

    it("作成者が組織メンバーでないとエラー", async () => {
      const first = await seedOrganization();
      const second = await seedOrganization();

      const result = await createTicket({
        organizationId: first.organizationId,
        title: "bad creator",
        priority: "medium",
        assigneeId: null,
        createdBy: second.ownerId,
      });

      expectError(result, "user-not-organization-member");
    });

    it("priority を省略すると medium がデフォルトになる", async () => {
      const { organizationId, ownerId } = await seedOrganization();

      const result = await createTicket({
        organizationId,
        title: "default priority",
        assigneeId: null,
        createdBy: ownerId,
      });

      const data = expectSuccess(result);
      expect(data.ticket.priority).toBe("medium");
    });
  });

  describe("getTicket", () => {
    it("organizationId + ticketId で取得できる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "find me",
          priority: "low",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await getTicket({
        organizationId,
        ticketId: created.ticket.id,
      });

      const data = expectSuccess(result);
      expect(data.ticket.id).toBe(created.ticket.id);
    });

    it("他組織のチケットは取得できない", async () => {
      const first = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId: first.organizationId,
          title: "secret",
          priority: "low",
          assigneeId: null,
          createdBy: first.ownerId,
        }),
      );

      const result = await getTicket({
        organizationId: randomUUID(),
        ticketId: created.ticket.id,
      });

      expectError(result, "ticket-not-found");
    });
  });

  describe("updateTicket", () => {
    it("タイトルと説明を更新できる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "before",
          description: "old",
          priority: "low",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        title: "after",
        description: "new",
      });

      const data = expectSuccess(result);
      expect(data.ticket.title).toBe("after");
      expect(data.ticket.description).toBe("new");
    });

    it("description を省略しても既存値が保持される", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "partial update",
          description: "keep me",
          priority: "low",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        title: "title only",
      });

      const data = expectSuccess(result);
      expect(data.ticket.title).toBe("title only");
      expect(data.ticket.description).toBe("keep me");
    });

    it("説明を空文字にすると null になる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "desc test",
          description: "old",
          priority: "low",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        description: "   ",
      });

      const data = expectSuccess(result);
      expect(data.ticket.description).toBeNull();
    });

    it("担当者を同組織メンバーに変更できる", async () => {
      const { organizationId, ownerId, memberId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "assign me",
          priority: "medium",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        assigneeId: memberId,
      });

      const data = expectSuccess(result);
      expect(data.ticket.assigneeId).toBe(memberId);
    });

    it("担当者をクリアできる", async () => {
      const { organizationId, ownerId, memberId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "unassign me",
          priority: "medium",
          assigneeId: memberId,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        assigneeId: null,
      });

      const data = expectSuccess(result);
      expect(data.ticket.assigneeId).toBeNull();
    });

    it("他組織メンバーを担当者にするとエラー", async () => {
      const first = await seedOrganization();
      const second = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId: first.organizationId,
          title: "bad assignee",
          priority: "medium",
          assigneeId: null,
          createdBy: first.ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId: first.organizationId,
        ticketId: created.ticket.id,
        updatedBy: first.ownerId,
        assigneeId: second.memberId,
      });

      expectError(result, "user-not-organization-member");
    });

    it("存在しないチケットを更新するとエラー", async () => {
      const { organizationId, ownerId } = await seedOrganization();

      const result = await updateTicket({
        organizationId,
        ticketId: randomUUID(),
        updatedBy: ownerId,
        title: "ghost",
      });

      expectError(result, "ticket-not-found");
    });

    it("他組織のチケットを更新するとエラー", async () => {
      const first = await seedOrganization();
      const second = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId: first.organizationId,
          title: "cross org",
          priority: "low",
          assigneeId: null,
          createdBy: first.ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId: second.organizationId,
        ticketId: created.ticket.id,
        updatedBy: first.ownerId,
        title: "hacked",
      });

      expectError(result, "ticket-not-found");
    });

    it("空タイトルはバリデーションエラー", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "valid",
          priority: "low",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        title: "   ",
      });

      expectError(result, "validation-error");
    });

    it("無効な priority はバリデーションエラー", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "valid",
          priority: "low",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        // @ts-expect-error 無効な値を実行時に渡す
        priority: "invalid",
      });

      expectError(result, "validation-error");
    });

    it("更新成功時に監査ログが記録される", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "before",
          description: "old",
          priority: "low",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicket({
        organizationId,
        ticketId: created.ticket.id,
        updatedBy: ownerId,
        title: "after",
      });

      expectSuccess(result);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId,
          entityType: "ticket",
          entityId: created.ticket.id,
          action: "update",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.action).toBe("update");
      expect(auditLog?.oldValues).toMatchObject({ title: "before" });
      expect(auditLog?.newValues).toMatchObject({ title: "after" });
      expect(
        (auditLog?.oldValues as { title?: string } | null)?.title,
      ).not.toBe((auditLog?.newValues as { title?: string } | null)?.title);
    });
  });

  describe("updateTicketStatus", () => {
    it("ステータスを更新できる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId,
          title: "status change",
          priority: "medium",
          assigneeId: null,
          createdBy: ownerId,
        }),
      );

      const result = await updateTicketStatus({
        organizationId,
        ticketId: created.ticket.id,
        status: "closed",
      });

      const data = expectSuccess(result);
      expect(data.ticket.status).toBe("closed");
    });

    it("存在しないチケットのステータス更新はエラー", async () => {
      const { organizationId } = await seedOrganization();

      const result = await updateTicketStatus({
        organizationId,
        ticketId: randomUUID(),
        status: "closed",
      });

      expectError(result, "ticket-not-found");
    });

    it("他組織のチケットのステータス更新はエラー", async () => {
      const first = await seedOrganization();
      const second = await seedOrganization();
      const created = expectSuccess(
        await createTicket({
          organizationId: first.organizationId,
          title: "cross org status",
          priority: "low",
          assigneeId: null,
          createdBy: first.ownerId,
        }),
      );

      const result = await updateTicketStatus({
        organizationId: second.organizationId,
        ticketId: created.ticket.id,
        status: "closed",
      });

      expectError(result, "ticket-not-found");
    });
  });

  describe("listTickets", () => {
    it("組織内チケットのみ取得でき総件数も返る", async () => {
      const first = await seedOrganization();
      const second = await seedOrganization();

      await createTicket({
        organizationId: first.organizationId,
        title: "first org",
        priority: "medium",
        assigneeId: null,
        createdBy: first.ownerId,
      });
      await createTicket({
        organizationId: second.organizationId,
        title: "second org",
        priority: "medium",
        assigneeId: null,
        createdBy: second.ownerId,
      });

      const result = await listTickets({
        organizationId: first.organizationId,
      });

      const data = expectSuccess(result);
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]?.title).toBe("first org");
      expect(data.total).toBe(1);
    });

    it("search でタイトルまたは説明を検索でき総件数も一致する", async () => {
      const { organizationId, ownerId } = await seedOrganization();

      await createTicket({
        organizationId,
        title: "billing issue",
        description: "description",
        priority: "medium",
        assigneeId: null,
        createdBy: ownerId,
      });
      await createTicket({
        organizationId,
        title: "ui bug",
        description: "nothing relevant",
        priority: "medium",
        assigneeId: null,
        createdBy: ownerId,
      });

      const result = await listTickets({
        organizationId,
        search: "billing",
      });

      const data = expectSuccess(result);
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]?.title).toBe("billing issue");
      expect(data.total).toBe(1);
    });

    it("search は大文字小文字を区別しない", async () => {
      const { organizationId, ownerId } = await seedOrganization();

      await createTicket({
        organizationId,
        title: "UPPERCASE TITLE",
        priority: "medium",
        assigneeId: null,
        createdBy: ownerId,
      });

      const result = await listTickets({
        organizationId,
        search: "uppercase",
      });

      const data = expectSuccess(result);
      expect(data.tickets).toHaveLength(1);
    });
  });
});
