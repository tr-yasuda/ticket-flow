import { Prisma, PrismaClient } from "@prisma/client";

import {
  type Ticket,
  type TicketListItem,
  type TicketPriority,
  type TicketStatus,
  rehydrateTicket,
} from "../../domain/ticket.js";
import { prisma } from "../../lib/prisma.js";
import { resolveSkip, resolveTake, type Pagination } from "./pagination.js";

function toTicket(row: Prisma.TicketGetPayload<Record<string, never>>): Ticket {
  return rehydrateTicket({
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assigneeId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  });
}

export async function saveTicket(
  ticket: Ticket,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket> {
  const row = await db.ticket.create({
    data: {
      id: ticket.id,
      organizationId: ticket.organizationId,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      assigneeId: ticket.assigneeId,
      createdBy: ticket.createdBy,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    },
  });

  return toTicket(row);
}

export type FindTicketsInput = Readonly<{
  organizationId: string;
  search?: string;
  status?: TicketStatus[];
  priority?: TicketPriority[];
  assigneeId?: string | null;
}> &
  Pagination;

function normalizeSearch(search: string | undefined): string | undefined {
  const trimmed = search?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

function normalizeAssigneeId(
  assigneeId: string | null | undefined,
): string | null | undefined {
  if (assigneeId === undefined || assigneeId === null) {
    return assigneeId;
  }

  return assigneeId.toLowerCase();
}

export function escapeLikePattern(value: string): string {
  return value.replace(/!/g, "!!").replace(/%/g, "!%").replace(/_/g, "!_");
}

function buildSearchPattern(search: string): string {
  return `%${escapeLikePattern(search)}%`;
}

function hasEnumFilter<T>(values: T[] | undefined): values is T[] {
  return values !== undefined && values.length > 0;
}

type FilterableTicketColumn = "status" | "priority";

function buildEnumInFilter<T extends string>(
  column: FilterableTicketColumn,
  values: T[] | undefined,
): Prisma.Sql {
  if (!hasEnumFilter(values)) {
    return Prisma.empty;
  }

  return Prisma.sql`AND ${Prisma.raw(column)} IN (${Prisma.join(values)})`;
}

function buildAssigneeFilter(
  assigneeId: string | null | undefined,
): Prisma.Sql {
  if (assigneeId === undefined) {
    return Prisma.empty;
  }

  if (assigneeId === null) {
    return Prisma.sql`AND assignee_id IS NULL`;
  }

  return Prisma.sql`AND assignee_id = ${assigneeId}`;
}

function toTicketListItem(
  row: {
    id: string;
    organizationId: string;
    title: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  },
  commentCount: number,
): TicketListItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    status: row.status as TicketStatus,
    priority: row.priority as TicketPriority,
    assignee:
      row.assigneeId !== null ? { id: row.assigneeId, name: null } : null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    commentCount,
  };
}

export async function countTicketsByOrganizationId(
  input: FindTicketsInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<number> {
  const search = normalizeSearch(input.search);
  const assigneeId = normalizeAssigneeId(input.assigneeId);

  if (search === undefined) {
    return db.ticket.count({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        ...(hasEnumFilter(input.status) && { status: { in: input.status } }),
        ...(hasEnumFilter(input.priority) && {
          priority: { in: input.priority },
        }),
        ...(assigneeId !== undefined && { assigneeId }),
      },
    });
  }

  const pattern = buildSearchPattern(search);
  const statusFilter = buildEnumInFilter("status", input.status);
  const priorityFilter = buildEnumInFilter("priority", input.priority);
  const assigneeFilter = buildAssigneeFilter(assigneeId);
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) AS count
    FROM tickets
    WHERE organization_id = ${input.organizationId}
      AND deleted_at IS NULL
      ${statusFilter}
      ${priorityFilter}
      ${assigneeFilter}
      AND (
        LOWER(title) LIKE LOWER(${pattern}) ESCAPE '!'
        OR LOWER(description) LIKE LOWER(${pattern}) ESCAPE '!'
      )
  `;

  const row = rows[0];
  if (row === undefined) {
    return 0;
  }

  return Number(row.count);
}

export async function findTicketsByOrganizationId(
  input: FindTicketsInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<TicketListItem[]> {
  const search = normalizeSearch(input.search);
  const assigneeId = normalizeAssigneeId(input.assigneeId);
  const take = resolveTake(input.take);
  const skip = resolveSkip(input.skip);

  if (search === undefined) {
    const rows = await db.ticket.findMany({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        ...(hasEnumFilter(input.status) && { status: { in: input.status } }),
        ...(hasEnumFilter(input.priority) && {
          priority: { in: input.priority },
        }),
        ...(assigneeId !== undefined && { assigneeId }),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take,
      skip,
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
        priority: true,
        assigneeId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    return rows.map((row) => toTicketListItem(row, row._count.comments));
  }

  const pattern = buildSearchPattern(search);
  const statusFilter = buildEnumInFilter("status", input.status);
  const priorityFilter = buildEnumInFilter("priority", input.priority);
  const assigneeFilter = buildAssigneeFilter(assigneeId);

  // NOTE: title/description の部分一致検索は SQLite の LIKE を使用します。
  // LOWER() で大文字小文字を区別せず、PRAGMA 等の設定差分に依存しません。
  // 先頭ワイルドカードのためテーブルスキャンになり、チケット数が増えると
  // 応答が劣化します。スケール時は SQLite FTS 等の全文検索インデックス導入を
  // 検討してください。
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      title: string;
      status: string;
      priority: string;
      assigneeId: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      commentCount: number;
    }>
  >`
    SELECT
      id,
      organization_id AS organizationId,
      title,
      status,
      priority,
      assignee_id AS assigneeId,
      created_by AS createdBy,
      created_at AS createdAt,
      updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM comments c
        WHERE c.ticket_id = tickets.id
      ) AS commentCount
    FROM tickets
    WHERE organization_id = ${input.organizationId}
      AND deleted_at IS NULL
      ${statusFilter}
      ${priorityFilter}
      ${assigneeFilter}
      AND (
        LOWER(title) LIKE LOWER(${pattern}) ESCAPE '!'
        OR LOWER(description) LIKE LOWER(${pattern}) ESCAPE '!'
      )
    ORDER BY updated_at DESC, id DESC
    LIMIT ${take} OFFSET ${skip}
  `;

  return rows.map((row) => toTicketListItem(row, Number(row.commentCount)));
}

export type FindTicketByIdInput = Readonly<{
  organizationId: string;
  ticketId: string;
}>;

export async function findTicketById(
  input: FindTicketByIdInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket | null> {
  const row = await db.ticket.findUnique({
    where: {
      id: input.ticketId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
  });

  if (row === null) {
    return null;
  }

  return toTicket(row);
}

export type UpdateTicketRepositoryInput = Readonly<{
  organizationId: string;
  ticketId: string;
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
}>;

export async function updateTicket(
  input: UpdateTicketRepositoryInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket | null> {
  const rows = await db.ticket.updateMany({
    where: {
      id: input.ticketId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.priority !== undefined && { priority: input.priority }),
    },
  });

  if (rows.count === 0) {
    return null;
  }

  const row = await db.ticket.findUnique({
    where: {
      id: input.ticketId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
  });

  return row === null ? null : toTicket(row);
}

export type UpdateTicketStatusRepositoryInput = Readonly<{
  organizationId: string;
  ticketId: string;
  status: TicketStatus;
  currentStatus: TicketStatus;
}>;

export async function updateTicketStatus(
  input: UpdateTicketStatusRepositoryInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket | null> {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      assigneeId: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    }>
  >`
    UPDATE tickets
    SET status = ${input.status},
        updated_at = ${new Date()}
    WHERE id = ${input.ticketId}
      AND organization_id = ${input.organizationId}
      AND deleted_at IS NULL
      AND status = ${input.currentStatus}
    RETURNING
      id,
      organization_id AS organizationId,
      title,
      description,
      status,
      priority,
      assignee_id AS assigneeId,
      created_by AS createdBy,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt
  `;

  if (rows.length === 0) {
    return null;
  }

  return toTicket(rows[0]);
}

export type UpdateTicketPriorityRepositoryInput = Readonly<{
  organizationId: string;
  ticketId: string;
  priority: TicketPriority;
  currentPriority: TicketPriority;
}>;

export async function updateTicketPriority(
  input: UpdateTicketPriorityRepositoryInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket | null> {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      assigneeId: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    }>
  >`
    UPDATE tickets
    SET priority = ${input.priority},
        updated_at = ${new Date()}
    WHERE id = ${input.ticketId}
      AND organization_id = ${input.organizationId}
      AND deleted_at IS NULL
      AND priority = ${input.currentPriority}
    RETURNING
      id,
      organization_id AS organizationId,
      title,
      description,
      status,
      priority,
      assignee_id AS assigneeId,
      created_by AS createdBy,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt
  `;

  if (rows.length === 0) {
    return null;
  }

  return toTicket(rows[0]);
}

export type UpdateTicketAssigneeRepositoryInput = Readonly<{
  organizationId: string;
  ticketId: string;
  assigneeId: string | null;
  currentAssigneeId: string | null;
}>;

export async function updateTicketAssignee(
  input: UpdateTicketAssigneeRepositoryInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket | null> {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      assigneeId: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    }>
  >`
    UPDATE tickets
    SET assignee_id = ${input.assigneeId},
        updated_at = ${new Date()}
    WHERE id = ${input.ticketId}
      AND organization_id = ${input.organizationId}
      AND deleted_at IS NULL
      AND (
        (${input.currentAssigneeId} IS NULL AND assignee_id IS NULL)
        OR assignee_id = ${input.currentAssigneeId}
      )
    RETURNING
      id,
      organization_id AS organizationId,
      title,
      description,
      status,
      priority,
      assignee_id AS assigneeId,
      created_by AS createdBy,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt
  `;

  if (rows.length === 0) {
    return null;
  }

  return toTicket(rows[0]);
}

export type SoftDeleteTicketInput = Readonly<{
  organizationId: string;
  ticketId: string;
}>;

/**
 * チケットを論理削除する。
 *
 * Prisma の単一 `update` では `deleted_at IS NULL` 条件付きの RETURNING が
 * 表現できないため、`$queryRaw` を使用して 1 クエリで完了させる。
 */
export async function softDeleteTicket(
  input: SoftDeleteTicketInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket | null> {
  const now = new Date();
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      assigneeId: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date;
    }>
  >`
    UPDATE tickets
    SET deleted_at = ${now},
        updated_at = ${now}
    WHERE id = ${input.ticketId}
      AND organization_id = ${input.organizationId}
      AND deleted_at IS NULL
    RETURNING
      id,
      organization_id AS organizationId,
      title,
      description,
      status,
      priority,
      assignee_id AS assigneeId,
      created_by AS createdBy,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt
  `;

  if (rows.length === 0) {
    return null;
  }

  return toTicket(rows[0]);
}
