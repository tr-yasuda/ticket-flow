import {
  ticketPrioritySchema,
  ticketStatusSchema,
  type TicketPriority,
  type TicketStatus,
} from "@ticket-flow/shared";

import { type TicketAssignee, type TicketListItem } from "@/types/ticket";

import { apiClient } from "./api-client";

export type { TicketAssignee, TicketListItem } from "@/types/ticket";

const MIN_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export type ListTicketsInput = Readonly<{
  organizationId: string;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}>;

export type ListTicketsResult = Readonly<{
  tickets: readonly TicketListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_PAGE
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

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

function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === "string" &&
    (ticketStatusSchema.options as readonly string[]).includes(value)
  );
}

function isTicketPriority(value: unknown): value is TicketPriority {
  return (
    typeof value === "string" &&
    (ticketPrioritySchema.options as readonly string[]).includes(value)
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

function isTicketsData(value: unknown): value is { tickets: unknown[] } {
  return isRecord(value) && Array.isArray(value.tickets);
}

function extractTicketsData(body: unknown): { tickets: TicketListItem[] } {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new Error("Invalid tickets response");
  }

  const data = body.data;
  if (!isTicketsData(data) || !data.tickets.every(isTicketListItem)) {
    throw new Error("Invalid tickets response");
  }

  return { tickets: data.tickets };
}

function extractPaginationMeta(body: unknown): {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
} {
  if (
    isRecord(body) &&
    body.success === true &&
    isRecord(body.meta) &&
    isPositiveInteger(body.meta.page) &&
    isPositiveInteger(body.meta.perPage) &&
    body.meta.perPage <= MAX_PER_PAGE &&
    isNonNegativeInteger(body.meta.total) &&
    isPositiveInteger(body.meta.totalPages)
  ) {
    return {
      page: body.meta.page,
      perPage: body.meta.perPage,
      total: body.meta.total,
      totalPages: body.meta.totalPages,
    };
  }

  throw new Error("Invalid pagination meta");
}

export async function listTickets(
  input: ListTicketsInput,
): Promise<ListTicketsResult> {
  const {
    organizationId,
    page = MIN_PAGE,
    perPage = DEFAULT_PER_PAGE,
    signal,
  } = input;

  const normalizedPage = normalizePage(page);
  const normalizedPerPage = normalizePerPage(perPage);

  const body = await apiClient
    .get(`organizations/${encodeURIComponent(organizationId)}/tickets`, {
      searchParams: {
        page: String(normalizedPage),
        perPage: String(normalizedPerPage),
      },
      signal,
    })
    .json<unknown>();

  const { tickets } = extractTicketsData(body);
  const meta = extractPaginationMeta(body);

  return {
    tickets,
    page: meta.page,
    perPage: meta.perPage,
    total: meta.total,
    totalPages: meta.totalPages,
  };
}
