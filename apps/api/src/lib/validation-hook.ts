import type { Hook } from "@hono/standard-validator";
import {
  ApiErrorCode,
  createApiErrorResponse,
  mapZodErrorToValidationDetails,
} from "@ticket-flow/shared";
import type { Env } from "hono";

function extractValidationIssues(
  error: unknown,
): Parameters<typeof mapZodErrorToValidationDetails>[0] {
  if (Array.isArray(error)) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    return (
      error as { issues: Parameters<typeof mapZodErrorToValidationDetails>[0] }
    ).issues;
  }
  return [];
}

export const validationHook: Hook<unknown, Env, string> = (result, c) => {
  if (!result.success) {
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        "入力内容を確認してください",
        mapZodErrorToValidationDetails(extractValidationIssues(result.error)),
      ),
      400,
    );
  }
};
