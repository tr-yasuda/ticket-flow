import type {
  ApiPaginationMeta,
  TicketPriority,
  TicketStatus,
} from "@ticket-flow/shared";

import { apiClient } from "./api-client";

export type TicketAssignee = Readonly<{
  id: string;
  name: string | null;
}>;

export type TicketListItem = Readonly<{
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: TicketAssignee | null;
}>;

export type ListTicketsInput = Readonly<{
  organizationId: string;
  page?: number;
  perPage?: number;
}>;

export type ListTicketsResult = Readonly<{
  tickets: readonly TicketListItem[];
  meta: ApiPaginationMeta;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === "string" &&
    ["open", "in-progress", "closed"].includes(value)
  );
}

function isTicketPriority(value: unknown): value is TicketPriority {
  return (
    typeof value === "string" &&
    ["low", "medium", "high", "urgent"].includes(value)
  );
}

function isTicketAssignee(value: unknown): value is TicketAssignee {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (typeof value.name === "string" || value.name === null)
  );
}

function isTicketListItem(value: unknown): value is TicketListItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isTicketStatus(value.status) &&
    isTicketPriority(value.priority) &&
    (value.assignee === null || isTicketAssignee(value.assignee))
  );
}

function isPaginationMeta(value: unknown): value is ApiPaginationMeta {
  return (
    isRecord(value) &&
    typeof value.page === "number" &&
    typeof value.perPage === "number" &&
    typeof value.total === "number" &&
    typeof value.totalPages === "number"
  );
}

export async function listTickets({
  organizationId,
  page = 1,
  perPage = 20,
}: ListTicketsInput): Promise<ListTicketsResult> {
  const body = await apiClient
    .get(`organizations/${organizationId}/tickets`, {
      searchParams: {
        page: String(page),
        perPage: String(perPage),
      },
    })
    .json<unknown>();

  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new Error("Invalid tickets response");
  }
  if (!Array.isArray(body.data.tickets)) {
    throw new Error("Invalid tickets response");
  }
  if (!body.data.tickets.every(isTicketListItem)) {
    throw new Error("Invalid tickets response");
  }
  if (!isPaginationMeta(body.meta)) {
    throw new Error("Invalid tickets response");
  }

  return {
    tickets: body.data.tickets,
    meta: body.meta,
  };
}
