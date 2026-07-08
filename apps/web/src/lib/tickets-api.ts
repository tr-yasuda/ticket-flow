import {
  ticketDetailSchema,
  ticketListItemResponseSchema,
  type TicketPriority,
  type TicketStatus,
} from "@ticket-flow/shared";
import { z } from "zod";

import { apiClient } from "./api-client";
import { extractData, extractPaginatedResponse } from "./api-response";

export type { TicketPriority, TicketStatus };
export type TicketListItem = z.infer<typeof ticketListItemResponseSchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

const MIN_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export type ListTicketsInput = Readonly<{
  organizationId: string;
  page?: number;
  perPage?: number;
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: string;
  signal?: AbortSignal;
}>;

export type ListTicketsResult = Readonly<{
  tickets: readonly TicketListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}>;

export type GetTicketInput = Readonly<{
  organizationId: string;
  ticketId: string;
  signal?: AbortSignal;
}>;

export type CreateTicketInput = Readonly<{
  organizationId: string;
  title: string;
  description?: string | null;
  priority?: TicketPriority;
  assigneeId?: string | null;
  signal?: AbortSignal;
}>;

const ticketsListResponseSchema = z.object({
  tickets: z.array(ticketListItemResponseSchema),
});

function normalizePage(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_PAGE;
  }
  return Math.max(MIN_PAGE, Math.floor(value));
}

function normalizePerPage(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PER_PAGE;
  }
  return Math.min(MAX_PER_PAGE, Math.max(MIN_PAGE, Math.floor(value)));
}

function buildTicketsPath(organizationId: string): string {
  if (organizationId.trim().length === 0) {
    throw new Error("organizationId must not be empty");
  }
  return `organizations/${encodeURIComponent(organizationId)}/tickets`;
}

function buildTicketPath(organizationId: string, ticketId: string): string {
  if (organizationId.trim().length === 0) {
    throw new Error("organizationId must not be empty");
  }
  if (ticketId.trim().length === 0) {
    throw new Error("ticketId must not be empty");
  }
  return `organizations/${encodeURIComponent(organizationId)}/tickets/${encodeURIComponent(ticketId)}`;
}

export async function listTickets(
  input: ListTicketsInput,
): Promise<ListTicketsResult> {
  const {
    organizationId,
    page = MIN_PAGE,
    perPage = DEFAULT_PER_PAGE,
    search,
    status,
    priority,
    assignee,
    signal,
  } = input;

  const normalizedPage = normalizePage(page);
  const normalizedPerPage = normalizePerPage(perPage);

  const searchParams: Record<string, string> = {
    page: String(normalizedPage),
    perPage: String(normalizedPerPage),
  };

  if (search !== undefined && search.trim() !== "") {
    searchParams.search = search.trim();
  }
  if (status !== undefined && status.trim() !== "") {
    searchParams.status = status.trim();
  }
  if (priority !== undefined && priority.trim() !== "") {
    searchParams.priority = priority.trim();
  }
  if (assignee !== undefined && assignee.trim() !== "") {
    searchParams.assignee = assignee.trim();
  }

  const body = await apiClient
    .get(buildTicketsPath(organizationId), {
      searchParams,
      signal,
    })
    .json<unknown>();

  const { data, meta } = extractPaginatedResponse(
    body,
    ticketsListResponseSchema,
    "Invalid tickets response",
  );

  return {
    tickets: data.tickets,
    page: meta.page,
    perPage: meta.perPage,
    total: meta.total,
    totalPages: meta.totalPages,
  };
}

export const getTickets = listTickets;

export async function getTicket(input: GetTicketInput): Promise<TicketDetail> {
  const { organizationId, ticketId, signal } = input;

  const body = await apiClient
    .get(buildTicketPath(organizationId, ticketId), { signal })
    .json<unknown>();

  return extractData(
    body,
    ticketDetailSchema,
    "Invalid ticket detail response",
  );
}

export async function createTicket(
  input: CreateTicketInput,
): Promise<TicketDetail> {
  const { organizationId, title, description, priority, assigneeId, signal } =
    input;

  const body = await apiClient
    .post(buildTicketsPath(organizationId), {
      json: {
        title,
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority }),
        ...(assigneeId !== undefined && { assigneeId }),
      },
      signal,
    })
    .json<unknown>();

  return extractData(
    body,
    ticketDetailSchema,
    "Invalid ticket detail response",
  );
}
