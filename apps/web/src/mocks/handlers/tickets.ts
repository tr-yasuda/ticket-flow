import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { demoOrganization } from "../data/organizations.js";
import { demoTickets, type MockTicket } from "../data/tickets.js";

function isValidStatus(status: string): status is MockTicket["status"] {
  return ["open", "in-progress", "closed"].includes(status);
}

export const ticketHandlers = [
  http.get("/api/organizations/:id/tickets", ({ params }) => {
    const id = params.id as string;

    if (id !== demoOrganization.id) {
      return HttpResponse.json(createApiSuccessResponse([]), { status: 200 });
    }

    return HttpResponse.json(createApiSuccessResponse(demoTickets), {
      status: 200,
    });
  }),

  http.get("/api/organizations/:id/tickets/:ticketId", ({ params }) => {
    const { id, ticketId } = params as { id: string; ticketId: string };

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
    const id = params.id as string;
    const body = (await request.json()) as {
      title?: unknown;
      status?: unknown;
    };

    if (id !== demoOrganization.id) {
      return HttpResponse.json(
        createApiErrorResponse(ApiErrorCode.NOT_FOUND, "組織が見つかりません"),
        { status: 404 },
      );
    }

    if (typeof body.title !== "string" || body.title === "") {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "タイトルは必須です",
        ),
        { status: 400 },
      );
    }

    const status =
      typeof body.status === "string" && isValidStatus(body.status)
        ? body.status
        : "open";

    return HttpResponse.json(
      createApiSuccessResponse({
        id: "mock-new-ticket-id",
        organizationId: id,
        title: body.title,
        status,
      }),
      { status: 201 },
    );
  }),
];
