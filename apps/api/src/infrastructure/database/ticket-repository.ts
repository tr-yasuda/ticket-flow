import { Prisma, PrismaClient } from "@prisma/client";

import {
  type Ticket,
  type TicketListItem,
  type TicketPriority,
  type TicketStatus,
  parseTicketPriority,
  parseTicketStatus,
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

function escapeLikePattern(value: string): string {
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
  tableAlias?: "t",
): Prisma.Sql {
  if (!hasEnumFilter(values)) {
    return Prisma.empty;
  }

  const qualifiedColumn =
    tableAlias !== undefined ? `${tableAlias}.${column}` : column;

  return Prisma.sql`AND ${Prisma.raw(qualifiedColumn)} IN (${Prisma.join(values)})`;
}

type AssigneeColumnRef = "assignee_id" | "t.assignee_id";

function buildAssigneeFilter(
  assigneeId: string | null | undefined,
  columnRef: AssigneeColumnRef,
): Prisma.Sql {
  if (assigneeId === undefined) {
    return Prisma.empty;
  }

  if (assigneeId === null) {
    return Prisma.sql`AND ${Prisma.raw(columnRef)} IS NULL`;
  }

  return Prisma.sql`AND ${Prisma.raw(columnRef)} = ${assigneeId}`;
}

function buildSearchFilter(searchPattern: string | undefined): Prisma.Sql {
  if (searchPattern === undefined) {
    return Prisma.empty;
  }

  return Prisma.sql`AND (
    LOWER(t.title) LIKE LOWER(${searchPattern}) ESCAPE '!'
    OR LOWER(t.description) LIKE LOWER(${searchPattern}) ESCAPE '!'
  )`;
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
    status: parseTicketStatus(row.status),
    priority: parseTicketPriority(row.priority),
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

  const statusFilter = buildEnumInFilter("status", input.status, "t");
  const priorityFilter = buildEnumInFilter("priority", input.priority, "t");
  const assigneeFilter = buildAssigneeFilter(assigneeId, "t.assignee_id");
  const searchPattern =
    search !== undefined ? buildSearchPattern(search) : undefined;
  const searchFilter = buildSearchFilter(searchPattern);

  const rows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) AS count
    FROM tickets t
    WHERE t.organization_id = ${input.organizationId}
      AND t.deleted_at IS NULL
      ${statusFilter}
      ${priorityFilter}
      ${assigneeFilter}
      ${searchFilter}
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

  const statusFilter = buildEnumInFilter("status", input.status, "t");
  const priorityFilter = buildEnumInFilter("priority", input.priority, "t");
  const assigneeFilter = buildAssigneeFilter(assigneeId, "t.assignee_id");
  const searchPattern =
    search !== undefined ? buildSearchPattern(search) : undefined;
  const searchFilter = buildSearchFilter(searchPattern);

  // NOTE: title/description の部分一致検索は SQLite の LIKE を使用します。
  // LOWER() で大文字小文字を区別せず、PRAGMA 等の設定差分に依存しません。
  // 先頭ワイルドカードのためテーブルスキャンになり、チケット数が増えると
  // 応答が劣化します。
  //
  // SQLite FTS5 導入も検討しましたが、Prisma Migrate によるスキーマ管理が困難です。
  // 仮想テーブルが未対応であり、かつ FTS5 は単語ベース検索のため、
  // 既存の部分一致仕様を維持できません。
  // 例: "isc" で "discount" にマッチするような単語途中の部分一致は維持できません。
  // そのため現時点では FTS5 導入を見送っています。
  // 大量データ対応が必要になった場合は、PostgreSQL 移行時の tsvector/pg_trgm、
  // または外部全文検索基盤の導入を検討してください。
  //
  // NOTE: commentCount は論理削除済みコメントも含めて集計します。
  // これは一覧 API の既存仕様であり、チケット詳細・更新系で使用される
  // countCommentsByTicketId（deleted_at IS NULL）とは異なります。
  // 両者を統一する場合は別途仕様調整が必要です。
  //
  // また、derived table 側でも organization_id で絞り込み、マルチテナント
  // スコープを厳守しつつ集計対象を縮小しています。
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
      t.id,
      t.organization_id AS organizationId,
      t.title,
      t.status,
      t.priority,
      t.assignee_id AS assigneeId,
      t.created_by AS createdBy,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt,
      COALESCE(cc.commentCount, 0) AS commentCount
    FROM tickets t
    LEFT JOIN (
      SELECT ticket_id, COUNT(*) AS commentCount
      FROM comments
      WHERE organization_id = ${input.organizationId}
      GROUP BY ticket_id
    ) cc ON cc.ticket_id = t.id
    WHERE t.organization_id = ${input.organizationId}
      AND t.deleted_at IS NULL
      ${statusFilter}
      ${priorityFilter}
      ${assigneeFilter}
      ${searchFilter}
    ORDER BY t.updated_at DESC, t.id DESC
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
