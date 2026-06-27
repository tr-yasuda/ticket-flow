import type { PrismaClient, Prisma } from "@prisma/client";

import { TicketStatus } from "../../domain/ticket.js";

const RECENT_ACTIVITY_LIMIT = 10;

export type GetDashboardAggregationInput = Readonly<{
  organizationId: string;
  userId: string;
}>;

/**
 * 組織内のチケットをステータス別に集計する Prisma Promise を返す。
 */
export function countTicketsByStatus(
  input: GetDashboardAggregationInput,
  db: PrismaClient | Prisma.TransactionClient,
) {
  return db.ticket.groupBy({
    by: ["status"],
    where: {
      organizationId: input.organizationId,
      deletedAt: null,
    },
    _count: { _all: true },
  });
}

/**
 * 組織内のチケットを優先度別に集計する Prisma Promise を返す。
 */
export function countTicketsByPriority(
  input: GetDashboardAggregationInput,
  db: PrismaClient | Prisma.TransactionClient,
) {
  return db.ticket.groupBy({
    by: ["priority"],
    where: {
      organizationId: input.organizationId,
      deletedAt: null,
    },
    _count: { _all: true },
  });
}

/**
 * ログインユーザーが担当している未完了チケット数を数える Prisma Promise を返す。
 */
export function countAssignedUndoneTickets(
  input: GetDashboardAggregationInput,
  db: PrismaClient | Prisma.TransactionClient,
) {
  return db.ticket.count({
    where: {
      organizationId: input.organizationId,
      deletedAt: null,
      status: { in: [TicketStatus.Open, TicketStatus.InProgress] },
      assigneeId: input.userId,
    },
  });
}

/**
 * 最近の活動を取得する Prisma Promise を返す。
 *
 * 監査ログは組織の活動履歴として返す（削除済みエンティティの活動も含む）。
 * 同じ createdAt のログがある場合、id desc で順序を決定するが、UUID v4 はランダムなため
 * 同一ミリ秒内の順序は挿入順を保証しない。
 */
export function findRecentDashboardActivity(
  input: GetDashboardAggregationInput,
  db: PrismaClient | Prisma.TransactionClient,
) {
  return db.auditLog.findMany({
    where: { organizationId: input.organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RECENT_ACTIVITY_LIMIT,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}
