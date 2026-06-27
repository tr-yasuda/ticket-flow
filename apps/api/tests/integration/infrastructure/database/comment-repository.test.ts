import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { rehydrateComment } from "../../../../src/domain/comment.js";
import {
  countCommentsByTicketId,
  findCommentWithAuthorById,
  findCommentsWithAuthorByTicketId,
  saveComment,
  softDeleteComment,
  updateComment,
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

  it("コメントの内容を更新できる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "original",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveComment(comment);

    const updated = await updateComment({
      commentId: comment.id,
      organizationId,
      content: "updated",
    });

    expect(updated.id).toBe(comment.id);
    expect(updated.content).toBe("updated");
    expect(updated.author.id).toBe(ownerId);
    expect(updated.isEdited).toBe(true);

    const stored = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.content).toBe("updated");
    expect(stored?.updatedAt.getTime()).toBeGreaterThan(
      comment.updatedAt.getTime(),
    );
  });

  it("作成直後のコメントは isEdited が false", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "original",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveComment(comment);

    const found = await findCommentWithAuthorById({
      commentId: comment.id,
      organizationId,
    });

    expect(found).not.toBeNull();
    expect(found?.isEdited).toBe(false);
  });

  it("チケットのコメントを作成日時降順で取得できる", async () => {
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

    const result = await findCommentsWithAuthorByTicketId({
      organizationId,
      ticketId,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(secondComment.id);
    expect(result[1]?.id).toBe(firstComment.id);
    expect(result[0]?.author.id).toBe(ownerId);
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

    const result = await findCommentsWithAuthorByTicketId({
      organizationId: first.organizationId,
      ticketId: first.ticketId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(firstComment.id);
    expect(result[0]?.organizationId).toBe(first.organizationId);
    expect(result[0]?.author.id).toBe(first.ownerId);
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

    const takeZero = await findCommentsWithAuthorByTicketId({
      organizationId,
      ticketId,
      take: 0,
    });
    expect(takeZero).toHaveLength(1);
    expect(takeZero[0]?.id).toBe(newer.id);

    const takeOne = await findCommentsWithAuthorByTicketId({
      organizationId,
      ticketId,
      take: 1,
    });
    expect(takeOne).toHaveLength(1);
    expect(takeOne[0]?.id).toBe(newer.id);

    const takeHuge = await findCommentsWithAuthorByTicketId({
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

    const skipNegative = await findCommentsWithAuthorByTicketId({
      organizationId,
      ticketId,
      skip: -1,
    });
    expect(skipNegative).toHaveLength(1);

    const skipHuge = await findCommentsWithAuthorByTicketId({
      organizationId,
      ticketId,
      skip: 100_000,
    });
    expect(skipHuge).toHaveLength(0);
  });

  it("ID で作者情報を含むコメントを取得できる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "対応しました",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveComment(comment);

    const result = await findCommentWithAuthorById({
      commentId: comment.id,
      organizationId,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(comment.id);
    expect(result?.content).toBe(comment.content);
    expect(result?.author.id).toBe(ownerId);
    expect(result?.createdAt).toBe(comment.createdAt.toISOString());
  });

  it("存在しないコメントIDを指定すると null を返す", async () => {
    const { organizationId } = await seedOrganizationWithTicket();
    const result = await findCommentWithAuthorById({
      commentId: randomUUID(),
      organizationId,
    });
    expect(result).toBeNull();
  });

  it("他組織のコメントIDを指定すると null を返す", async () => {
    const first = await seedOrganizationWithTicket();
    const second = await seedOrganizationWithTicket();

    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId: first.ticketId,
      organizationId: first.organizationId,
      authorId: first.ownerId,
      content: "first organization comment",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    await saveComment(comment);

    const result = await findCommentWithAuthorById({
      commentId: comment.id,
      organizationId: second.organizationId,
    });
    expect(result).toBeNull();
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

  it("作者情報を JOIN して取得できる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    expect(owner).not.toBeNull();

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

    const result = await findCommentsWithAuthorByTicketId({
      organizationId,
      ticketId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(comment.id);
    expect(result[0]?.author.id).toBe(ownerId);
    expect(result[0]?.author.email).toBe(owner?.email);
    expect(result[0]?.author.name).toBeNull();
  });

  it("チケットの未削除コメント数を取得できる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();

    const first = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "first",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T00:00:00.000Z"),
    });
    const second = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "second",
      createdAt: new Date("2026-06-19T00:00:01.000Z"),
      updatedAt: new Date("2026-06-19T00:00:01.000Z"),
    });
    await saveComment(first);
    await saveComment(second);
    await softDeleteComment({ commentId: first.id, organizationId });

    const count = await countCommentsByTicketId({ organizationId, ticketId });

    expect(count).toBe(1);
  });

  it("論理削除できる", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();
    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "to delete",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveComment(comment);

    const deletedAt = await softDeleteComment({
      commentId: comment.id,
      organizationId,
    });

    expect(deletedAt).not.toBeNull();
    const stored = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(stored?.deletedAt).not.toBeNull();
  });

  it("削除済みのコメントを再削除しようとすると null を返す", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();
    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "already deleted",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveComment(comment);
    await softDeleteComment({ commentId: comment.id, organizationId });

    const deletedAt = await softDeleteComment({
      commentId: comment.id,
      organizationId,
    });

    expect(deletedAt).toBeNull();
  });

  it("削除済みコメントは ID 取得から除外される", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();
    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "deleted",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveComment(comment);
    await softDeleteComment({ commentId: comment.id, organizationId });

    const found = await findCommentWithAuthorById({
      commentId: comment.id,
      organizationId,
    });

    expect(found).toBeNull();
  });

  it("削除済みコメントはチケット一覧から除外される", async () => {
    const { organizationId, ownerId, ticketId } =
      await seedOrganizationWithTicket();
    const comment = rehydrateComment({
      id: randomUUID(),
      ticketId,
      organizationId,
      authorId: ownerId,
      content: "deleted",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveComment(comment);
    await softDeleteComment({ commentId: comment.id, organizationId });

    const result = await findCommentsWithAuthorByTicketId({
      organizationId,
      ticketId,
    });

    expect(result).toHaveLength(0);
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
