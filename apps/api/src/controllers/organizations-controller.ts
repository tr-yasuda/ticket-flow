import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  type CreateOrganizationInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { getValidatedJson } from "../lib/validated-json.js";
import { createOrganization } from "../services/organizations-service.js";

export async function createOrganizationController(c: Context) {
  const userId = c.get("userId");
  if (userId === undefined) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      401,
    );
  }

  const data = getValidatedJson<CreateOrganizationInput>(c);
  const result = await createOrganization({
    name: data.name,
    slug: data.slug,
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
