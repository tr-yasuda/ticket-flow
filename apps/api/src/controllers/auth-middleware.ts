import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import type { Context, Next } from "hono";

import { verifyAccessToken } from "../domain/token.js";
import { HttpStatus } from "../lib/http-status.js";
import { tokenConfig } from "../lib/token-config.js";

declare module "hono" {
  interface ContextVariableMap {
    userId?: string;
  }
}

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

  let userId: string;
  try {
    ({ userId } = await verifyAccessToken(token, tokenConfig));
  } catch {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  c.set("userId", userId);
  await next();
}
