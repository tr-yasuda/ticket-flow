import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { HttpStatus } from "../lib/http-status.js";
import { getCurrentUser } from "../services/user-service.js";

export async function meController(c: Context) {
  const userId = c.get("userId");
  if (userId === undefined) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  const result = await getCurrentUser({ userId });
  if (!result.success) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  return c.json(createApiSuccessResponse(result.data), HttpStatus.OK);
}
