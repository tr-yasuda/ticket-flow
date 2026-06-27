import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  TicketPriority,
  TicketStatus,
  rehydrateTicket,
} from "../../../../src/domain/ticket.js";
import {
  countTicketsByOrganizationId,
  findTicketById,
  findTicketsByOrganizationId,
  saveTicket,
  softDeleteTicket,
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

  it("チケット一覧が更新日時降順・id降順で返される", async () => {
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
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
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
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    const sameUpdatedAtLaterId = rehydrateTicket({
      id: "ticket-later-id",
      organizationId,
      title: "same updated at later id",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-17T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });

    await saveTicket(older);
    await saveTicket(newer);
    await saveTicket(sameUpdatedAtLaterId);

    const result = await findTicketsByOrganizationId({ organizationId });

    expect(result.map((ticket) => ticket.id)).toEqual([
      "ticket-newer",
      "ticket-later-id",
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

  it("organizationId と ticketId でチケットを取得できる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    const ticket = rehydrateTicket({
      id: "ticket-1",
      organizationId,
      title: "scoped ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveTicket(ticket);

    const found = await findTicketById({
      organizationId,
      ticketId: ticket.id,
    });

    expect(found).not.toBeNull();
    expect(found?.id).toBe(ticket.id);
    expect(found?.organizationId).toBe(organizationId);
  });

  it("他組織のチケットは organizationId + ticketId で取得できない", async () => {
    const first = await seedOrganization();
    const second = await seedOrganization();

    const ticket = rehydrateTicket({
      id: "ticket-first",
      organizationId: first.organizationId,
      title: "first org ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: first.ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveTicket(ticket);

    const found = await findTicketById({
      organizationId: second.organizationId,
      ticketId: ticket.id,
    });

    expect(found).toBeNull();
  });

  it("search でタイトルに一致するチケットを取得できる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-match",
        organizationId,
        title: "billing issue",
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
        id: "ticket-other",
        organizationId,
        title: "ui bug",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "billing",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-match");
  });

  it("search で説明に一致するチケットを取得できる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-desc-match",
        organizationId,
        title: "title only",
        description: "hidden keyword here",
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "keyword",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-desc-match");
  });

  it("search は大文字小文字を区別しない", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-case",
        organizationId,
        title: "UPPERCASE TITLE",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "uppercase",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-case");
  });

  it("search が空文字の場合は全件返す", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-1",
        organizationId,
        title: "first",
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
        title: "second",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "",
    });

    expect(result).toHaveLength(2);
  });

  it("search とページネーションを組み合わせられる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-a",
        organizationId,
        title: "searchable a",
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
        id: "ticket-b",
        organizationId,
        title: "searchable b",
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
        id: "ticket-other",
        organizationId,
        title: "unrelated",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "searchable",
      take: 1,
      skip: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-a");
  });

  it("search が空白のみの場合は全件返す", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-1",
        organizationId,
        title: "first",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "   ",
    });

    expect(result).toHaveLength(1);
  });

  it("search で他組織のチケットは含まれない", async () => {
    const first = await seedOrganization();
    const second = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-first",
        organizationId: first.organizationId,
        title: "shared keyword first",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: first.ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-second",
        organizationId: second.organizationId,
        title: "shared keyword second",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: second.ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId: first.organizationId,
      search: "shared",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-first");
    expect(result[0]?.organizationId).toBe(first.organizationId);
  });

  it("search で LIKE ワイルドカード % は文字列として扱われる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-percent",
        organizationId,
        title: "50% discount",
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
        id: "ticket-x",
        organizationId,
        title: "50x discount",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "50%",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-percent");
  });

  it("search で LIKE ワイルドカード _ は文字列として扱われる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-underscore",
        organizationId,
        title: "file_1",
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
        id: "ticket-a",
        organizationId,
        title: "fileA1",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "file_1",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-underscore");
  });

  it("countTicketsByOrganizationId は組織内総件数を返す", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-1",
        organizationId,
        title: "first",
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
        title: "second",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const total = await countTicketsByOrganizationId({ organizationId });

    expect(total).toBe(2);
  });

  it("countTicketsByOrganizationId は search 条件に一致する件数を返す", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-match",
        organizationId,
        title: "billing issue",
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
        id: "ticket-other",
        organizationId,
        title: "ui bug",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const total = await countTicketsByOrganizationId({
      organizationId,
      search: "billing",
    });

    expect(total).toBe(1);
  });

  it("findTicketsByOrganizationId は assigneeId で絞り込める", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-assigned",
        organizationId,
        title: "assigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-unassigned",
        organizationId,
        title: "unassigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      assigneeId: ownerId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-assigned");
  });

  it("findTicketsByOrganizationId は assigneeId=null で未アサインを絞り込める", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-assigned",
        organizationId,
        title: "assigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-unassigned",
        organizationId,
        title: "unassigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      assigneeId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-unassigned");
  });

  it("findTicketsByOrganizationId は非メンバーの assigneeId で空結果を返す", async () => {
    const { organizationId, ownerId } = await seedOrganization();
    const nonMemberId = await createUser("non-member@example.com");

    await saveTicket(
      rehydrateTicket({
        id: "ticket-assigned",
        organizationId,
        title: "assigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      assigneeId: nonMemberId,
    });

    expect(result).toHaveLength(0);
  });

  it("findTicketsByOrganizationId は assigneeId と search を組み合わせられる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-match",
        organizationId,
        title: "billing assigned",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-other-assignee",
        organizationId,
        title: "billing other",
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
        id: "ticket-unrelated",
        organizationId,
        title: "ui bug",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      assigneeId: ownerId,
      search: "billing",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-match");
  });

  it("findTicketsByOrganizationId は大文字の assigneeId を小文字に正規化する", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-assigned",
        organizationId,
        title: "assigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      assigneeId: ownerId.toUpperCase(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-assigned");
  });

  it("countTicketsByOrganizationId は assigneeId で件数を絞り込める", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-assigned",
        organizationId,
        title: "assigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-unassigned",
        organizationId,
        title: "unassigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const total = await countTicketsByOrganizationId({
      organizationId,
      assigneeId: ownerId,
    });

    expect(total).toBe(1);
  });

  it("countTicketsByOrganizationId は assigneeId=null で未アサイン件数を絞り込める", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-assigned",
        organizationId,
        title: "assigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: ownerId,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-unassigned",
        organizationId,
        title: "unassigned ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const total = await countTicketsByOrganizationId({
      organizationId,
      assigneeId: null,
    });

    expect(total).toBe(1);
  });

  it("softDeleteTicket でチケットを論理削除できる", async () => {
    const { organizationId, ownerId } = await seedOrganization();
    const ticket = rehydrateTicket({
      id: "ticket-delete",
      organizationId,
      title: "delete target",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveTicket(ticket);

    const deleted = await softDeleteTicket({
      organizationId,
      ticketId: ticket.id,
    });

    expect(deleted).not.toBeNull();
    expect(deleted?.deletedAt).not.toBeNull();

    const stored = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(stored?.deletedAt).not.toBeNull();
  });

  it("削除済みチケットは findTicketById で取得できない", async () => {
    const { organizationId, ownerId } = await seedOrganization();
    const ticket = rehydrateTicket({
      id: "ticket-deleted",
      organizationId,
      title: "deleted ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveTicket(ticket);
    await softDeleteTicket({ organizationId, ticketId: ticket.id });

    const found = await findTicketById({
      organizationId,
      ticketId: ticket.id,
    });

    expect(found).toBeNull();
  });

  it("削除済みチケットは findTicketsByOrganizationId に含まれない", async () => {
    const { organizationId, ownerId } = await seedOrganization();
    const ticket = rehydrateTicket({
      id: "ticket-deleted-list",
      organizationId,
      title: "deleted list ticket",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveTicket(ticket);
    await softDeleteTicket({ organizationId, ticketId: ticket.id });

    const result = await findTicketsByOrganizationId({ organizationId });

    expect(result).toHaveLength(0);
  });

  it("削除済みチケットを再削除しても null が返る", async () => {
    const { organizationId, ownerId } = await seedOrganization();
    const ticket = rehydrateTicket({
      id: "ticket-already-deleted",
      organizationId,
      title: "already deleted",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveTicket(ticket);
    await softDeleteTicket({ organizationId, ticketId: ticket.id });

    const result = await softDeleteTicket({
      organizationId,
      ticketId: ticket.id,
    });

    expect(result).toBeNull();
  });

  it("countTicketsByOrganizationId は削除済みチケットをカウントしない", async () => {
    const { organizationId, ownerId } = await seedOrganization();
    const ticket = rehydrateTicket({
      id: "ticket-count",
      organizationId,
      title: "count target",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: ownerId,
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveTicket(ticket);
    await softDeleteTicket({ organizationId, ticketId: ticket.id });

    const total = await countTicketsByOrganizationId({ organizationId });

    expect(total).toBe(0);
  });
});
