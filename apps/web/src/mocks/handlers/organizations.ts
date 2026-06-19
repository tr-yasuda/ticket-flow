import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  createOrganizationInputSchema,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { demoOrganization } from "../data/organizations.js";

export const organizationHandlers = [
  http.get("/api/organizations", () => {
    return HttpResponse.json(
      createApiSuccessResponse({ organizations: [demoOrganization] }),
      { status: 200 },
    );
  }),

  http.get("/api/organizations/:id", ({ params }) => {
    const id = params.id as string;

    if (id !== demoOrganization.id) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_FORBIDDEN,
          "組織へのアクセス権限がありません",
        ),
        { status: 403 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({
        organizationId: demoOrganization.id,
        organizationRole: demoOrganization.role,
      }),
      { status: 200 },
    );
  }),

  http.post("/api/organizations", async ({ request }) => {
    const body = (await request.json()) as {
      name?: unknown;
      slug?: unknown;
    };

    if (typeof body.slug !== "string" || body.slug === "") {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "slug は必須です",
        ),
        { status: 400 },
      );
    }

    const parseResult = createOrganizationInputSchema.safeParse({
      name: body.name,
      slug: body.slug,
    });
    if (!parseResult.success) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "入力内容を確認してください",
        ),
        { status: 400 },
      );
    }

    const { name, slug } = parseResult.data;

    if (slug === demoOrganization.slug) {
      return HttpResponse.json(
        createApiErrorResponse(ApiErrorCode.CONFLICT, "Slug already exists"),
        { status: 409 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({
        id: "mock-new-org-id",
        name,
        slug,
      }),
      { status: 201 },
    );
  }),
];
