import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import {
  createComment,
  listCommentsByTicketId,
  type CreateCommentServiceInput,
} from "../../../src/services/comments-service.js";
import { createOrganization } from "../../../src/services/organizations-service.js";
import { cleanAll } from "../helpers/organization-test-helpers.js";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

async function seedOrganization(): Promise<{
  organizationId: string;
  ownerId: string;
  ticketId: string;
}> {
  const userResult = await registerUser({
    email: uniqueEmail("owner"),
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

  const ticket = await prisma.ticket.create({
    data: {
      id: randomUUID(),
      organizationId: organizationResult.data.id,
      title: "バグを修正する",
      createdBy: userResult.data.user.id,
    },
  });

  return {
    organizationId: organizationResult.data.id,
    ownerId: userResult.data.user.id,
    ticketId: ticket.id,
  };
}

describe("comments-service 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("コメントを作成できる", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const input: CreateCommentServiceInput = {
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "対応しました",
    };

    const result = await createComment(input);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.comment.content).toBe("対応しました");
    expect(result.data.comment.ticketId).toBe(ticketId);
    expect(result.data.comment.organizationId).toBe(organizationId);
    expect(result.data.comment.authorId).toBe(ownerId);

    const stored = await prisma.comment.findUnique({
      where: { id: result.data.comment.id },
    });
    expect(stored).not.toBeNull();
  });

  it("チケットが組織に属していない場合は作成できない", async () => {
    const first = await seedOrganization();
    const second = await seedOrganization();

    const input: CreateCommentServiceInput = {
      organizationId: first.organizationId,
      ticketId: second.ticketId,
      authorId: first.ownerId,
      content: "対応しました",
    };

    const result = await createComment(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("ticket-not-found");
    }
  });

  it("作成者が組織メンバーでない場合は作成できない", async () => {
    const { organizationId, ticketId } = await seedOrganization();
    const otherUserResult = await registerUser({
      email: uniqueEmail("other"),
      password: "password123",
    });
    expect(otherUserResult.success).toBe(true);
    if (!otherUserResult.success) {
      throw new Error("Failed to register user");
    }

    const input: CreateCommentServiceInput = {
      organizationId,
      ticketId,
      authorId: otherUserResult.data.user.id,
      content: "対応しました",
    };

    const result = await createComment(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("author-not-member");
    }
  });

  it("skipAuthorMembershipCheck が true の場合、作成者のメンバー資格確認をスキップする", async () => {
    const { organizationId, ticketId } = await seedOrganization();
    const otherUserResult = await registerUser({
      email: uniqueEmail("other"),
      password: "password123",
    });
    expect(otherUserResult.success).toBe(true);
    if (!otherUserResult.success) {
      throw new Error("Failed to register user");
    }

    const result = await createComment({
      organizationId,
      ticketId,
      authorId: otherUserResult.data.user.id,
      content: "membership check skipped",
      skipAuthorMembershipCheck: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment.content).toBe("membership check skipped");
    }
  });

  it("content の前後の空白は削除される", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const input: CreateCommentServiceInput = {
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "  対応しました  ",
    };

    const result = await createComment(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment.content).toBe("対応しました");
    }
  });

  it("空の content は拒否される", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const input: CreateCommentServiceInput = {
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "   ",
    };

    const result = await createComment(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("validation-error");
    }
  });

  it("チケットのコメント一覧と総件数を取得できる", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();

    await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "最初のコメント",
    });
    await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "2番目のコメント",
    });

    const result = await listCommentsByTicketId({
      organizationId,
      ticketId,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(2);
      expect(result.data.comments).toHaveLength(2);
      expect(result.data.comments[0]?.content).toBe("2番目のコメント");
    }
  });

  it("他組織のチケットのコメント一覧は取得できない", async () => {
    const first = await seedOrganization();
    const second = await seedOrganization();

    await createComment({
      organizationId: first.organizationId,
      ticketId: first.ticketId,
      authorId: first.ownerId,
      content: "first comment",
    });

    const result = await listCommentsByTicketId({
      organizationId: first.organizationId,
      ticketId: second.ticketId,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("ticket-not-found");
    }
  });

  it("ページネーションで take がクランプされる", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();

    await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "older",
    });
    await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "newer",
    });

    const result = await listCommentsByTicketId({
      organizationId,
      ticketId,
      take: 0,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comments).toHaveLength(1);
      expect(result.data.total).toBe(2);
    }
  });
});
