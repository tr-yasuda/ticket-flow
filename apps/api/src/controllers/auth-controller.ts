import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  type LoginInput,
  type RegisterInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { getValidatedJson } from "../lib/validated-json.js";
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
  const data = getValidatedJson<RegisterInput>(c);
  const result = await registerUser(data);

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
  const data = getValidatedJson<LoginInput>(c);
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
