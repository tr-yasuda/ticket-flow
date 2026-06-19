import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  TicketPriority,
  TicketStatus,
  rehydrateTicket,
} from "../../../../src/domain/ticket.js";
import {
  findTicketsByOrganizationId,
  saveTicket,
} from "../../../../src/infrastructure/database/ticket-repository.js";
import { prisma } from "../../../../src/lib/prisma.js";
import { cleanAll } from "../../helpers/organization-test-helpers.js";

async function createUser(email: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      passwordHash: "hash",
    },
  });
  return user.id;
}

async function createOrganization(ownerId: string): Promise<string> {
  const organization = await prisma.organization.create({
    data: {
      id: randomUUID(),
      name: "Acme Inc.",
      slug: `acme-${randomUUID()}`,
    },
  });
  await prisma.organizationMember.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      userId: ownerId,
      role: "owner",
    },
  });
  return organization.id;
}

async function seedOrganization(): Promise<{
  organizationId: string;
  ownerId: string;
}> {
  const ownerId = await createUser(`owner-${randomUUID()}@example.com`);
  const organizationId = await createOrganization(ownerId);
  return { organizationId, ownerId };
}

describe("ticket-repository 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("チケットを作成できる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    const ticket = rehydrateTicket({
      id: "ticket-1",
      organizationId,
      title: "バグを修正する",
      description: "再現手順",
      status: TicketStatus.InProgress,
      priority: TicketPriority.High,
      assigneeId: ownerId,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T01:00:00.000Z"),
    });

    const saved = await saveTicket(ticket);

    expect(saved).toEqual(ticket);

    const stored = await prisma.ticket.findUnique({
      where: { id: saved.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.organizationId).toBe(organizationId);
    expect(stored?.createdBy).toBe(ownerId);
    expect(stored?.assigneeId).toBe(ownerId);
    expect(stored?.status).toBe(TicketStatus.InProgress);
    expect(stored?.priority).toBe(TicketPriority.High);
  });

  it("チケットを組織スコープで取得でき、他組織のチケットは含まれない", async () => {
    const first = await seedOrganization();
    const second = await seedOrganization();

    const firstTicket = rehydrateTicket({
      id: "ticket-first",
      organizationId: first.organizationId,
      title: "first organization ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: first.ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    const secondTicket = rehydrateTicket({
      id: "ticket-second",
      organizationId: second.organizationId,
      title: "second organization ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: second.ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });

    await saveTicket(firstTicket);
    await saveTicket(secondTicket);

    const result = await findTicketsByOrganizationId({
      organizationId: first.organizationId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-first");
    expect(result[0]?.organizationId).toBe(first.organizationId);
  });

  it("チケット一覧が作成日時降順・id降順で返される", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    const older = rehydrateTicket({
      id: "ticket-older",
      organizationId,
      title: "older ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
      updatedAt: new Date("2026-06-18T00:00:00.000Z"),
    });
    const newer = rehydrateTicket({
      id: "ticket-newer",
      organizationId,
      title: "newer ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });

    await saveTicket(older);
    await saveTicket(newer);

    const result = await findTicketsByOrganizationId({ organizationId });

    expect(result.map((ticket) => ticket.id)).toEqual([
      "ticket-newer",
      "ticket-older",
    ]);
  });

  it("ページネーションの take がクランプされる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-1",
        organizationId,
        title: "ticket 1",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-2",
        organizationId,
        title: "ticket 2",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:01.000Z"),
        updatedAt: new Date("2026-06-19T00:00:01.000Z"),
      }),
    );

    const takeZero = await findTicketsByOrganizationId({
      organizationId,
      take: 0,
    });
    expect(takeZero).toHaveLength(1);
    expect(takeZero[0]?.id).toBe("ticket-2");

    const takeOne = await findTicketsByOrganizationId({
      organizationId,
      take: 1,
    });
    expect(takeOne).toHaveLength(1);
    expect(takeOne[0]?.id).toBe("ticket-2");

    const takeHuge = await findTicketsByOrganizationId({
      organizationId,
      take: 100_000,
    });
    expect(takeHuge).toHaveLength(2);
  });

  it("ページネーションの skip がクランプされる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-1",
        organizationId,
        title: "ticket 1",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const skipNegative = await findTicketsByOrganizationId({
      organizationId,
      skip: -1,
    });
    expect(skipNegative).toHaveLength(1);

    const skipHuge = await findTicketsByOrganizationId({
      organizationId,
      skip: 100_000,
    });
    expect(skipHuge).toHaveLength(0);
  });

  it("重複した id を保存すると一意制約違反のエラーになる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    const ticket = rehydrateTicket({
      id: "ticket-duplicate",
      organizationId,
      title: "first",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await saveTicket(ticket);
    await expect(saveTicket(ticket)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );

    try {
      await saveTicket(ticket);
    } catch (error) {
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        expect(error.code).toBe("P2002");
      }
    }
  });

  it("存在しない組織IDを指定すると外部キー制約違反のエラーになる", async () => {
    const { ownerId } = await seedOrganization();

    const ticket = rehydrateTicket({
      id: "ticket-missing-org",
      organizationId: randomUUID(),
      title: "first",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(saveTicket(ticket)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("存在しない作成者IDを指定すると外部キー制約違反のエラーになる", async () => {
    const { organizationId } = await seedOrganization();

    const ticket = rehydrateTicket({
      id: "ticket-missing-creator",
      organizationId,
      title: "first",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(saveTicket(ticket)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("存在しない担当者IDを指定すると外部キー制約違反のエラーになる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    const ticket = rehydrateTicket({
      id: "ticket-missing-assignee",
      organizationId,
      title: "first",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: randomUUID(),
      createdBy: ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(saveTicket(ticket)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("作成者を持つユーザーは削除できない", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-1",
        organizationId,
        title: "ticket 1",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(
      prisma.user.delete({ where: { id: ownerId } }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });
});
