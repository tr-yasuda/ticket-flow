import {
  ApiErrorCode,
  type ApiValidationErrorDetail,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
  createTicketInputSchema,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { demoOrganization } from "@/mocks/data/organizations";
import {
  demoTickets,
  type MockTicket,
  type MockTicketAssignee,
  type MockTicketListItem,
} from "@/mocks/data/tickets";

import { normalizePathParam } from "./utils.js";

function mapZodIssuesToDetails(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): ApiValidationErrorDetail[] {
  const details: ApiValidationErrorDetail[] = [];
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string") {
      continue;
    }
    details.push({ field, message: issue.message });
  }
  return details;
}

function findDemoAssignee(assigneeId: string) {
  return (
    demoTickets
      .map((ticket) => ticket.assignee)
      .find((assignee) => assignee !== null && assignee.id === assigneeId) ??
    null
  );
}

function toTicketListAssignee(
  assignee: MockTicket["assignee"],
): MockTicketAssignee | null {
  if (assignee === null) {
    return null;
  }
  // 実 API と同様に User に name カラムがないため、一覧では常に null を返す
  return { id: assignee.id, name: null };
}

function toTicketListItem(ticket: MockTicket): MockTicketListItem {
  return {
    id: ticket.id,
    organizationId: ticket.organizationId,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    assignee: toTicketListAssignee(ticket.assignee),
    createdBy: ticket.createdBy,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

const demoTicketListItems = demoTickets.map(toTicketListItem);

const MIN_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const MAX_SKIP = 10000;

type PaginationParseResult =
  | { ok: true; page: number; perPage: number }
  | { ok: false; details: ApiValidationErrorDetail[] };

function parseIntQueryParam(
  value: string | null,
  options: Readonly<{ defaultValue: number; min: number; max: number }>,
): { ok: true; value: number } | { ok: false } {
  if (value === null) {
    return { ok: true, value: options.defaultValue };
  }

  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < options.min ||
    parsed > options.max
  ) {
    return { ok: false };
  }

  return { ok: true, value: parsed };
}

function parsePaginationQuery(url: URL): PaginationParseResult {
  const pageParam = url.searchParams.get("page");
  const perPageParam = url.searchParams.get("perPage");

  const pageResult = parseIntQueryParam(pageParam, {
    defaultValue: MIN_PAGE,
    min: MIN_PAGE,
    max: 10000,
  });
  const perPageResult = parseIntQueryParam(perPageParam, {
    defaultValue: DEFAULT_PER_PAGE,
    min: MIN_PAGE,
    max: MAX_PER_PAGE,
  });

  const details: ApiValidationErrorDetail[] = [];
  if (!pageResult.ok) {
    details.push({
      field: "page",
      message: "ページ番号は1以上の整数を指定してください",
    });
  }
  if (!perPageResult.ok) {
    details.push({
      field: "perPage",
      message: "1ページあたり件数は1以上100以下の整数を指定してください",
    });
  }
  if (!pageResult.ok || !perPageResult.ok) {
    return { ok: false, details };
  }

  const page = pageResult.value;
  const perPage = perPageResult.value;
  if ((page - 1) * perPage > MAX_SKIP) {
    details.push({
      field: "page",
      message: "ページ範囲が大きすぎます",
    });
    return { ok: false, details };
  }

  return { ok: true, page, perPage };
}

export const ticketHandlers = [
  http.get("/api/organizations/:id/tickets", ({ request, params }) => {
    const id = normalizePathParam(params.id);
    const url = new URL(request.url);
    const parsed = parsePaginationQuery(url);
    if (!parsed.ok) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "入力内容を確認してください",
          parsed.details,
        ),
        { status: 400 },
      );
    }

    const { page, perPage } = parsed;

    if (id !== demoOrganization.id) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_FORBIDDEN,
          "この組織にアクセスする権限がありません",
        ),
        { status: 403 },
      );
    }

    const total = demoTicketListItems.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const start = (page - 1) * perPage;
    const tickets = demoTicketListItems.slice(start, start + perPage);

    return HttpResponse.json(
      createApiPaginatedSuccessResponse(
        { tickets },
        {
          page,
          perPage,
          total,
          totalPages,
        },
      ),
      { status: 200 },
    );
  }),

  http.get("/api/organizations/:id/tickets/:ticketId", ({ params }) => {
    const id = normalizePathParam(params.id);
    const ticketId = normalizePathParam(params.ticketId);

    if (id !== demoOrganization.id) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.NOT_FOUND,
          "チケットが見つかりません",
        ),
        { status: 404 },
      );
    }

    const ticket = demoTickets.find((t) => t.id === ticketId);
    if (ticket === undefined) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.NOT_FOUND,
          "チケットが見つかりません",
        ),
        { status: 404 },
      );
    }

    return HttpResponse.json(createApiSuccessResponse(ticket), {
      status: 200,
    });
  }),

  http.post("/api/organizations/:id/tickets", async ({ request, params }) => {
    const id = normalizePathParam(params.id);
    const rawBody: unknown = await request.json();

    if (id !== demoOrganization.id) {
      return HttpResponse.json(
        createApiErrorResponse(ApiErrorCode.NOT_FOUND, "組織が見つかりません"),
        { status: 404 },
      );
    }

    if (typeof rawBody !== "object" || rawBody === null) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "入力内容を確認してください",
          [],
        ),
        { status: 400 },
      );
    }

    const parseResult = createTicketInputSchema.strict().safeParse({
      ...rawBody,
      organizationId: id,
      createdBy: "mock-user-id",
    });

    if (!parseResult.success) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "入力内容を確認してください",
          mapZodIssuesToDetails(parseResult.error.issues),
        ),
        { status: 400 },
      );
    }

    const { title, description, priority, assigneeId } = parseResult.data;
    const now = new Date().toISOString();

    return HttpResponse.json(
      createApiSuccessResponse({
        id: "mock-new-ticket-id",
        organizationId: id,
        title,
        description: description ?? null,
        status: "open",
        priority: priority ?? "medium",
        assignee: assigneeId != null ? findDemoAssignee(assigneeId) : null,
        createdBy: "mock-user-id",
        createdAt: now,
        updatedAt: now,
      }),
      { status: 201 },
    );
  }),
];
