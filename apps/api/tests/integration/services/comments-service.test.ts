import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import {
  createComment,
  deleteComment,
  listCommentsByTicketId,
  updateComment,
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
  ownerEmail: string;
  ticketId: string;
}> {
  const ownerEmail = uniqueEmail("owner");
  const userResult = await registerUser({
    email: ownerEmail,
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
    ownerEmail,
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
    expect(result.data.comment.author.id).toBe(ownerId);

    const stored = await prisma.comment.findUnique({
      where: { id: result.data.comment.id },
    });
    expect(stored).not.toBeNull();

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "comment",
        entityId: result.data.comment.id,
        action: "create",
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.actorId).toBe(ownerId);
    expect(auditLogs[0]?.newValues).toMatchObject({
      ticketId,
      content: "対応しました",
    });
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
    const { organizationId, ownerId, ownerEmail, ticketId } =
      await seedOrganization();

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
      expect(result.data.comments[0]?.author.id).toBe(ownerId);
      expect(result.data.comments[0]?.author.email).toBe(ownerEmail);
      expect(result.data.comments[0]?.author.name).toBeNull();
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

  it("自分のコメントを更新できる", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const created = await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "original",
    });
    expect(created.success).toBe(true);
    if (!created.success) {
      return;
    }

    const result = await updateComment({
      organizationId,
      ticketId,
      commentId: created.data.comment.id,
      actorId: ownerId,
      content: "updated",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment.content).toBe("updated");
      expect(result.data.comment.author.id).toBe(ownerId);
    }
  });

  it("他のユーザーのコメントは更新できない", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const otherUserResult = await registerUser({
      email: uniqueEmail("other"),
      password: "password123",
    });
    expect(otherUserResult.success).toBe(true);
    if (!otherUserResult.success) {
      throw new Error("Failed to register user");
    }
    await prisma.organizationMember.create({
      data: {
        id: randomUUID(),
        organizationId,
        userId: otherUserResult.data.user.id,
        role: "member",
      },
    });
    const created = await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "original",
    });
    expect(created.success).toBe(true);
    if (!created.success) {
      return;
    }

    const result = await updateComment({
      organizationId,
      ticketId,
      commentId: created.data.comment.id,
      actorId: otherUserResult.data.user.id,
      content: "updated",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("not-comment-author");
    }
  });

  it("同じ内容の更新は監査ログを残さず冪等に成功する", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const created = await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "original",
    });
    expect(created.success).toBe(true);
    if (!created.success) {
      return;
    }

    const beforeCount = await prisma.auditLog.count({
      where: {
        organizationId,
        entityType: "comment",
        entityId: created.data.comment.id,
        action: "update",
      },
    });

    const result = await updateComment({
      organizationId,
      ticketId,
      commentId: created.data.comment.id,
      actorId: ownerId,
      content: "original",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment.content).toBe("original");
    }
    const afterCount = await prisma.auditLog.count({
      where: {
        organizationId,
        entityType: "comment",
        entityId: created.data.comment.id,
        action: "update",
      },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it("組織メンバーでないユーザーは更新できない", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const outsiderResult = await registerUser({
      email: uniqueEmail("outsider"),
      password: "password123",
    });
    expect(outsiderResult.success).toBe(true);
    if (!outsiderResult.success) {
      throw new Error("Failed to register user");
    }
    const created = await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "original",
    });
    expect(created.success).toBe(true);
    if (!created.success) {
      return;
    }

    const result = await updateComment({
      organizationId,
      ticketId,
      commentId: created.data.comment.id,
      actorId: outsiderResult.data.user.id,
      content: "updated",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("author-not-member");
    }
  });

  it("存在しないコメントは更新できない", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();

    const result = await updateComment({
      organizationId,
      ticketId,
      commentId: "550e8400-e29b-41d4-a716-446655440000",
      actorId: ownerId,
      content: "updated",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("comment-not-found");
    }
  });

  it("別のチケットのコメントは更新できない", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const otherTicket = await prisma.ticket.create({
      data: {
        id: randomUUID(),
        organizationId,
        title: "other ticket",
        createdBy: ownerId,
      },
    });
    const created = await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "original",
    });
    expect(created.success).toBe(true);
    if (!created.success) {
      return;
    }

    const result = await updateComment({
      organizationId,
      ticketId: otherTicket.id,
      commentId: created.data.comment.id,
      actorId: ownerId,
      content: "updated",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("comment-not-found");
    }
  });

  it("空の content は拒否される", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const created = await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "original",
    });
    expect(created.success).toBe(true);
    if (!created.success) {
      return;
    }

    const result = await updateComment({
      organizationId,
      ticketId,
      commentId: created.data.comment.id,
      actorId: ownerId,
      content: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("validation-error");
    }
  });

  it("更新成功時に監査ログが記録される", async () => {
    const { organizationId, ownerId, ticketId } = await seedOrganization();
    const created = await createComment({
      organizationId,
      ticketId,
      authorId: ownerId,
      content: "original",
    });
    expect(created.success).toBe(true);
    if (!created.success) {
      return;
    }

    const result = await updateComment({
      organizationId,
      ticketId,
      commentId: created.data.comment.id,
      actorId: ownerId,
      content: "updated",
    });

    expect(result.success).toBe(true);
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "comment",
        entityId: created.data.comment.id,
        action: "update",
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.actorId).toBe(ownerId);
    expect(auditLogs[0]?.oldValues).toMatchObject({ content: "original" });
    expect(auditLogs[0]?.newValues).toMatchObject({ content: "updated" });
  });

  describe("deleteComment", () => {
    it("投稿者は自分のコメントを削除できる", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "delete me",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      const result = await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: ownerId,
      });

      expect(result.success).toBe(true);
      const stored = await prisma.comment.findUnique({
        where: { id: created.data.comment.id },
      });
      expect(stored?.deletedAt).not.toBeNull();
    });

    it("Owner は他ユーザーのコメントを削除できる", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const memberResult = await registerUser({
        email: uniqueEmail("member"),
        password: "password123",
      });
      expect(memberResult.success).toBe(true);
      if (!memberResult.success) {
        throw new Error("Failed to register user");
      }
      await prisma.organizationMember.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId: memberResult.data.user.id,
          role: "member",
        },
      });
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: memberResult.data.user.id,
        content: "delete by owner",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      const result = await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: ownerId,
      });

      expect(result.success).toBe(true);
    });

    it("Admin は他ユーザーのコメントを削除できる", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const adminResult = await registerUser({
        email: uniqueEmail("admin"),
        password: "password123",
      });
      expect(adminResult.success).toBe(true);
      if (!adminResult.success) {
        throw new Error("Failed to register user");
      }
      await prisma.organizationMember.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId: adminResult.data.user.id,
          role: "admin",
        },
      });
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "delete by admin",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      const result = await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: adminResult.data.user.id,
      });

      expect(result.success).toBe(true);
    });

    it("Member は他ユーザーのコメントを削除できない", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const memberResult = await registerUser({
        email: uniqueEmail("member"),
        password: "password123",
      });
      expect(memberResult.success).toBe(true);
      if (!memberResult.success) {
        throw new Error("Failed to register user");
      }
      await prisma.organizationMember.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId: memberResult.data.user.id,
          role: "member",
        },
      });
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "owner comment",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      const result = await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: memberResult.data.user.id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("not-comment-author");
      }
      const stored = await prisma.comment.findUnique({
        where: { id: created.data.comment.id },
      });
      expect(stored?.deletedAt).toBeNull();
    });

    it("存在しないコメントは削除できない", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();

      const result = await deleteComment({
        organizationId,
        ticketId,
        commentId: "550e8400-e29b-41d4-a716-446655440000",
        actorId: ownerId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("comment-not-found");
      }
    });

    it("別のチケットのコメントは削除できない", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const otherTicket = await prisma.ticket.create({
        data: {
          id: randomUUID(),
          organizationId,
          title: "other ticket",
          createdBy: ownerId,
        },
      });
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "original",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      const result = await deleteComment({
        organizationId,
        ticketId: otherTicket.id,
        commentId: created.data.comment.id,
        actorId: ownerId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("comment-not-found");
      }
    });

    it("組織メンバーでないユーザーは削除できない", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "original",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }
      const outsiderResult = await registerUser({
        email: uniqueEmail("outsider"),
        password: "password123",
      });
      expect(outsiderResult.success).toBe(true);
      if (!outsiderResult.success) {
        throw new Error("Failed to register user");
      }

      const result = await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: outsiderResult.data.user.id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("author-not-member");
      }
    });

    it("削除成功時に監査ログが記録される", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "to be deleted",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      const result = await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: ownerId,
      });

      expect(result.success).toBe(true);
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          organizationId,
          entityType: "comment",
          entityId: created.data.comment.id,
          action: "delete",
        },
      });
      expect(auditLogs).toHaveLength(1);
      const auditLog = auditLogs[0];
      expect(auditLog).toBeDefined();
      expect(auditLog!.actorId).toBe(ownerId);
      expect(auditLog!.oldValues).toMatchObject({ content: "to be deleted" });
      expect(
        (auditLog!.newValues as { deletedAt?: string }).deletedAt,
      ).toBeDefined();
    });

    it("削除済みのコメントは一覧に含まれず total が減少する", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "will be hidden",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: ownerId,
      });

      const listResult = await listCommentsByTicketId({
        organizationId,
        ticketId,
      });
      expect(listResult.success).toBe(true);
      if (listResult.success) {
        expect(listResult.data.comments).toHaveLength(0);
        expect(listResult.data.total).toBe(0);
      }
    });

    it("削除済みのコメントを更新しようとすると not-comment-author ではなく not-found になる", async () => {
      const { organizationId, ownerId, ticketId } = await seedOrganization();
      const created = await createComment({
        organizationId,
        ticketId,
        authorId: ownerId,
        content: "original",
      });
      expect(created.success).toBe(true);
      if (!created.success) {
        return;
      }

      await deleteComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: ownerId,
      });

      const result = await updateComment({
        organizationId,
        ticketId,
        commentId: created.data.comment.id,
        actorId: ownerId,
        content: "updated after delete",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("comment-not-found");
      }
    });
  });
});
