import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { rehydrateComment } from "../../../../src/domain/comment.js";
import {
  findCommentsByTicketId,
  saveComment,
} from "../../../../src/infrastructure/database/comment-repository.js";
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

async function createTicket(
  organizationId: string,
  createdBy: string,
): Promise<string> {
  const ticket = await prisma.ticket.create({
    data: {
      id: randomUUID(),
      organizationId,
      title: "バグを修正する",
      createdBy,
    },
  });
  return ticket.id;
}

async function seedOrganizationWithTicket(): Promise<{
  organizationId: string;
  ownerId: string;
  ticketId: string;
}> {
  const ownerId = await createUser(`owner-${randomUUID()}@example.com`);
  const organizationId = await createOrganization(ownerId);
  const ticketId = await createTicket(organizationId, ownerId);
  return { organizationId, ownerId, ticketId };
}

describe("comment-repository 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("コメントを作成できる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "対応しました",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T01:00:00.000Z"),
    });

    const saved = await saveComment(comment);

    expect(saved).toEqual(comment);

    const stored = await prisma.comment.findUnique({
      where: { id: saved.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.ticketId).toBe(ticketId);
    expect(stored?.organizationId).toBe(organizationId);
    expect(stored?.authorId).toBe(ownerId);
    expect(stored?.content).toBe("対応しました");
  });

  it("チケットのコメントを取得できる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();
    const otherTicketId = await createTicket(organizationId, ownerId);

    const firstComment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "最初のコメント",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    const secondComment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "2番目のコメント",
      createdAt: new Date("2026-06-19T00:00:01.000Z"),
      updatedAt: new Date("2026-06-19T00:00:01.000Z"),
    });
    const otherTicketComment = rehydrateComment({
      id: randomUUID(),
      ticketId: otherTicketId,
      organizationId,
      authorId: ownerId,
      content: "別チケットのコメント",
      createdAt: new Date("2026-06-19T00:00:02.000Z"),
      updatedAt: new Date("2026-06-19T00:00:02.000Z"),
    });

    await saveComment(firstComment);
    await saveComment(secondComment);
    await saveComment(otherTicketComment);

    const result = await findCommentsByTicketId({
      organizationId,
      ticketId,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(secondComment.id);
    expect(result[1]?.id).toBe(firstComment.id);
  });

  it("他組織のコメントはチケット取得結果に含まれない", async () => {
    const first = await seedOrganizationWithTicket();
    const second = await seedOrganizationWithTicket();

    const firstComment = rehydrateComment({
      id: randomUUID(),
      ticketId: first.ticketId,
      organizationId: first.organizationId,
      authorId: first.ownerId,
      content: "first organization comment",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    const secondComment = rehydrateComment({
      id: randomUUID(),
      ticketId: second.ticketId,
      organizationId: second.organizationId,
      authorId: second.ownerId,
      content: "second organization comment",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });

    await saveComment(firstComment);
    await saveComment(secondComment);

    const result = await findCommentsByTicketId({
      organizationId: first.organizationId,
      ticketId: first.ticketId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(firstComment.id);
    expect(result[0]?.organizationId).toBe(first.organizationId);
  });

  it("ページネーションの take がクランプされる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const older = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "older",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    const newer = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "newer",
      createdAt: new Date("2026-06-19T00:00:01.000Z"),
      updatedAt: new Date("2026-06-19T00:00:01.000Z"),
    });

    await saveComment(older);
    await saveComment(newer);

    const takeZero = await findCommentsByTicketId({
      organizationId,
      ticketId,
      take: 0,
    });
    expect(takeZero).toHaveLength(1);
    expect(takeZero[0]?.id).toBe(newer.id);

    const takeOne = await findCommentsByTicketId({
      organizationId,
      ticketId,
      take: 1,
    });
    expect(takeOne).toHaveLength(1);
    expect(takeOne[0]?.id).toBe(newer.id);

    const takeHuge = await findCommentsByTicketId({
      organizationId,
      ticketId,
      take: 100_000,
    });
    expect(takeHuge).toHaveLength(2);
  });

  it("ページネーションの skip がクランプされる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "comment",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveComment(comment);

    const skipNegative = await findCommentsByTicketId({
      organizationId,
      ticketId,
      skip: -1,
    });
    expect(skipNegative).toHaveLength(1);

    const skipHuge = await findCommentsByTicketId({
      organizationId,
      ticketId,
      skip: 100_000,
    });
    expect(skipHuge).toHaveLength(0);
  });

  it("重複した id を保存すると一意制約違反のエラーになる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();
    const commentId = randomUUID();

    const comment = rehydrateComment({
      id: commentId,
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "first",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await saveComment(comment);

    await expect(saveComment(comment)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );

    try {
      await saveComment(comment);
    } catch (error) {
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        expect(error.code).toBe("P2002");
      }
    }
  });

  it("存在しない組織IDを指定すると外部キー制約違反のエラーになる", async () => {
    const { ownerId, ticketId } = await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId: randomUUID(),
      authorId: ownerId,
      content: "対応しました",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await assertForeignKeyViolation(saveComment(comment));
  });

  it("存在しないチケットIDを指定すると外部キー制約違反のエラーになる", async () => {
    const { organizationId, ownerId } = await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId: randomUUID(),
      organizationId,
      authorId: ownerId,
      content: "対応しました",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await assertForeignKeyViolation(saveComment(comment));
  });

  it("存在しない作成者IDを指定すると外部キー制約違反のエラーになる", async () => {
    const { organizationId, ticketId } = await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: randomUUID(),
      content: "対応しました",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await assertForeignKeyViolation(saveComment(comment));
  });

  it("チケット削除時に関連コメントがカスケード削除される", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "対応しました",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveComment(comment);

    await prisma.ticket.delete({ where: { id: ticketId } });

    const stored = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(stored).toBeNull();
  });

  it("コメントを持つ組織は削除できない", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "対応しました",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveComment(comment);

    await expect(
      prisma.organization.delete({ where: { id: organizationId } }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it("コメントを持つ作成者は削除できない", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "対応しました",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveComment(comment);

    await expect(
      prisma.user.delete({ where: { id: ownerId } }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });
});

async function assertForeignKeyViolation(
  promise: Promise<unknown>,
): Promise<void> {
  await expect(promise).rejects.toThrow(Prisma.PrismaClientKnownRequestError);

  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      expect(error.code).toBe("P2003");
    }
  }
}
