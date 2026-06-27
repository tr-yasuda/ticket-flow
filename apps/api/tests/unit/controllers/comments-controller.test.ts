import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCommentController,
  deleteCommentController,
  listCommentsController,
  updateCommentController,
} from "../../../src/controllers/comments-controller.js";
import * as commentsService from "../../../src/services/comments-service.js";

function createTestContext({
  body,
  userId,
  organizationId,
  organizationRole,
}: {
  body?: unknown;
  userId?: string;
  organizationId?: string;
  organizationRole?: string;
} = {}): Context {
  const json = vi.fn();
  const c = {
    req: {
      valid: vi.fn().mockImplementation((target: string) => {
        if (target === "json") {
          return body;
        }
        if (target === "param") {
          return {
            ticketId: "550e8400-e29b-41d4-a716-446655440000",
            commentId: "550e8400-e29b-41d4-a716-446655440001",
          };
        }
        if (target === "query") {
          return { page: 1, perPage: 20 };
        }
        return undefined;
      }),
      header: vi.fn().mockReturnValue(undefined),
    },
    json,
    body: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "userId") {
        return userId;
      }
      if (key === "organizationId") {
        return organizationId;
      }
      if (key === "organizationRole") {
        return organizationRole;
      }
      return undefined;
    }),
  } as unknown as Context;
  return c;
}

describe("comments-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("createCommentController", () => {
    it("作成成功時に 201 とコメントを返す", async () => {
      const comment = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        content: "hello",
        author: {
          id: "user-id",
          name: null,
          email: "user@example.com",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.spyOn(commentsService, "createComment").mockResolvedValue({
        success: true,
        data: { comment },
      });
      const c = createTestContext({
        body: { content: "hello" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await createCommentController(c);

      expect(commentsService.createComment).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        authorId: "user-id",
        content: "hello",
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: comment,
        }),
        201,
      );
    });

    it("存在しないチケットの場合は 404 を返す", async () => {
      vi.spyOn(commentsService, "createComment").mockResolvedValue({
        success: false,
        error: { type: "ticket-not-found", message: "not found" },
      });
      const c = createTestContext({
        body: { content: "hello" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await createCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("作成者が組織メンバーでない場合は 403 を返す", async () => {
      vi.spyOn(commentsService, "createComment").mockResolvedValue({
        success: false,
        error: { type: "author-not-member", message: "not a member" },
      });
      const c = createTestContext({
        body: { content: "hello" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await createCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
        }),
        403,
      );
    });

    it("バリデーションエラーの場合は 400 を返す", async () => {
      vi.spyOn(commentsService, "createComment").mockResolvedValue({
        success: false,
        error: { type: "validation-error", message: "invalid input" },
      });
      const c = createTestContext({
        body: { content: "hello" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await createCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
        }),
        400,
      );
    });

    it("監査ログエラーの場合は 500 を返す", async () => {
      vi.spyOn(commentsService, "createComment").mockResolvedValue({
        success: false,
        error: { type: "audit-log-error", message: "audit failed" },
      });
      const c = createTestContext({
        body: { content: "hello" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await createCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });

    it("不明なエラーの場合は 500 を返す", async () => {
      vi.spyOn(commentsService, "createComment").mockResolvedValue({
        success: false,
        error: { type: "unknown-error", message: "something went wrong" },
      });
      const c = createTestContext({
        body: { content: "hello" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await createCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });

    it("コンテキスト値が欠落している場合は HTTPException を投げる", async () => {
      const c = createTestContext({
        body: { content: "hello" },
      });

      await expect(createCommentController(c)).rejects.toThrow();
    });
  });

  describe("updateCommentController", () => {
    it("更新成功時に 200 とコメントを返す", async () => {
      const comment = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        content: "updated",
        author: {
          id: "user-id",
          name: null,
          email: "user@example.com",
        },
        isEdited: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: true,
        data: { comment },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(commentsService.updateComment).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        commentId: "550e8400-e29b-41d4-a716-446655440001",
        actorId: "user-id",
        content: "updated",
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: comment,
        }),
        200,
      );
    });

    it("存在しないコメントの場合は 404 を返す", async () => {
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: false,
        error: { type: "comment-not-found", message: "not found" },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("存在しないチケットの場合は 404 を返す", async () => {
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: false,
        error: { type: "ticket-not-found", message: "not found" },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("投稿者以外の場合は 403 を返す", async () => {
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: false,
        error: { type: "not-comment-author", message: "forbidden" },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
        }),
        403,
      );
    });

    it("組織メンバーでない場合は 403 を返す", async () => {
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: false,
        error: { type: "author-not-member", message: "not member" },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
        }),
        403,
      );
    });

    it("バリデーションエラーの場合は 400 を返す", async () => {
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: false,
        error: { type: "validation-error", message: "invalid input" },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
        }),
        400,
      );
    });

    it("監査ログエラーの場合は 500 を返す", async () => {
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: false,
        error: { type: "audit-log-error", message: "audit failed" },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });

    it("不明なエラーの場合は 500 を返す", async () => {
      vi.spyOn(commentsService, "updateComment").mockResolvedValue({
        success: false,
        error: { type: "unknown-error", message: "something went wrong" },
      });
      const c = createTestContext({
        body: { content: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await updateCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });

    it("コンテキスト値が欠落している場合は HTTPException を投げる", async () => {
      const c = createTestContext({
        body: { content: "updated" },
      });

      await expect(updateCommentController(c)).rejects.toThrow();
    });
  });

  describe("listCommentsController", () => {
    it("コメント一覧取得成功時に 200 と一覧を返す", async () => {
      const comments = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          ticketId: "550e8400-e29b-41d4-a716-446655440000",
          organizationId: "550e8400-e29b-41d4-a716-446655440002",
          content: "hello",
          author: {
            id: "user-id",
            name: null,
            email: "user@example.com",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      vi.spyOn(commentsService, "listCommentsByTicketId").mockResolvedValue({
        success: true,
        data: { comments, total: 1 },
      });
      const c = createTestContext({
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await listCommentsController(c);

      expect(commentsService.listCommentsByTicketId).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        skip: 0,
        take: 20,
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { comments },
          meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
        }),
        200,
      );
    });

    it("存在しないチケットの場合は 404 を返す", async () => {
      vi.spyOn(commentsService, "listCommentsByTicketId").mockResolvedValue({
        success: false,
        error: { type: "ticket-not-found", message: "not found" },
      });
      const c = createTestContext({
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await listCommentsController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("不明なエラーの場合は 500 を返す", async () => {
      vi.spyOn(commentsService, "listCommentsByTicketId").mockResolvedValue({
        success: false,
        error: { type: "unknown-error", message: "something went wrong" },
      });
      const c = createTestContext({
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
      });

      await listCommentsController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });

    it("コンテキスト値が欠落している場合は HTTPException を投げる", async () => {
      const c = createTestContext();

      await expect(listCommentsController(c)).rejects.toThrow();
    });
  });

  describe("deleteCommentController", () => {
    it("削除成功時に 204 No Content を返す", async () => {
      vi.spyOn(commentsService, "deleteComment").mockResolvedValue({
        success: true,
      });
      const c = createTestContext({
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        organizationRole: "member",
      });

      await deleteCommentController(c);

      expect(commentsService.deleteComment).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        commentId: "550e8400-e29b-41d4-a716-446655440001",
        actorId: "user-id",
      });
      expect(c.body).toHaveBeenCalledWith(null, 204);
    });

    it("存在しないコメントの場合は 404 を返す", async () => {
      vi.spyOn(commentsService, "deleteComment").mockResolvedValue({
        success: false,
        error: { type: "comment-not-found", message: "not found" },
      });
      const c = createTestContext({
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        organizationRole: "member",
      });

      await deleteCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("削除権限がない場合は 403 を返す", async () => {
      vi.spyOn(commentsService, "deleteComment").mockResolvedValue({
        success: false,
        error: { type: "not-comment-author", message: "forbidden" },
      });
      const c = createTestContext({
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        organizationRole: "member",
      });

      await deleteCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
        }),
        403,
      );
    });

    it("組織メンバーでない場合は 403 を返す", async () => {
      vi.spyOn(commentsService, "deleteComment").mockResolvedValue({
        success: false,
        error: { type: "author-not-member", message: "not member" },
      });
      const c = createTestContext({
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        organizationRole: "member",
      });

      await deleteCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
        }),
        403,
      );
    });

    it("監査ログエラーの場合は 500 を返す", async () => {
      vi.spyOn(commentsService, "deleteComment").mockResolvedValue({
        success: false,
        error: { type: "audit-log-error", message: "audit failed" },
      });
      const c = createTestContext({
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440002",
        organizationRole: "member",
      });

      await deleteCommentController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });

    it("コンテキスト値が欠落している場合は HTTPException を投げる", async () => {
      const c = createTestContext();

      await expect(deleteCommentController(c)).rejects.toThrow();
    });
  });
});
