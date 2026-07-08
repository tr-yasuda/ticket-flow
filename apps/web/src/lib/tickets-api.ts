import {
  ticketPrioritySchema,
  ticketStatusSchema,
  type TicketPriority,
  type TicketStatus,
} from "@ticket-flow/shared";

import { type TicketAssignee, type TicketListItem } from "@/types/ticket";

import { apiClient } from "./api-client";
import {
  ApiResponseValidationError,
  extractData,
  isApiPaginatedEnvelope,
  isRecord,
} from "./api-response";

export type { TicketAssignee, TicketListItem } from "@/types/ticket";

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

export type TicketDetail = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  commentCount: number;
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

type TicketDetailResponse = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId?: string | null;
  assignee?: { id: string } | null;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  commentCount: number;
}>;

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

/**
 * API レスポンスとして受け取る直後のチケット一覧アイテム。
 * `createdAt` / `updatedAt` は JSON 経由では string、MSW 等では Date の可能性がある。
 */
type RawTicketListItem = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: TicketAssignee | null;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  commentCount: number;
}>;

function isTicketListItem(value: unknown): value is RawTicketListItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.title === "string" &&
    isTicketStatus(value.status) &&
    isTicketPriority(value.priority) &&
    (value.assignee === null || isTicketAssignee(value.assignee)) &&
    typeof value.createdBy === "string" &&
    isValidDate(value.createdAt) &&
    isValidDate(value.updatedAt) &&
    isNonNegativeInteger(value.commentCount)
  );
}

function isTicketsData(value: unknown): value is { tickets: unknown[] } {
  return isRecord(value) && Array.isArray(value.tickets);
}

function extractTicketsData(body: unknown): { tickets: TicketListItem[] } {
  const data = extractData(body, isTicketsData, "Invalid tickets response");
  if (!data.tickets.every(isTicketListItem)) {
    throw new ApiResponseValidationError("Invalid tickets response");
  }

  return {
    tickets: data.tickets.map((ticket) => ({
      ...ticket,
      createdAt: toDate(
        ticket.createdAt,
        "Invalid tickets response: invalid date",
      ),
      updatedAt: toDate(
        ticket.updatedAt,
        "Invalid tickets response: invalid date",
      ),
    })),
  };
}

function extractPaginationMeta(body: unknown): {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
} {
  if (
    isApiPaginatedEnvelope(body) &&
    isPositiveInteger(body.meta.page) &&
    isPositiveInteger(body.meta.perPage) &&
    body.meta.perPage <= MAX_PER_PAGE &&
    isNonNegativeInteger(body.meta.total) &&
    isNonNegativeInteger(body.meta.totalPages)
  ) {
    return {
      page: body.meta.page,
      perPage: body.meta.perPage,
      total: body.meta.total,
      totalPages: body.meta.totalPages,
    };
  }

  throw new ApiResponseValidationError("Invalid pagination meta");
}

function isValidDateString(value: unknown): value is string {
  const isoUtcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  return (
    typeof value === "string" &&
    isoUtcPattern.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isValidDate(value: unknown): boolean {
  return (
    (value instanceof Date && !Number.isNaN(value.getTime())) ||
    isValidDateString(value)
  );
}

function isValidAssigneeId(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (typeof value === "string") {
    return true;
  }
  return isRecord(value) && typeof value.id === "string";
}

function responseHasAssigneeField(value: Record<string, unknown>): boolean {
  return "assigneeId" in value || "assignee" in value;
}

function extractAssigneeId(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value.length > 0 ? value : null;
  }
  if (isRecord(value) && typeof value.id === "string") {
    return value.id.length > 0 ? value.id : null;
  }
  throw new ApiResponseValidationError(
    "Invalid ticket detail response: invalid assignee",
  );
}

function toDate(value: unknown, message = "Invalid date"): Date {
  if (value instanceof Date) {
    return value;
  }
  if (isValidDateString(value)) {
    return new Date(value);
  }
  throw new ApiResponseValidationError(message);
}

function isTicketDetailResponse(value: unknown): value is TicketDetailResponse {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.title === "string" &&
    (value.description === null || typeof value.description === "string") &&
    isTicketStatus(value.status) &&
    isTicketPriority(value.priority) &&
    typeof value.createdBy === "string" &&
    isNonNegativeInteger(value.commentCount) &&
    isValidDate(value.createdAt) &&
    isValidDate(value.updatedAt) &&
    responseHasAssigneeField(value) &&
    isValidAssigneeId(
      value.assigneeId !== undefined ? value.assigneeId : value.assignee,
    )
  );
}

function extractTicketDetail(body: unknown): TicketDetail {
  const data = extractData(
    body,
    isTicketDetailResponse,
    "Invalid ticket detail response",
  );

  return {
    id: data.id,
    organizationId: data.organizationId,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    assigneeId: extractAssigneeId(
      data.assigneeId !== undefined ? data.assigneeId : data.assignee,
    ),
    createdBy: data.createdBy,
    createdAt: toDate(
      data.createdAt,
      "Invalid ticket detail response: invalid date",
    ),
    updatedAt: toDate(
      data.updatedAt,
      "Invalid ticket detail response: invalid date",
    ),
    commentCount: data.commentCount,
  };
}

function assertNonEmptyString(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty`);
  }
}

function buildTicketsPath(organizationId: string): string {
  assertNonEmptyString(organizationId, "organizationId");
  return `organizations/${encodeURIComponent(organizationId)}/tickets`;
}

function buildTicketPath(organizationId: string, ticketId: string): string {
  assertNonEmptyString(organizationId, "organizationId");
  assertNonEmptyString(ticketId, "ticketId");
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

export const getTickets = listTickets;

export async function getTicket(input: GetTicketInput): Promise<TicketDetail> {
  const { organizationId, ticketId, signal } = input;

  const body = await apiClient
    .get(buildTicketPath(organizationId, ticketId), { signal })
    .json<unknown>();

  return extractTicketDetail(body);
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

  return extractTicketDetail(body);
}
