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

async function createComment(
  ticketId: string,
  organizationId: string,
  authorId: string,
  content: string,
  overrides: Partial<Prisma.CommentCreateInput> = {},
): Promise<void> {
  await prisma.comment.create({
    data: {
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    },
  });
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

  it("findTicketsByOrganizationId は一致する assigneeId のチケットがない場合は空配列を返す", async () => {
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

  it("findTicketsByOrganizationId は priority で絞り込める", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-high",
        organizationId,
        title: "high priority ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.High,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-low",
        organizationId,
        title: "low priority ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Low,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      priority: [TicketPriority.High],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-high");
  });

  it("findTicketsByOrganizationId は複数 priority を OR 条件で絞り込める", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-high",
        organizationId,
        title: "high priority ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.High,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-low",
        organizationId,
        title: "low priority ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Low,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-medium",
        organizationId,
        title: "medium priority ticket",
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
      priority: [TicketPriority.High, TicketPriority.Low],
    });

    expect(result).toHaveLength(2);
    const ids = result.map((ticket) => ticket.id);
    expect(ids).toContain("ticket-high");
    expect(ids).toContain("ticket-low");
    expect(ids).not.toContain("ticket-medium");
  });

  it("findTicketsByOrganizationId は search と priority を組み合わせられる", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-billing-high",
        organizationId,
        title: "billing high",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.High,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-billing-low",
        organizationId,
        title: "billing low",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Low,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-ui-high",
        organizationId,
        title: "ui high",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.High,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const result = await findTicketsByOrganizationId({
      organizationId,
      search: "billing",
      priority: [TicketPriority.High],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("ticket-billing-high");
  });

  it("countTicketsByOrganizationId は priority で件数を絞り込める", async () => {
    const { organizationId, ownerId } = await seedOrganization();

    await saveTicket(
      rehydrateTicket({
        id: "ticket-high",
        organizationId,
        title: "high priority ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.High,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );
    await saveTicket(
      rehydrateTicket({
        id: "ticket-low",
        organizationId,
        title: "low priority ticket",
        description: null,
        status: TicketStatus.Open,
        priority: TicketPriority.Low,
        assigneeId: null,
        createdBy: ownerId,
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
    );

    const total = await countTicketsByOrganizationId({
      organizationId,
      priority: [TicketPriority.High],
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

  describe("commentCount", () => {
    it("コメントがない場合は 0 を返す", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-without-comments",
          organizationId,
          title: "ticket without comments",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );

      const result = await findTicketsByOrganizationId({ organizationId });

      expect(result).toHaveLength(1);
      expect(result[0]?.commentCount).toBe(0);
    });

    it("チケットのコメント数を返す", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-with-comments",
          organizationId,
          title: "ticket with comments",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );
      await createComment(
        "ticket-with-comments",
        organizationId,
        ownerId,
        "comment 1",
      );
      await createComment(
        "ticket-with-comments",
        organizationId,
        ownerId,
        "comment 2",
      );

      const result = await findTicketsByOrganizationId({ organizationId });

      expect(result).toHaveLength(1);
      expect(result[0]?.commentCount).toBe(2);
    });

    it("search 時も commentCount を返す", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-search-comments",
          organizationId,
          title: "searchable ticket",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );
      await createComment(
        "ticket-search-comments",
        organizationId,
        ownerId,
        "comment",
      );

      const result = await findTicketsByOrganizationId({
        organizationId,
        search: "searchable",
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.commentCount).toBe(1);
    });

    it("他チケットのコメントをカウントしない", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-target",
          organizationId,
          title: "target ticket",
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
          title: "other ticket",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:01.000Z"),
          updatedAt: new Date("2026-06-19T00:00:01.000Z"),
        }),
      );
      await createComment(
        "ticket-other",
        organizationId,
        ownerId,
        "other comment",
      );

      const result = await findTicketsByOrganizationId({ organizationId });
      const target = result.find((ticket) => ticket.id === "ticket-target");
      const other = result.find((ticket) => ticket.id === "ticket-other");

      expect(result).toHaveLength(2);
      expect(target?.commentCount).toBe(0);
      expect(other?.commentCount).toBe(1);
    });

    it("他組織のコメントをカウントしない", async () => {
      const first = await seedOrganization();
      const second = await seedOrganization();

      await saveTicket(
        rehydrateTicket({
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
        }),
      );
      await saveTicket(
        rehydrateTicket({
          id: "ticket-second",
          organizationId: second.organizationId,
          title: "second org ticket",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: second.ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );

      await createComment(
        "ticket-first",
        first.organizationId,
        first.ownerId,
        "first org comment",
      );
      await createComment(
        "ticket-second",
        second.organizationId,
        second.ownerId,
        "second org comment 1",
      );
      await createComment(
        "ticket-second",
        second.organizationId,
        second.ownerId,
        "second org comment 2",
      );

      const result = await findTicketsByOrganizationId({
        organizationId: first.organizationId,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("ticket-first");
      expect(result[0]?.commentCount).toBe(1);
    });

    it("削除済みコメントも commentCount に含める", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-deleted-comment",
          organizationId,
          title: "ticket with deleted comment",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );
      await createComment(
        "ticket-deleted-comment",
        organizationId,
        ownerId,
        "deleted comment",
        { deletedAt: new Date() },
      );

      const result = await findTicketsByOrganizationId({ organizationId });

      expect(result).toHaveLength(1);
      expect(result[0]?.commentCount).toBe(1);
    });

    it("複数チケットの commentCount を同時に返す", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-two",
          organizationId,
          title: "two comments",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:02.000Z"),
          updatedAt: new Date("2026-06-19T00:00:02.000Z"),
        }),
      );
      await saveTicket(
        rehydrateTicket({
          id: "ticket-one",
          organizationId,
          title: "one comment",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:01.000Z"),
          updatedAt: new Date("2026-06-19T00:00:01.000Z"),
        }),
      );
      await saveTicket(
        rehydrateTicket({
          id: "ticket-zero",
          organizationId,
          title: "zero comments",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );
      await createComment("ticket-two", organizationId, ownerId, "c1");
      await createComment("ticket-two", organizationId, ownerId, "c2");
      await createComment("ticket-one", organizationId, ownerId, "c1");

      const result = await findTicketsByOrganizationId({ organizationId });

      expect(
        result.map((ticket) => ({
          id: ticket.id,
          commentCount: ticket.commentCount,
        })),
      ).toEqual([
        { id: "ticket-two", commentCount: 2 },
        { id: "ticket-one", commentCount: 1 },
        { id: "ticket-zero", commentCount: 0 },
      ]);
    });

    it("ページネーションと commentCount を組み合わせられる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-newest",
          organizationId,
          title: "newest",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:02.000Z"),
          updatedAt: new Date("2026-06-19T00:00:02.000Z"),
        }),
      );
      await saveTicket(
        rehydrateTicket({
          id: "ticket-middle",
          organizationId,
          title: "middle",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:01.000Z"),
          updatedAt: new Date("2026-06-19T00:00:01.000Z"),
        }),
      );
      await saveTicket(
        rehydrateTicket({
          id: "ticket-oldest",
          organizationId,
          title: "oldest",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );
      await createComment("ticket-newest", organizationId, ownerId, "c1");
      await createComment("ticket-newest", organizationId, ownerId, "c2");
      await createComment("ticket-middle", organizationId, ownerId, "c1");

      const firstPage = await findTicketsByOrganizationId({
        organizationId,
        take: 1,
        skip: 0,
      });
      expect(firstPage).toHaveLength(1);
      expect(firstPage[0]?.id).toBe("ticket-newest");
      expect(firstPage[0]?.commentCount).toBe(2);

      const secondPage = await findTicketsByOrganizationId({
        organizationId,
        take: 1,
        skip: 1,
      });
      expect(secondPage).toHaveLength(1);
      expect(secondPage[0]?.id).toBe("ticket-middle");
      expect(secondPage[0]?.commentCount).toBe(1);

      const thirdPage = await findTicketsByOrganizationId({
        organizationId,
        take: 1,
        skip: 2,
      });
      expect(thirdPage).toHaveLength(1);
      expect(thirdPage[0]?.id).toBe("ticket-oldest");
      expect(thirdPage[0]?.commentCount).toBe(0);
    });

    it("status フィルタと commentCount を組み合わせられる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-open",
          organizationId,
          title: "open ticket",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:01.000Z"),
          updatedAt: new Date("2026-06-19T00:00:01.000Z"),
        }),
      );
      await saveTicket(
        rehydrateTicket({
          id: "ticket-closed",
          organizationId,
          title: "closed ticket",
          description: null,
          status: TicketStatus.Closed,
          priority: TicketPriority.Medium,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );
      await createComment("ticket-open", organizationId, ownerId, "c1");
      await createComment("ticket-open", organizationId, ownerId, "c2");
      await createComment("ticket-closed", organizationId, ownerId, "c1");

      const result = await findTicketsByOrganizationId({
        organizationId,
        status: [TicketStatus.Open],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("ticket-open");
      expect(result[0]?.commentCount).toBe(2);
    });

    it("priority フィルタと commentCount を組み合わせられる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      await saveTicket(
        rehydrateTicket({
          id: "ticket-high",
          organizationId,
          title: "high priority",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.High,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:01.000Z"),
          updatedAt: new Date("2026-06-19T00:00:01.000Z"),
        }),
      );
      await saveTicket(
        rehydrateTicket({
          id: "ticket-low",
          organizationId,
          title: "low priority",
          description: null,
          status: TicketStatus.Open,
          priority: TicketPriority.Low,
          assigneeId: null,
          createdBy: ownerId,
          createdAt: new Date("2026-06-19T00:00:00.000Z"),
          updatedAt: new Date("2026-06-19T00:00:00.000Z"),
        }),
      );
      await createComment("ticket-high", organizationId, ownerId, "c1");
      await createComment("ticket-high", organizationId, ownerId, "c2");
      await createComment("ticket-low", organizationId, ownerId, "c1");

      const result = await findTicketsByOrganizationId({
        organizationId,
        priority: [TicketPriority.High],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("ticket-high");
      expect(result[0]?.commentCount).toBe(2);
    });

    it("assigneeId フィルタと commentCount を組み合わせられる", async () => {
      const { organizationId, ownerId } = await seedOrganization();
      const otherUserId = await createUser("other-member@example.com");
      await prisma.organizationMember.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId: otherUserId,
          role: "member",
        },
      });

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
          createdAt: new Date("2026-06-19T00:00:01.000Z"),
          updatedAt: new Date("2026-06-19T00:00:01.000Z"),
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
      await createComment("ticket-assigned", organizationId, ownerId, "c1");
      await createComment("ticket-assigned", organizationId, ownerId, "c2");
      await createComment("ticket-unassigned", organizationId, ownerId, "c1");

      const result = await findTicketsByOrganizationId({
        organizationId,
        assigneeId: ownerId,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("ticket-assigned");
      expect(result[0]?.commentCount).toBe(2);
    });
  });
});
