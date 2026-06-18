import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  loginInputSchema,
  mapZodErrorToValidationDetails,
  registerInputSchema,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "../services/auth-service.js";

export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (authorization === undefined) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

export async function registerController(c: Context) {
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

  const result = await registerUser(parseResult.data);

  if (!result.success) {
    const code =
      result.error.type === "email-already-exists"
        ? ApiErrorCode.CONFLICT
        : ApiErrorCode.VALIDATION_ERROR;
    const status = code === ApiErrorCode.CONFLICT ? 409 : 400;
    return c.json(createApiErrorResponse(code, result.error.message), status);
  }

  return c.json(createApiSuccessResponse(result.data), 201);
}

export async function loginController(c: Context) {
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

  const result = await loginUser(parseResult.data);

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

  return c.json(createApiSuccessResponse(result.data), 200);
}

export async function logoutController(c: Context) {
  const token = extractBearerToken(c.req.header("Authorization"));

  if (token !== null) {
    await logoutUser({ refreshToken: token });
  }

  return c.body(null, 204);
}

export async function refreshController(c: Context) {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (token === null) {
    return c.json({ error: "Authorization header is required" }, 401);
  }

  const result = await refreshAccessToken({ refreshToken: token });
  if (!result.success) {
    return c.json({ error: result.error.message }, 401);
  }

  return c.json({ accessToken: result.data.accessToken }, 200);
}
