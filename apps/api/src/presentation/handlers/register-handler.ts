import {
  ApiErrorCode,
  createApiErrorResponse,
  mapZodErrorToValidationDetails,
  registerInputSchema,
  type RegisterInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { registerUser } from "../../application/register-user.js";
import type { RegisterUserDependencies } from "../../application/register-user.js";

export function createRegisterHandler(deps: RegisterUserDependencies) {
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

    const parseResult = registerInputSchema.safeParse(body);
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

    const input: RegisterInput = parseResult.data;

    const result = await registerUser(input, deps);

    if (!result.success) {
      const code =
        result.error.type === "email-already-exists"
          ? ApiErrorCode.CONFLICT
          : ApiErrorCode.VALIDATION_ERROR;
      const status = code === ApiErrorCode.CONFLICT ? 409 : 400;
      return c.json(createApiErrorResponse(code, result.error.message), status);
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
      201,
    );
  };
}
