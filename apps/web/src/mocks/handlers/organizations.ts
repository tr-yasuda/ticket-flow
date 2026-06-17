import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { demoOrganization } from "../data/organizations.js";

export const organizationHandlers = [
  http.get("/api/organizations/:id", ({ params }) => {
    const id = params.id as string;

    if (id !== demoOrganization.id) {
      return HttpResponse.json(
        createApiErrorResponse(ApiErrorCode.NOT_FOUND, "組織が見つかりません"),
        { status: 404 },
      );
    }

    return HttpResponse.json(createApiSuccessResponse(demoOrganization), {
      status: 200,
    });
  }),

  http.post("/api/organizations", async ({ request }) => {
    const body = (await request.json()) as { name?: unknown };

    if (typeof body.name !== "string" || body.name === "") {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "組織名は必須です",
        ),
        { status: 400 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({
        id: "mock-new-org-id",
        name: body.name,
        ownerId: "demo-user-001",
      }),
      { status: 201 },
    );
  }),
];
