import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateTicketController } from "../../../src/controllers/tickets-controller.js";
import * as ticketService from "../../../src/services/ticket-service.js";

function createTestContext({
  body,
  userId,
  organizationId,
}: {
  body?: unknown;
  userId?: string;
  organizationId?: string;
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

    it("担当者が組織メンバーでない場合は 400 を返す", async () => {
      vi.spyOn(ticketService, "updateTicket").mockResolvedValue({
        success: false,
        error: {
          type: "user-not-organization-member",
          message: "not a member",
        },
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
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
            details: expect.arrayContaining([
              expect.objectContaining({ field: "assigneeId" }),
            ]),
          }),
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
});
