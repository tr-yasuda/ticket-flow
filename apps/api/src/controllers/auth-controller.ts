import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  type LoginInput,
  type RegisterInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { extractBearerToken } from "../lib/extract-bearer-token.js";
import { HttpStatus } from "../lib/http-status.js";
import {
  type JsonInput,
  type ValidatedContext,
} from "../lib/validated-input.js";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "../services/auth-service.js";

type RegisterControllerContext = ValidatedContext<JsonInput<RegisterInput>>;
type LoginControllerContext = ValidatedContext<JsonInput<LoginInput>>;

export async function registerController(c: RegisterControllerContext) {
  const data = c.req.valid("json");
  const result = await registerUser(data);

  if (!result.success) {
    const code =
      result.error.type === "email-already-exists"
        ? ApiErrorCode.CONFLICT
        : ApiErrorCode.VALIDATION_ERROR;
    const status =
      code === ApiErrorCode.CONFLICT
        ? HttpStatus.CONFLICT
        : HttpStatus.BAD_REQUEST;
    return c.json(createApiErrorResponse(code, result.error.message), status);
  }

  return c.json(createApiSuccessResponse(result.data), HttpStatus.CREATED);
}

export async function loginController(c: LoginControllerContext) {
  const data = c.req.valid("json");
  const result = await loginUser(data);

  if (!result.success) {
    const isValidationError = result.error.type === "invalid-email";
    return c.json(
      createApiErrorResponse(
        isValidationError
          ? ApiErrorCode.VALIDATION_ERROR
          : ApiErrorCode.AUTH_UNAUTHORIZED,
        result.error.message,
      ),
      isValidationError ? HttpStatus.BAD_REQUEST : HttpStatus.UNAUTHORIZED,
    );
  }

  return c.json(createApiSuccessResponse(result.data), HttpStatus.OK);
}

export async function logoutController(c: Context) {
  const token = extractBearerToken(c.req.header("Authorization"));

  if (token !== null) {
    await logoutUser({ refreshToken: token });
  }

  return c.body(null, HttpStatus.NO_CONTENT);
}

export async function refreshController(c: Context) {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (token === null) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  const result = await refreshAccessToken({ refreshToken: token });
  if (!result.success) {
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.AUTH_UNAUTHORIZED,
        result.error.message,
      ),
      HttpStatus.UNAUTHORIZED,
    );
  }

  return c.json(
    createApiSuccessResponse({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    }),
    HttpStatus.OK,
  );
}
