import {
  ApiErrorCode,
  type ApiValidationErrorDetail,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
  createTicketInputSchema,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { demoOrganization } from "../data/organizations.js";
import {
  demoTickets,
  type MockTicket,
  type MockTicketAssignee,
  type MockTicketListItem,
} from "../data/tickets.js";
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

export const ticketHandlers = [
  http.get("/api/organizations/:id/tickets", ({ params }) => {
    const id = normalizePathParam(params.id);

    if (id !== demoOrganization.id) {
      return HttpResponse.json(
        createApiPaginatedSuccessResponse(
          { tickets: [] },
          { page: 1, perPage: 20, total: 0, totalPages: 1 },
        ),
        { status: 200 },
      );
    }

    return HttpResponse.json(
      createApiPaginatedSuccessResponse(
        { tickets: demoTicketListItems },
        {
          page: 1,
          perPage: 20,
          total: demoTicketListItems.length,
          totalPages: 1,
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

    const parseResult = createTicketInputSchema.safeParse({
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
        assigneeId: assigneeId ?? null,
        createdBy: "mock-user-id",
        createdAt: now,
        updatedAt: now,
      }),
      { status: 201 },
    );
  }),
];
