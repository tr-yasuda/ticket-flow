import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import { createOrganization } from "../../../src/services/organizations-service.js";
import {
  createTicket,
  type TicketServiceError,
} from "../../../src/services/ticket-command-service.js";
import {
  getTicket,
  getTicketHistory,
  listTickets,
} from "../../../src/services/ticket-query-service.js";

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

describe("ticket-query-service 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
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

    it("assigneeId で担当者のチケットだけを取得できる", async () => {
      const { organizationId, ownerId, memberId } = await seedOrganization();

      await createTicket({
        organizationId,
        title: "member ticket",
        priority: "medium",
        assigneeId: memberId,
        createdBy: ownerId,
      });
      await createTicket({
        organizationId,
        title: "unassigned ticket",
        priority: "medium",
        assigneeId: null,
        createdBy: ownerId,
      });

      const result = await listTickets({
        organizationId,
        assigneeId: memberId,
      });

      const data = expectSuccess(result);
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]?.title).toBe("member ticket");
      expect(data.total).toBe(1);
    });

    it("assigneeId=null で未アサインのチケットだけを取得できる", async () => {
      const { organizationId, ownerId, memberId } = await seedOrganization();

      await createTicket({
        organizationId,
        title: "member ticket",
        priority: "medium",
        assigneeId: memberId,
        createdBy: ownerId,
      });
      await createTicket({
        organizationId,
        title: "unassigned ticket",
        priority: "medium",
        assigneeId: null,
        createdBy: ownerId,
      });

      const result = await listTickets({
        organizationId,
        assigneeId: null,
      });

      const data = expectSuccess(result);
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]?.title).toBe("unassigned ticket");
      expect(data.total).toBe(1);
    });

    it("非メンバーの assigneeId を指定すると空結果を返す", async () => {
      const { organizationId, ownerId, nonMemberId } = await seedOrganization();

      const createResult = await createTicket({
        organizationId,
        title: "ticket",
        priority: "medium",
        assigneeId: ownerId,
        createdBy: ownerId,
      });
      const { ticket } = expectSuccess(createResult);

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { assigneeId: nonMemberId },
      });

      const result = await listTickets({
        organizationId,
        assigneeId: nonMemberId,
      });

      const data = expectSuccess(result);
      expect(data.tickets).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    it("assigneeId と search を組み合わせられる", async () => {
      const { organizationId, ownerId, memberId } = await seedOrganization();

      await createTicket({
        organizationId,
        title: "billing member",
        description: "description",
        priority: "medium",
        assigneeId: memberId,
        createdBy: ownerId,
      });
      await createTicket({
        organizationId,
        title: "billing unassigned",
        description: "description",
        priority: "medium",
        assigneeId: null,
        createdBy: ownerId,
      });
      await createTicket({
        organizationId,
        title: "ui member",
        description: "description",
        priority: "medium",
        assigneeId: memberId,
        createdBy: ownerId,
      });

      const result = await listTickets({
        organizationId,
        assigneeId: memberId,
        search: "billing",
      });

      const data = expectSuccess(result);
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]?.title).toBe("billing member");
      expect(data.total).toBe(1);
    });
  });

  describe("getTicketHistory", () => {
    it("チケットの変更履歴を時系列順で取得できる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = await createTicket({
        organizationId,
        title: "履歴取得",
        createdBy: ownerId,
      });
      const ticket = expectSuccess(created);

      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: ownerId,
          entityType: "ticket",
          entityId: ticket.ticket.id,
          action: "update",
          oldValues: { title: "履歴取得" },
          newValues: { title: "更新 1" },
        },
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: ownerId,
          entityType: "ticket",
          entityId: ticket.ticket.id,
          action: "update",
          oldValues: { title: "更新 1" },
          newValues: { title: "更新 2" },
        },
      });

      const result = await getTicketHistory({
        organizationId,
        ticketId: ticket.ticket.id,
      });

      const data = expectSuccess(result);
      expect(data.history).toHaveLength(2);
      expect(data.history[0]?.action).toBe("update");
      expect(data.history[1]?.action).toBe("update");
      expect(new Date(data.history[0]!.createdAt).getTime()).toBeGreaterThan(
        new Date(data.history[1]!.createdAt).getTime(),
      );
    });

    it("変更者情報に id と name のみ含まれる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = await createTicket({
        organizationId,
        title: "actor shape",
        createdBy: ownerId,
      });
      const ticket = expectSuccess(created);

      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: ownerId,
          entityType: "ticket",
          entityId: ticket.ticket.id,
          action: "update",
          oldValues: { title: "actor shape" },
          newValues: { title: "actor shape updated" },
        },
      });

      const result = await getTicketHistory({
        organizationId,
        ticketId: ticket.ticket.id,
      });

      const data = expectSuccess(result);
      const actor = data.history[0]?.actor;
      expect(actor).not.toBeNull();
      expect(actor).toHaveProperty("id");
      expect(actor).toHaveProperty("name");
      expect(actor).not.toHaveProperty("email");
    });

    it("take/skip でページネーションできる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = await createTicket({
        organizationId,
        title: "pagination",
        createdBy: ownerId,
      });
      const ticket = expectSuccess(created);

      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: ownerId,
          entityType: "ticket",
          entityId: ticket.ticket.id,
          action: "update",
          oldValues: { title: "pagination" },
          newValues: { title: "更新 1" },
        },
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: ownerId,
          entityType: "ticket",
          entityId: ticket.ticket.id,
          action: "update",
          oldValues: { title: "更新 1" },
          newValues: { title: "更新 2" },
        },
      });

      const page1 = await getTicketHistory({
        organizationId,
        ticketId: ticket.ticket.id,
        take: 1,
        skip: 0,
      });
      const data1 = expectSuccess(page1);
      expect(data1.history).toHaveLength(1);

      const page2 = await getTicketHistory({
        organizationId,
        ticketId: ticket.ticket.id,
        take: 1,
        skip: 1,
      });
      const data2 = expectSuccess(page2);
      expect(data2.history).toHaveLength(1);
    });

    it("他組織のチケットは取得できない", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const otherResult = await registerUser({
        email: uniqueEmail("other"),
        password: "password123",
      });
      expect(otherResult.success).toBe(true);
      if (!otherResult.success) {
        throw new Error("failed to create other user");
      }
      const otherOrganization = await createOrganization({
        name: "Other Inc.",
        slug: `other-${randomUUID()}`,
        ownerUserId: otherResult.data.user.id,
      });
      expect(otherOrganization.success).toBe(true);
      if (!otherOrganization.success) {
        throw new Error("failed to create other organization");
      }
      const created = await createTicket({
        organizationId,
        title: "cross org",
        createdBy: ownerId,
      });
      const ticket = expectSuccess(created);

      const result = await getTicketHistory({
        organizationId: otherOrganization.data.id,
        ticketId: ticket.ticket.id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ticket-not-found");
      }
    });

    it("存在しないチケットは取得できない", async () => {
      const { organizationId } = await seedOrganization();

      const result = await getTicketHistory({
        organizationId,
        ticketId: randomUUID(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ticket-not-found");
      }
    });

    it("actor が null の履歴も取得できる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const created = await createTicket({
        organizationId,
        title: "null actor",
        createdBy: ownerId,
      });
      const ticket = expectSuccess(created);
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: null,
          entityType: "ticket",
          entityId: ticket.ticket.id,
          action: "manual",
          newValues: { note: "system" },
        },
      });

      const result = await getTicketHistory({
        organizationId,
        ticketId: ticket.ticket.id,
      });

      const data = expectSuccess(result);
      const manualLog = data.history.find((log) => log.action === "manual");
      expect(manualLog).toBeDefined();
      expect(manualLog?.actor).toBeNull();
    });
  });
});
