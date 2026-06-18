import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  type CreateOrganizationInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { HttpStatus } from "../lib/http-status.js";
import { getValidatedJson } from "../lib/validated-json.js";
import { createOrganization } from "../services/organizations-service.js";

export async function createOrganizationController(c: Context) {
  const userId = c.get("userId");
  if (userId === undefined) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  const data = getValidatedJson<CreateOrganizationInput>(c);
  const result = await createOrganization({
    name: data.name,
    slug: data.slug,
    ownerUserId: userId,
  });

  if (!result.success) {
    const isSlugConflict = result.error.type === "slug-already-exists";
    return c.json(
      createApiErrorResponse(
        isSlugConflict ? ApiErrorCode.CONFLICT : ApiErrorCode.VALIDATION_ERROR,
        result.error.message,
      ),
      isSlugConflict ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST,
    );
  }

  return c.json(createApiSuccessResponse(result.data), HttpStatus.CREATED);
}
