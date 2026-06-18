import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  createOrganizationInputSchema,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { generateSlug } from "../../lib/slugs.js";
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
        createApiErrorResponse(ApiErrorCode.NOT_FOUND, "組織が見つかりません"),
        { status: 404 },
      );
    }

    return HttpResponse.json(createApiSuccessResponse(demoOrganization), {
      status: 200,
    });
  }),

  http.post("/api/organizations", async ({ request }) => {
    const body = (await request.json()) as {
      name?: unknown;
      slug?: unknown;
    };

    if (typeof body.name !== "string" || body.name === "") {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "組織名は必須です",
        ),
        { status: 400 },
      );
    }

    const slug =
      typeof body.slug === "string" && body.slug !== ""
        ? body.slug
        : generateSlug(body.name);

    const parseResult = createOrganizationInputSchema.safeParse({
      name: body.name,
      slug,
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

    if (slug === demoOrganization.slug) {
      return HttpResponse.json(
        createApiErrorResponse(ApiErrorCode.CONFLICT, "Slug already exists"),
        { status: 409 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({
        id: "mock-new-org-id",
        name: body.name,
        slug,
      }),
      { status: 201 },
    );
  }),
];
