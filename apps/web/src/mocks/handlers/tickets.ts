import {
  ApiErrorCode,
  type ApiValidationErrorDetail,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
  createTicketInputSchema,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { z } from "zod";

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

function toTicketListAssignee(
  assigneeId: MockTicket["assigneeId"],
): MockTicketAssignee | null {
  if (assigneeId === null) {
    return null;
  }
  // 実 API と同様に User に name カラムがないため、一覧では常に null を返す
  return { id: assigneeId, name: null };
}

function toTicketListItem(ticket: MockTicket): MockTicketListItem {
  return {
    id: ticket.id,
    organizationId: ticket.organizationId,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    assignee: toTicketListAssignee(ticket.assigneeId),
    createdBy: ticket.createdBy,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    commentCount: ticket.commentCount,
  };
}

const demoTicketListItems = demoTickets.map(toTicketListItem);

const MAX_SKIP = 10000;

type PaginationParseResult =
  | { ok: true; page: number; perPage: number }
  | { ok: false; details: ApiValidationErrorDetail[] };

const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => (data.page - 1) * data.perPage <= MAX_SKIP, {
    message: "ページ範囲が大きすぎます",
    path: ["page"],
  });

function parsePaginationQuery(url: URL): PaginationParseResult {
  const result = paginationQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!result.success) {
    return { ok: false, details: mapZodIssuesToDetails(result.error.issues) };
  }
  return { ok: true, page: result.data.page, perPage: result.data.perPage };
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
    const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
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

    const { title, description, status, priority, assigneeId } =
      parseResult.data;

    if (status === "closed") {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "入力内容を確認してください",
          [
            {
              field: "status",
              message:
                "作成時に指定できるステータスは open, in-progress のみです",
            },
          ],
        ),
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    return HttpResponse.json(
      createApiSuccessResponse({
        id: "mock-new-ticket-id",
        organizationId: id,
        title,
        description: description ?? null,
        status: status ?? "open",
        priority: priority ?? "medium",
        assigneeId: assigneeId ?? null,
        createdBy: "mock-user-id",
        createdAt: now,
        updatedAt: now,
        commentCount: 0,
      }),
      { status: 201 },
    );
  }),
];
