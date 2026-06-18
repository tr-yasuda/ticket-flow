import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  createOrganizationInputSchema,
  mapZodErrorToValidationDetails,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { createOrganization } from "../services/organizations-service.js";

export async function createOrganizationController(c: Context) {
  const userId = c.get("userId");
  if (userId === undefined) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
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

  const result = await createOrganization({
    name: parseResult.data.name,
    slug: parseResult.data.slug,
    ownerUserId: userId,
  });

  if (!result.success) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.CONFLICT, result.error.message),
      409,
    );
  }

  return c.json(createApiSuccessResponse(result.data), 201);
}
