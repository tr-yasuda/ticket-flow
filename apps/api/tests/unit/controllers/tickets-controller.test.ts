import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteTicketController,
  updateTicketAssigneeController,
  updateTicketController,
  updateTicketPriorityController,
  updateTicketStatusController,
} from "../../../src/controllers/tickets-controller.js";
import * as ticketService from "../../../src/services/ticket-service.js";

function createTestContext({
  body,
  userId,
  organizationId,
  organizationRole,
}: {
  body?: unknown;
  userId?: string;
  organizationId?: string;
  organizationRole?: "owner" | "admin" | "member" | "viewer";
} = {}): Context {
  const json = vi.fn();
  const c = {
    req: {
      valid: vi.fn().mockImplementation((target: string) => {
        if (target === "json") {
          return body;
        }
        if (target === "param") {
          return { ticketId: "550e8400-e29b-41d4-a716-446655440000" };
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

describe("tickets-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("updateTicketController", () => {
    it("更新成功時に 200 と commentCount を返す", async () => {
      const ticket = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        title: "updated",
        description: null,
        status: "open",
        priority: "medium",
        assigneeId: null,
        createdBy: "user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(ticketService, "updateTicket").mockResolvedValue({
        success: true,
        data: { ticket },
      });
      const c = createTestContext({
        body: { title: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketController(c);

      expect(ticketService.updateTicket).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        updatedBy: "user-id",
        title: "updated",
        description: undefined,
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            ...ticket,
            commentCount: 0,
          }),
        }),
        200,
      );
    });

    it("存在しないチケットの場合は 404 を返す", async () => {
      vi.spyOn(ticketService, "updateTicket").mockResolvedValue({
        success: false,
        error: { type: "ticket-not-found", message: "not found" },
      });
      const c = createTestContext({
        body: { title: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("バリデーションエラーの場合は 400 を返す", async () => {
      vi.spyOn(ticketService, "updateTicket").mockResolvedValue({
        success: false,
        error: { type: "validation-error", message: "invalid input" },
      });
      const c = createTestContext({
        body: { title: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
        }),
        400,
      );
    });

    it("不明なエラーの場合は 500 を返す", async () => {
      vi.spyOn(ticketService, "updateTicket").mockResolvedValue({
        success: false,
        error: { type: "unknown-error", message: "something went wrong" },
      });
      const c = createTestContext({
        body: { title: "updated" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });
  });

  describe("updateTicketStatusController", () => {
    it("更新成功時に 200 と commentCount を返す", async () => {
      const ticket = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        title: "task",
        description: null,
        status: "in-progress",
        priority: "medium",
        assigneeId: null,
        createdBy: "user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(ticketService, "updateTicketStatus").mockResolvedValue({
        success: true,
        data: { ticket },
      });
      const c = createTestContext({
        body: { status: "in-progress" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketStatusController(c);

      expect(ticketService.updateTicketStatus).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        status: "in-progress",
        updatedBy: "user-id",
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            ...ticket,
            commentCount: 0,
          }),
        }),
        200,
      );
    });

    it("存在しないチケットの場合は 404 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketStatus").mockResolvedValue({
        success: false,
        error: { type: "ticket-not-found", message: "not found" },
      });
      const c = createTestContext({
        body: { status: "in-progress" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketStatusController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("並行更新で競合が発生した場合は 409 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketStatus").mockResolvedValue({
        success: false,
        error: {
          type: "ticket-conflict",
          message: "チケットのステータスが変更されたため、更新できません。",
        },
      });
      const c = createTestContext({
        body: { status: "in-progress" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketStatusController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "CONFLICT",
            message: expect.stringContaining(
              "チケットのステータスが変更された",
            ),
          }),
        }),
        409,
      );
    });

    it("無効な遷移の場合は 400 を返し status フィールドの詳細を含む", async () => {
      vi.spyOn(ticketService, "updateTicketStatus").mockResolvedValue({
        success: false,
        error: {
          type: "validation-error",
          message: "ステータスを closed から open に変更することはできません",
        },
      });
      const c = createTestContext({
        body: { status: "open" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketStatusController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
            details: [
              {
                field: "status",
                message:
                  "ステータスを closed から open に変更することはできません",
              },
            ],
          }),
        }),
        400,
      );
    });

    it("不明なエラーの場合は 500 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketStatus").mockResolvedValue({
        success: false,
        error: { type: "unknown-error", message: "something went wrong" },
      });
      const c = createTestContext({
        body: { status: "in-progress" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketStatusController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });
  });

  describe("updateTicketPriorityController", () => {
    it("更新成功時に 200 と commentCount を返す", async () => {
      const ticket = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        title: "task",
        description: null,
        status: "open",
        priority: "urgent",
        assigneeId: null,
        createdBy: "user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(ticketService, "updateTicketPriority").mockResolvedValue({
        success: true,
        data: { ticket },
      });
      const c = createTestContext({
        body: { priority: "urgent" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketPriorityController(c);

      expect(ticketService.updateTicketPriority).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        priority: "urgent",
        updatedBy: "user-id",
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            ...ticket,
            commentCount: 0,
          }),
        }),
        200,
      );
    });

    it("存在しないチケットの場合は 404 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketPriority").mockResolvedValue({
        success: false,
        error: { type: "ticket-not-found", message: "not found" },
      });
      const c = createTestContext({
        body: { priority: "high" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketPriorityController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("並行更新で競合が発生した場合は 409 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketPriority").mockResolvedValue({
        success: false,
        error: {
          type: "ticket-conflict",
          message: "チケットの優先度が変更されたため、更新できません。",
        },
      });
      const c = createTestContext({
        body: { priority: "high" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketPriorityController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "CONFLICT",
            message: expect.stringContaining("チケットの優先度が変更された"),
          }),
        }),
        409,
      );
    });

    it("無効な優先度の場合は 400 を返し priority フィールドの詳細を含む", async () => {
      vi.spyOn(ticketService, "updateTicketPriority").mockResolvedValue({
        success: false,
        error: {
          type: "validation-error",
          message: "優先度の値が正しくありません",
        },
      });
      const c = createTestContext({
        body: { priority: "invalid" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketPriorityController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
            details: [
              {
                field: "priority",
                message: "優先度の値が正しくありません",
              },
            ],
          }),
        }),
        400,
      );
    });

    it("不明なエラーの場合は 500 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketPriority").mockResolvedValue({
        success: false,
        error: { type: "unknown-error", message: "something went wrong" },
      });
      const c = createTestContext({
        body: { priority: "high" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketPriorityController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });
  });

  describe("updateTicketAssigneeController", () => {
    it("更新成功時に 200 と commentCount を返す", async () => {
      const ticket = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        title: "task",
        description: null,
        status: "open",
        priority: "medium",
        assigneeId: "550e8400-e29b-41d4-a716-446655440002",
        createdBy: "user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(ticketService, "updateTicketAssignee").mockResolvedValue({
        success: true,
        data: { ticket },
      });
      const c = createTestContext({
        body: { assigneeId: "550e8400-e29b-41d4-a716-446655440002" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketAssigneeController(c);

      expect(ticketService.updateTicketAssignee).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        assigneeId: "550e8400-e29b-41d4-a716-446655440002",
        updatedBy: "user-id",
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            ...ticket,
            commentCount: 0,
          }),
        }),
        200,
      );
    });

    it("存在しないチケットの場合は 404 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketAssignee").mockResolvedValue({
        success: false,
        error: { type: "ticket-not-found", message: "not found" },
      });
      const c = createTestContext({
        body: { assigneeId: "550e8400-e29b-41d4-a716-446655440002" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketAssigneeController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "NOT_FOUND" }),
        }),
        404,
      );
    });

    it("担当者が組織メンバーでない場合は 400 を返し assigneeId フィールドの詳細を含む", async () => {
      vi.spyOn(ticketService, "updateTicketAssignee").mockResolvedValue({
        success: false,
        error: {
          type: "user-not-organization-member",
          message: "担当者が組織のメンバーではありません",
        },
      });
      const c = createTestContext({
        body: { assigneeId: "550e8400-e29b-41d4-a716-446655440002" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketAssigneeController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
            details: [
              {
                field: "assigneeId",
                message: "担当者は同じ組織のメンバーを指定してください",
              },
            ],
          }),
        }),
        400,
      );
    });

    it("無効な assigneeId の場合は 400 を返し assigneeId フィールドの詳細を含む", async () => {
      vi.spyOn(ticketService, "updateTicketAssignee").mockResolvedValue({
        success: false,
        error: {
          type: "validation-error",
          message: "担当者IDの形式が正しくありません",
        },
      });
      const c = createTestContext({
        body: { assigneeId: "invalid" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketAssigneeController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
            details: [
              {
                field: "assigneeId",
                message: "担当者IDの形式が正しくありません",
              },
            ],
          }),
        }),
        400,
      );
    });

    it("assigneeId: null で担当者を解除できる", async () => {
      const ticket = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        title: "task",
        description: null,
        status: "open",
        priority: "medium",
        assigneeId: null,
        createdBy: "user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(ticketService, "updateTicketAssignee").mockResolvedValue({
        success: true,
        data: { ticket },
      });
      const c = createTestContext({
        body: { assigneeId: null },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketAssigneeController(c);

      expect(ticketService.updateTicketAssignee).toHaveBeenCalledWith({
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        ticketId: "550e8400-e29b-41d4-a716-446655440000",
        assigneeId: null,
        updatedBy: "user-id",
      });
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            ...ticket,
            commentCount: 0,
          }),
        }),
        200,
      );
    });

    it("並行更新で競合が発生した場合は 409 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketAssignee").mockResolvedValue({
        success: false,
        error: {
          type: "ticket-conflict",
          message: "チケットの担当者が変更されたため、更新できません。",
        },
      });
      const c = createTestContext({
        body: { assigneeId: "550e8400-e29b-41d4-a716-446655440002" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketAssigneeController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "CONFLICT",
            message: expect.stringContaining("チケットの担当者が変更された"),
          }),
        }),
        409,
      );
    });

    it("不明なエラーの場合は 500 を返す", async () => {
      vi.spyOn(ticketService, "updateTicketAssignee").mockResolvedValue({
        success: false,
        error: { type: "unknown-error", message: "something went wrong" },
      });
      const c = createTestContext({
        body: { assigneeId: "550e8400-e29b-41d4-a716-446655440002" },
        userId: "user-id",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });

      await updateTicketAssigneeController(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
        }),
        500,
      );
    });
  });
});

describe("deleteTicketController", () => {
  it("削除成功時に 204 を返す", async () => {
    vi.spyOn(ticketService, "deleteTicket").mockResolvedValue({
      success: true,
      data: {
        ticket: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          organizationId: "550e8400-e29b-41d4-a716-446655440001",
          title: "deleted",
          description: null,
          status: "open",
          priority: "medium",
          assigneeId: null,
          createdBy: "user-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: new Date(),
        },
      },
    });
    const c = createTestContext({
      userId: "user-id",
      organizationId: "550e8400-e29b-41d4-a716-446655440001",
      organizationRole: "owner",
    });

    await deleteTicketController(c);

    expect(c.body).toHaveBeenCalledWith(null, 204);
    expect(ticketService.deleteTicket).toHaveBeenCalledWith({
      organizationId: "550e8400-e29b-41d4-a716-446655440001",
      ticketId: "550e8400-e29b-41d4-a716-446655440000",
      deletedBy: "user-id",
    });
  });

  it("チケットが存在しない場合は 404 を返す", async () => {
    vi.spyOn(ticketService, "deleteTicket").mockResolvedValue({
      success: false,
      error: { type: "ticket-not-found", message: "チケットが見つかりません" },
    });
    const c = createTestContext({
      userId: "user-id",
      organizationId: "550e8400-e29b-41d4-a716-446655440001",
      organizationRole: "admin",
    });

    await deleteTicketController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "NOT_FOUND" }),
      }),
      404,
    );
  });

  it("不明なエラーの場合は 500 を返す", async () => {
    vi.spyOn(ticketService, "deleteTicket").mockResolvedValue({
      success: false,
      error: { type: "unknown-error", message: "something went wrong" },
    });
    const c = createTestContext({
      userId: "user-id",
      organizationId: "550e8400-e29b-41d4-a716-446655440001",
      organizationRole: "owner",
    });

    await deleteTicketController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
      }),
      500,
    );
  });
});
