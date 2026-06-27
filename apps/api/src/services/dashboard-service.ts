import type { PrismaClient } from "@prisma/client";

import { TicketPriority, TicketStatus } from "../domain/ticket.js";
import {
  countTicketsByPriority,
  countTicketsByStatus,
  countAssignedUndoneTickets,
  findRecentDashboardActivity,
} from "../infrastructure/database/dashboard-repository.js";
import { prisma } from "../lib/prisma.js";

export type DashboardTicketSummary = Readonly<{
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  undone: number;
}>;

export type DashboardPrioritySummary = Readonly<{
  low: number;
  medium: number;
  high: number;
  urgent: number;
}>;

export type DashboardMySummary = Readonly<{
  assignedUndone: number;
}>;

export type DashboardRecentActivityActor = Readonly<{
  id: string;
  name: string | null;
}>;

export type DashboardRecentActivityItem = Readonly<{
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: DashboardRecentActivityActor | null;
  createdAt: Date;
}>;

export type OrganizationDashboard = Readonly<{
  ticketSummary: DashboardTicketSummary;
  prioritySummary: DashboardPrioritySummary;
  mySummary: DashboardMySummary;
  recentActivity: readonly DashboardRecentActivityItem[];
}>;

export type DashboardAggregationResult = Readonly<{
  statusCounts: Awaited<ReturnType<typeof countTicketsByStatus>>;
  priorityCounts: Awaited<ReturnType<typeof countTicketsByPriority>>;
  assignedUndone: Awaited<ReturnType<typeof countAssignedUndoneTickets>>;
  recentActivity: Awaited<ReturnType<typeof findRecentDashboardActivity>>;
}>;

export type DashboardError = Readonly<
  | {
      type: "NOT_MEMBER";
      message: string;
    }
  | {
      type: "INTERNAL";
      message: string;
    }
>;

export type GetOrganizationDashboardResult =
  | { success: true; data: OrganizationDashboard }
  | { success: false; error: DashboardError };

export type GetOrganizationDashboardInput = Readonly<{
  organizationId: string;
  userId: string;
  /**
   * 組織メンバーシップチェックをスキップする。
   * 呼び出し元で既にメンバーシップを確認している場合（例: organizationScopeMiddleware 経由）に true を指定する。
   */
  skipMembershipCheck?: boolean;
}>;

export async function getOrganizationDashboard(
  input: GetOrganizationDashboardInput,
  db: PrismaClient = prisma,
): Promise<GetOrganizationDashboardResult> {
  try {
    if (input.skipMembershipCheck !== true) {
      const membership = await db.organizationMember.findUnique({
        select: { organizationId: true },
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });

      if (membership === null) {
        return {
          success: false,
          error: {
            type: "NOT_MEMBER",
            message: "組織のメンバーではありません",
          },
        };
      }
    }

    const aggregation = await db.$transaction(async (tx) => {
      const [statusCounts, priorityCounts, assignedUndone, recentActivity] =
        await Promise.all([
          countTicketsByStatus(input, tx),
          countTicketsByPriority(input, tx),
          countAssignedUndoneTickets(input, tx),
          findRecentDashboardActivity(input, tx),
        ]);

      return {
        statusCounts,
        priorityCounts,
        assignedUndone,
        recentActivity,
      };
    });

    return {
      success: true,
      data: buildDashboard(aggregation),
    };
  } catch (error) {
    console.error("Failed to get organization dashboard:", error);
    return {
      success: false,
      error: {
        type: "INTERNAL",
        message: "ダッシュボードの取得に失敗しました",
      },
    };
  }
}

function buildDashboard(
  aggregation: DashboardAggregationResult,
): OrganizationDashboard {
  const statusCounts = new Map(
    aggregation.statusCounts.map((row) => [row.status, row._count._all]),
  );
  const priorityCounts = new Map(
    aggregation.priorityCounts.map((row) => [row.priority, row._count._all]),
  );

  let total = 0;
  for (const count of statusCounts.values()) {
    total += count;
  }

  const open = statusCounts.get(TicketStatus.Open) ?? 0;
  const inProgress = statusCounts.get(TicketStatus.InProgress) ?? 0;
  const closed = statusCounts.get(TicketStatus.Closed) ?? 0;

  return {
    ticketSummary: {
      total,
      open,
      inProgress,
      closed,
      undone: open + inProgress,
    },
    prioritySummary: {
      low: priorityCounts.get(TicketPriority.Low) ?? 0,
      medium: priorityCounts.get(TicketPriority.Medium) ?? 0,
      high: priorityCounts.get(TicketPriority.High) ?? 0,
      urgent: priorityCounts.get(TicketPriority.Urgent) ?? 0,
    },
    mySummary: {
      assignedUndone: aggregation.assignedUndone,
    },
    recentActivity: aggregation.recentActivity,
  };
}
