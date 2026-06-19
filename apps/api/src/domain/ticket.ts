import { randomUUID } from "node:crypto";

import {
  createTicketInputSchema,
  ticketAssigneeIdSchema,
  ticketCreatedBySchema,
  ticketDescriptionSchema,
  ticketOrganizationIdSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTitleSchema,
  updateTicketInputSchema,
} from "@ticket-flow/shared";
import { z } from "zod";

export type TicketId = string;

export const TicketStatus = {
  Open: "open",
  InProgress: "in-progress",
  Closed: "closed",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Urgent: "urgent",
} as const;
export type TicketPriority =
  (typeof TicketPriority)[keyof typeof TicketPriority];

export type Ticket = Readonly<{
  id: TicketId;
  organizationId: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketValidationError";
  }
}

export class TicketNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketNotFoundError";
  }
}

export class UserNotOrganizationMemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserNotOrganizationMemberError";
  }
}

const ticketSchema = z.object({
  id: z
    .string({ message: "チケットIDは必須です" })
    .min(1, "チケットIDは必須です"),
  organizationId: ticketOrganizationIdSchema,
  title: ticketTitleSchema,
  description: ticketDescriptionSchema.transform((value) => value ?? null),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  assigneeId: ticketAssigneeIdSchema.transform((value) => value ?? null),
  createdBy: ticketCreatedBySchema,
  createdAt: z.date({ message: "作成日時は必須です" }),
  updatedAt: z.date({ message: "更新日時は必須です" }),
});

function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      throw new TicketValidationError(
        firstIssue?.message ?? "入力内容を確認してください",
      );
    }
    throw error;
  }
}

export type CreateTicketInput = Readonly<{
  organizationId: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string | null;
  createdBy: string;
}>;

export function createTicket(input: CreateTicketInput): Ticket {
  const parsed = parseWith(createTicketInputSchema, input);
  const now = new Date();

  return parseWith(ticketSchema, {
    id: randomUUID(),
    organizationId: parsed.organizationId,
    title: parsed.title,
    description: parsed.description ?? null,
    status: TicketStatus.Open,
    priority: parsed.priority ?? TicketPriority.Medium,
    assigneeId: parsed.assigneeId ?? null,
    createdBy: parsed.createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

export type RehydrateTicketInput = Readonly<{
  id: TicketId;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export function rehydrateTicket(input: RehydrateTicketInput): Ticket {
  return parseWith(ticketSchema, input);
}

export type UpdateTicketPatch = Readonly<{
  title?: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string | null;
}>;

export function updateTicket(ticket: Ticket, patch: UpdateTicketPatch): Ticket {
  const parsed = parseWith(updateTicketInputSchema, patch);

  return parseWith(ticketSchema, {
    ...ticket,
    title: parsed.title ?? ticket.title,
    description:
      parsed.description !== undefined
        ? parsed.description
        : ticket.description,
    priority: parsed.priority ?? ticket.priority,
    assigneeId:
      parsed.assigneeId !== undefined ? parsed.assigneeId : ticket.assigneeId,
    updatedAt: new Date(),
  });
}

export function updateTicketStatus(
  ticket: Ticket,
  status: TicketStatus,
): Ticket {
  const parsed = parseWith(ticketStatusSchema, status);

  return parseWith(ticketSchema, {
    ...ticket,
    status: parsed,
    updatedAt: new Date(),
  });
}
