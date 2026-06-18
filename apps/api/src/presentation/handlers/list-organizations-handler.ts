import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import {
  listOrganizations,
  type ListOrganizationsDependencies,
} from "../../application/list-organizations.js";

export function createListOrganizationsHandler(
  deps: ListOrganizationsDependencies,
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

    const result = await listOrganizations(userId, deps);
    return c.json(createApiSuccessResponse(result.data), 200);
  };
}
