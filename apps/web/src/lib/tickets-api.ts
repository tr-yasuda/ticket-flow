import {
  ticketPrioritySchema,
  ticketStatusSchema,
  type TicketPriority,
  type TicketStatus,
} from "@ticket-flow/shared";

import { apiClient } from "./api-client";
import { extractData, isRecord } from "./api-response";

export type Ticket = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateTicketInput = Readonly<{
  title: string;
  description?: string | null;
  priority?: TicketPriority;
  assigneeId?: string | null;
}>;

function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === "string" &&
    ticketStatusSchema.options.includes(value as TicketStatus)
  );
}

function isTicketPriority(value: unknown): value is TicketPriority {
  return (
    typeof value === "string" &&
    ticketPrioritySchema.options.includes(value as TicketPriority)
  );
}

function isTicket(value: unknown): value is Ticket {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.title === "string" &&
    (value.description === null || typeof value.description === "string") &&
    isTicketStatus(value.status) &&
    isTicketPriority(value.priority) &&
    (value.assigneeId === null || typeof value.assigneeId === "string") &&
    typeof value.createdBy === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export async function createTicket(
  organizationId: string,
  input: CreateTicketInput,
): Promise<Ticket> {
  const body = await apiClient
    .post(`organizations/${encodeURIComponent(organizationId)}/tickets`, {
      json: input,
    })
    .json<unknown>();
  return extractData(body, isTicket);
}
