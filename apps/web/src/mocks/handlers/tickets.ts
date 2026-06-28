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

function normalizePage(value: number): number {
  return Math.max(MIN_PAGE, Math.floor(value));
}

function normalizePerPage(value: number): number {
  return Math.min(MAX_PER_PAGE, Math.max(MIN_PAGE, Math.floor(value)));
}

function parsePaginationQuery(url: URL): {
  page: number;
  perPage: number;
} {
  const rawPage = Number(url.searchParams.get("page") ?? String(MIN_PAGE));
  const rawPerPage = Number(
    url.searchParams.get("perPage") ?? String(DEFAULT_PER_PAGE),
  );

  if (!Number.isFinite(rawPage) || !Number.isFinite(rawPerPage)) {
    return {
      page: MIN_PAGE,
      perPage: DEFAULT_PER_PAGE,
    };
  }

  return {
    page: normalizePage(rawPage),
    perPage: normalizePerPage(rawPerPage),
  };
}

export const ticketHandlers = [
  http.get("/api/organizations/:id/tickets", ({ request, params }) => {
    const id = normalizePathParam(params.id);
    const url = new URL(request.url);
    const { page, perPage } = parsePaginationQuery(url);

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
