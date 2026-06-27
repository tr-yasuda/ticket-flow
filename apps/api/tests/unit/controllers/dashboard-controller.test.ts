import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOrganizationDashboardController } from "../../../src/controllers/dashboard-controller.js";
import * as dashboardService from "../../../src/services/dashboard-service.js";

function createTestContext({
  userId,
  organizationId,
}: {
  userId?: string;
  organizationId?: string;
} = {}): Context {
  const json = vi.fn();
  const c = {
    req: {
      valid: vi.fn().mockReturnValue(undefined),
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

describe("dashboard-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ダッシュボード取得成功時に 200 を返す", async () => {
    const now = new Date();
    vi.spyOn(dashboardService, "getOrganizationDashboard").mockResolvedValue({
      success: true,
      data: {
        ticketSummary: {
          total: 1,
          open: 1,
          inProgress: 0,
          closed: 0,
          undone: 1,
        },
        prioritySummary: {
          low: 0,
          medium: 1,
          high: 0,
          urgent: 0,
        },
        mySummary: {
          assignedUndone: 0,
        },
        recentActivity: [
          {
            id: "log-1",
            entityType: "ticket",
            entityId: "ticket-1",
            action: "create",
            actor: { id: "user-1", name: null },
            createdAt: now,
          },
        ],
      },
    });
    const c = createTestContext({
      userId: "user-1",
      organizationId: "org-1",
    });

    await getOrganizationDashboardController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          ticketSummary: {
            total: 1,
            open: 1,
            inProgress: 0,
            closed: 0,
            undone: 1,
          },
          prioritySummary: {
            low: 0,
            medium: 1,
            high: 0,
            urgent: 0,
          },
          mySummary: {
            assignedUndone: 0,
          },
          recentActivity: [
            {
              id: "log-1",
              entityType: "ticket",
              entityId: "ticket-1",
              action: "create",
              actor: { id: "user-1", name: null },
              createdAt: now.toISOString(),
            },
          ],
        },
      }),
      200,
    );
  });

  it("コンテキスト値が欠落している場合は HTTPException を投げる", async () => {
    const c = createTestContext({ organizationId: "org-1" });

    await expect(getOrganizationDashboardController(c)).rejects.toThrow();
  });

  it("組織メンバーでない場合に 403 を返す", async () => {
    vi.spyOn(dashboardService, "getOrganizationDashboard").mockResolvedValue({
      success: false,
      error: { type: "NOT_MEMBER", message: "組織のメンバーではありません" },
    });
    const c = createTestContext({
      userId: "user-1",
      organizationId: "org-1",
    });

    await getOrganizationDashboardController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
      }),
      403,
    );
  });

  it("サービス内部エラー時に 500 を返す", async () => {
    vi.spyOn(dashboardService, "getOrganizationDashboard").mockResolvedValue({
      success: false,
      error: {
        type: "INTERNAL",
        message: "ダッシュボードの取得に失敗しました",
      },
    });
    const c = createTestContext({
      userId: "user-1",
      organizationId: "org-1",
    });

    await getOrganizationDashboardController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
      }),
      500,
    );
  });
});
