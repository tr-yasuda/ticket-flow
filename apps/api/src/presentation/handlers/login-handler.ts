import {
  ApiErrorCode,
  createApiErrorResponse,
  loginInputSchema,
  mapZodErrorToValidationDetails,
  type LoginInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { loginUser } from "../../application/login-user.js";
import type { LoginUserDependencies } from "../../application/login-user.js";

export function createLoginHandler(deps: LoginUserDependencies) {
  return async (c: Context) => {
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

    const parseResult = loginInputSchema.safeParse(body);
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

    const input: LoginInput = parseResult.data;

    const result = await loginUser(input, deps);

    if (!result.success) {
      const isValidationError = result.error.type === "invalid-email";
      return c.json(
        createApiErrorResponse(
          isValidationError
            ? ApiErrorCode.VALIDATION_ERROR
            : ApiErrorCode.AUTH_UNAUTHORIZED,
          result.error.message,
        ),
        isValidationError ? 400 : 401,
      );
    }

    return c.json(
      {
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
        },
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      },
      200,
    );
  };
}
