import { Prisma, PrismaClient } from "@prisma/client";

import { type Ticket, rehydrateTicket } from "../../domain/ticket.js";
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
}> &
  Pagination;

export async function findTicketsByOrganizationId(
  input: FindTicketsInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Ticket[]> {
  const rows = await db.ticket.findMany({
    where: { organizationId: input.organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: resolveTake(input.take),
    skip: resolveSkip(input.skip),
  });

  return rows.map(toTicket);
}
