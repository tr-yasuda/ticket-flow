import type { Hook } from "@hono/standard-validator";
import {
  ApiErrorCode,
  createApiErrorResponse,
  mapZodErrorToValidationDetails,
} from "@ticket-flow/shared";
import type { Env } from "hono";

export const validationHook: Hook<unknown, Env, string> = (result, c) => {
  if (!result.success) {
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        "入力内容を確認してください",
        mapZodErrorToValidationDetails(result.error),
      ),
      400,
    );
  }
};
