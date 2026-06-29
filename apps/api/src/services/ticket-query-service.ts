import { type Prisma, type PrismaClient } from "@prisma/client";

import {
  AUDIT_LOG_ENTITY_TYPE_TICKET,
  type AuditLogWithActor,
} from "../domain/audit-log.js";
import { type Ticket, type TicketListItem } from "../domain/ticket.js";
import { findAuditLogsByEntityWithActor } from "../infrastructure/database/audit-log-repository.js";
import {
  countTicketsByOrganizationId,
  findTicketById,
  findTicketsByOrganizationId,
  type FindTicketsInput,
} from "../infrastructure/database/ticket-repository.js";
import { isUserOrganizationMember } from "../lib/membership-assertions.js";
import { prisma } from "../lib/prisma.js";
import {
  mapServiceError,
  runInTransaction,
  type TicketServiceError,
} from "./ticket-service-base.js";

export type { TicketServiceError } from "./ticket-service-base.js";

export type ListTicketsResult =
  | {
      success: true;
      data: { tickets: readonly TicketListItem[]; total: number };
    }
  | { success: false; error: TicketServiceError };

export async function listTickets(
  input: FindTicketsInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ListTicketsResult> {
  try {
    const normalizedInput: FindTicketsInput = {
      ...input,
      assigneeId:
        input.assigneeId === undefined || input.assigneeId === null
          ? input.assigneeId
          : input.assigneeId.toLowerCase(),
    };

    const result = await runInTransaction(db, async (tx) => {
      if (
        normalizedInput.assigneeId !== undefined &&
        normalizedInput.assigneeId !== null
      ) {
        const isMember = await isUserOrganizationMember(
          tx,
          normalizedInput.organizationId,
          normalizedInput.assigneeId,
        );
        if (!isMember) {
          return { tickets: [], total: 0 };
        }
      }

      const [tickets, total] = await Promise.all([
        findTicketsByOrganizationId(normalizedInput, tx),
        countTicketsByOrganizationId(normalizedInput, tx),
      ]);

      return { tickets, total };
    });

    return { success: true, data: result };
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

export type GetTicketHistoryInput = Readonly<{
  organizationId: string;
  ticketId: string;
  take?: number;
  skip?: number;
}>;

export type GetTicketHistoryResult =
  | { success: true; data: { history: readonly AuditLogWithActor[] } }
  | { success: false; error: TicketServiceError };

export async function getTicketHistory(
  input: GetTicketHistoryInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<GetTicketHistoryResult> {
  try {
    const ticket = await findTicketById(
      { organizationId: input.organizationId, ticketId: input.ticketId },
      db,
    );
    if (ticket === null) {
      return {
        success: false,
        error: {
          type: "ticket-not-found",
          message: "チケットが見つかりません",
        },
      };
    }

    const history = await findAuditLogsByEntityWithActor(
      {
        organizationId: input.organizationId,
        entityType: AUDIT_LOG_ENTITY_TYPE_TICKET,
        entityId: ticket.id,
        take: input.take,
        skip: input.skip,
      },
      db,
    );

    return { success: true, data: { history } };
  } catch (error) {
    return mapServiceError(error);
  }
}
