import { Prisma, type PrismaClient } from "@prisma/client";

import {
  createTicket as createTicketEntity,
  type CreateTicketInput as DomainCreateTicketInput,
  type Ticket,
  TicketNotFoundError,
  TicketPriority,
  TicketStatus,
  TicketValidationError,
  type UpdateTicketPatch,
  updateTicket as updateTicketEntity,
  updateTicketStatus as updateTicketStatusEntity,
  UserNotOrganizationMemberError,
} from "../domain/ticket.js";
import {
  findTicketById,
  findTicketsByOrganizationId,
  saveTicket,
  updateTicket as updateTicketRepository,
  updateTicketStatus as updateTicketStatusRepository,
  type FindTicketsInput,
} from "../infrastructure/database/ticket-repository.js";
import { prisma } from "../lib/prisma.js";

async function runInTransaction<T>(
  db: PrismaClient | Prisma.TransactionClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (
    "$transaction" in db &&
    typeof (db as PrismaClient).$transaction === "function"
  ) {
    return (db as PrismaClient).$transaction(fn);
  }

  return fn(db as Prisma.TransactionClient);
}

export type TicketServiceError = Readonly<
  | { type: "ticket-not-found"; message: string }
  | { type: "user-not-organization-member"; message: string }
  | { type: "validation-error"; message: string }
  | { type: "unknown-error"; message: string }
>;

export type CreateTicketServiceInput = Readonly<{
  organizationId: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string | null;
  createdBy: string;
  /**
   * 作成者の組織メンバーシップチェックをスキップする。
   * 呼び出し元で既にメンバーシップを確認している場合（例: organizationScopeMiddleware 経由）に true を指定する。
   * assigneeId の組織メンバーシップチェックは常に実行される。
   */
  skipCreatorMembershipCheck?: boolean;
}>;

export type CreateTicketResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function createTicket(
  input: CreateTicketServiceInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<CreateTicketResult> {
  try {
    const domainInput: DomainCreateTicketInput = {
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      createdBy: input.createdBy,
    };

    const ticket = createTicketEntity(domainInput);

    const saved = await runInTransaction(db, async (tx) => {
      await Promise.all([
        input.skipCreatorMembershipCheck === true
          ? Promise.resolve()
          : assertUserIsOrganizationMember(
              tx,
              ticket.organizationId,
              ticket.createdBy,
            ),
        ticket.assigneeId !== null
          ? assertUserIsOrganizationMember(
              tx,
              ticket.organizationId,
              ticket.assigneeId,
            )
          : Promise.resolve(),
      ]);

      return saveTicket(ticket, tx);
    });

    return { success: true, data: { ticket: saved } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type ListTicketsResult =
  | { success: true; data: { tickets: readonly Ticket[]; total: number } }
  | { success: false; error: TicketServiceError };

export async function listTickets(
  input: FindTicketsInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ListTicketsResult> {
  try {
    const [tickets, total] = await Promise.all([
      findTicketsByOrganizationId(input, db),
      db.ticket.count({ where: { organizationId: input.organizationId } }),
    ]);

    return { success: true, data: { tickets, total } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type GetTicketInput = Readonly<{
  organizationId: string;
  ticketId: string;
}>;

export type GetTicketResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function getTicket(
  input: GetTicketInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<GetTicketResult> {
  try {
    const ticket = await findTicketById(input, db);
    if (ticket === null) {
      return {
        success: false,
        error: {
          type: "ticket-not-found",
          message: "チケットが見つかりません",
        },
      };
    }

    return { success: true, data: { ticket } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type UpdateTicketInput = Readonly<{
  organizationId: string;
  ticketId: string;
  title?: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string | null;
}>;

export type UpdateTicketResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function updateTicket(
  input: UpdateTicketInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<UpdateTicketResult> {
  try {
    const updatedTicket = await runInTransaction(db, async (tx) => {
      const existing = await findTicketById(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (existing === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      const patch: UpdateTicketPatch = {
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeId: input.assigneeId,
      };
      const updated = updateTicketEntity(existing, patch);

      if (
        updated.assigneeId !== null &&
        updated.assigneeId !== existing.assigneeId
      ) {
        await assertUserIsOrganizationMember(
          tx,
          input.organizationId,
          updated.assigneeId,
        );
      }

      const saved = await updateTicketRepository(
        {
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          title: updated.title,
          description: updated.description,
          priority: updated.priority,
          assigneeId: updated.assigneeId,
        },
        tx,
      );

      if (saved === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      return saved;
    });

    return { success: true, data: { ticket: updatedTicket } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type UpdateTicketStatusInput = Readonly<{
  organizationId: string;
  ticketId: string;
  status: TicketStatus;
}>;

export type UpdateTicketStatusResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function updateTicketStatus(
  input: UpdateTicketStatusInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<UpdateTicketStatusResult> {
  try {
    const updatedTicket = await runInTransaction(db, async (tx) => {
      const existing = await findTicketById(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (existing === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      const updated = updateTicketStatusEntity(existing, input.status);

      const saved = await updateTicketStatusRepository(
        {
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          status: updated.status,
        },
        tx,
      );

      if (saved === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      return saved;
    });

    return { success: true, data: { ticket: updatedTicket } };
  } catch (error) {
    return mapServiceError(error);
  }
}

async function assertUserIsOrganizationMember(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });

  if (membership === null) {
    throw new UserNotOrganizationMemberError(
      `ユーザー ${userId} は組織 ${organizationId} のメンバーではありません`,
    );
  }
}

function mapServiceError(error: unknown): {
  success: false;
  error: TicketServiceError;
} {
  if (error instanceof TicketNotFoundError) {
    return {
      success: false,
      error: { type: "ticket-not-found", message: error.message },
    };
  }

  if (error instanceof UserNotOrganizationMemberError) {
    return {
      success: false,
      error: { type: "user-not-organization-member", message: error.message },
    };
  }

  if (error instanceof TicketValidationError) {
    return {
      success: false,
      error: { type: "validation-error", message: error.message },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("Prisma error:", error);
    return {
      success: false,
      error: {
        type: "unknown-error",
        message: "データベースエラーが発生しました",
      },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: { type: "unknown-error", message: error.message },
    };
  }

  return {
    success: false,
    error: { type: "unknown-error", message: "不明なエラーが発生しました" },
  };
}
