import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import type { Context, Next } from "hono";

import { verifyAccessToken } from "../domain/token.js";
import { env } from "../lib/env.js";
import { HttpStatus } from "../lib/http-status.js";

declare module "hono" {
  interface ContextVariableMap {
    userId?: string;
  }
}

const tokenConfig = {
  secret: env.JWT_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

export async function authMiddleware(c: Context, next: Next) {
  const authorization = c.req.header("Authorization");
  if (authorization === undefined) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1];
  if (token === undefined) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  try {
    const { userId } = await verifyAccessToken(token, tokenConfig);
    c.set("userId", userId);
    await next();
  } catch {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }
}
