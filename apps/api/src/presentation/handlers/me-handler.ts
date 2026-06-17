import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import {
  getCurrentUser,
  type GetCurrentUserDependencies,
} from "../../application/get-current-user.js";

export type MeHandlerDependencies = GetCurrentUserDependencies;

export function createMeHandler(deps: MeHandlerDependencies) {
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

    const result = await getCurrentUser({ userId }, deps);
    if (!result.success) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "認証が必要です",
        ),
        401,
      );
    }

    return c.json(createApiSuccessResponse(result.data), 200);
  };
}
