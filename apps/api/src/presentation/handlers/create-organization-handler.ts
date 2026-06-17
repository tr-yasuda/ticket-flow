import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  createOrganizationInputSchema,
  mapZodErrorToValidationDetails,
  type CreateOrganizationInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { createOrganization } from "../../application/create-organization.js";
import type { CreateOrganizationDependencies } from "../../application/create-organization.js";

export function createCreateOrganizationHandler(
  deps: CreateOrganizationDependencies,
) {
  return async (c: Context) => {
    const userId = c.get("userId");
    if (userId === undefined) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "認証が必要です",
        ),
        401,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.BAD_REQUEST,
          "リクエストボディが不正です",
        ),
        400,
      );
    }

    const parseResult = createOrganizationInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "入力内容を確認してください",
          mapZodErrorToValidationDetails(parseResult.error),
        ),
        400,
      );
    }

    const input: CreateOrganizationInput = parseResult.data;

    const result = await createOrganization(
      {
        name: input.name,
        slug: input.slug,
        ownerUserId: userId,
      },
      deps,
    );

    if (!result.success) {
      return c.json(
        createApiErrorResponse(ApiErrorCode.CONFLICT, result.error.message),
        409,
      );
    }

    return c.json(
      createApiSuccessResponse({
        id: result.data.organization.id,
        name: result.data.organization.name,
        slug: result.data.organization.slug,
      }),
      201,
    );
  };
}
