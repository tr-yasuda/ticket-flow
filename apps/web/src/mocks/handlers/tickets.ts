import {
  ApiErrorCode,
  type ApiValidationErrorDetail,
  createApiErrorResponse,
  createApiSuccessResponse,
  createTicketInputSchema,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { demoOrganization } from "../data/organizations.js";
import { demoTickets } from "../data/tickets.js";
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

export const ticketHandlers = [
  http.get("/api/organizations/:id/tickets", ({ params }) => {
    const id = normalizePathParam(params.id);

    if (id !== demoOrganization.id) {
      return HttpResponse.json(createApiSuccessResponse([]), { status: 200 });
    }

    return HttpResponse.json(createApiSuccessResponse(demoTickets), {
      status: 200,
    });
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
